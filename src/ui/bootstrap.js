/**
 * @layer ui
 * @phase P9
 * @doc §2.1 孩子端（学习模块）
 *
 * 内容快照 + 练习设计：一开始只加载共享 IndexedDB 内容；
 * 孩子选单元/模式后才生成计划。下一次练习重新读取内容。
 */

import { MemoryAdapter } from '../storage/MemoryAdapter.js';
import { IndexedDBAdapter } from '../storage/IndexedDBAdapter.js';
import { CONTENT_VERSION, importContent, readContentVersion } from '../storage/contentImport.js';
import { readPracticeSettings } from '../storage/practiceSettings.js';
import { DEFAULT_TEXTBOOK, readActiveTextbook } from '../storage/textbooks.js';
import { GraphemeRepository } from '../repositories/GraphemeRepository.js';
import { WordRepository } from '../repositories/WordRepository.js';
import { StateRepository } from '../repositories/StateRepository.js';
import { AttemptRepository } from '../repositories/AttemptRepository.js';
import { SentenceRepository } from '../repositories/SentenceRepository.js';
import { Scheduler } from '../scheduler/Scheduler.js';
import { PracticeSession } from './PracticeSession.js';
import { selectAutoUnits } from './unitProgress.js';
import { hashSeed } from '../core/seedRandom.js';
import { toDayKey } from '../core/time.js';
import { unitProgress as computeUnitProgress } from './masteryProgress.js';

export const P1_WORD_IDS = Object.freeze(['w.fish', 'w.ship', 'w.night']);

const TERM_DEFINITIONS = Object.freeze([1, 2, 3, 4, 5, 6].flatMap((grade) => ([
  { id: `g${grade}-s1`, grade, term: '上', label: `${['一', '二', '三', '四', '五', '六'][grade - 1]}年级上` },
  { id: `g${grade}-s2`, grade, term: '下', label: `${['一', '二', '三', '四', '五', '六'][grade - 1]}年级下` },
])));

async function fetchJson(relativePath) {
  const response = await fetch(new URL(relativePath, import.meta.url));
  if (!response.ok) throw new Error(`failed to load ${relativePath}: HTTP ${response.status}`);
  return response.json();
}

async function createAdapter() {
  try {
    const adapter = new IndexedDBAdapter();
    await adapter.init();
    return { adapter, storage: 'indexeddb' };
  } catch (error) {
    console.warn('[SpellWell] IndexedDB unavailable, falling back to memory', error);
  }
  const adapter = new MemoryAdapter();
  await adapter.init();
  return { adapter, storage: 'memory' };
}

async function ensureContent(adapter) {
  const current = await readContentVersion(adapter);
  if (current === CONTENT_VERSION) return { seeded: false, version: CONTENT_VERSION };
  // 用户选择“新静态内容覆盖旧内容”：版本不匹配时直接导入工程内静态词库。
  const [words, graphemes, sentences, confusables] = await Promise.all([
    fetchJson('../content/words.json'),
    fetchJson('../content/graphemes.json'),
    fetchJson('../content/sentences.json'),
    fetchJson('../content/confusables.json'),
  ]);
  return importContent(adapter, { words, graphemes, sentences, confusables, version: CONTENT_VERSION });
}

async function readContent(adapter) {
  const [words, graphemes, sentences, wordStates, attempts] = await Promise.all([
    adapter.query('words', {}),
    adapter.query('graphemes', {}),
    adapter.query('sentences', {}),
    adapter.query('wordStates', {}),
    adapter.query('attempts', {}),
  ]);
  const settings = await readPracticeSettings(adapter);
  const activeTextbook = await readActiveTextbook(adapter);
  const revisionRecord = await adapter.get('meta', 'contentRevision');
  const graphemeMap = Object.fromEntries(graphemes.map((item) => [item.id, item]));
  const sentenceByWord = Object.fromEntries(sentences.map((item) => [String(item.wordId), item]));
  const activeWords = words.filter((word) =>
    (word.textbook ?? DEFAULT_TEXTBOOK) === activeTextbook && word.reviewStatus !== 'retired',
  );
  const stateByWord = new Map(wordStates.map((state) => [String(state.wordId), state]));
  const unitMap = new Map();
  for (const word of activeWords) {
    const id = String(word.unitId ?? `level-${word.level ?? 1}`);
    const label = String(word.unitLabel ?? `Level ${word.level ?? 1}`);
    if (!unitMap.has(id)) {
      unitMap.set(id, {
        id,
        label,
        grade: Number(word.grade ?? word.level ?? 1),
        term: String(word.term ?? '下'),
        unit: Number(word.unit ?? 1),
        count: 0,
        practiced: 0,
        masteredCount: 0,
        completed: false,
        mastered: false,
      });
    }
    const unit = unitMap.get(id);
    unit.count += 1;
    const wordState = stateByWord.get(String(word.id));
    if (wordState) unit.practiced += 1;
    if (wordState?.status === 'mastered' && (wordState.errorProfile?.length ?? 0) === 0) unit.masteredCount += 1;
    unit.completed = unit.practiced === unit.count;
    unit.mastered = unit.masteredCount === unit.count;
  }
  const units = [...unitMap.values()].sort((a, b) => a.id.localeCompare(b.id));
  for (const unit of units) {
    const wordsInUnit = activeWords.filter((word) => String(word.unitId ?? `level-${word.level ?? 1}`) === unit.id);
    const progress = computeUnitProgress(wordStates, wordsInUnit, attempts);
    unit.progress = progress.progress;
    unit.percent = progress.percent;
    unit.practiced = progress.practiced;
    unit.masteredCount = progress.mastered;
    unit.completed = unit.practiced === unit.count;
    unit.mastered = unit.masteredCount === unit.count;
  }
  const terms = TERM_DEFINITIONS.map((definition) => ({
    ...definition,
    units: units.filter((unit) => unit.grade === definition.grade && unit.term === definition.term),
  }));
  return {
    words,
    activeWords,
    graphemes,
    graphemeMap,
    sentences,
    sentenceByWord,
    settings,
    activeTextbook,
    revision: Number(revisionRecord?.value ?? 0),
    units,
    terms,
  };
}

function buildBundles(words, graphemeMap, sentenceByWord) {
  return words.map((word) => {
    if (!word || typeof word.id !== 'string' || !Array.isArray(word.units)) {
      throw new Error('invalid word content');
    }
    for (const unit of word.units) {
      if (!graphemeMap[unit.graphemeId]) {
        throw new Error(`${word.id} references missing grapheme ${unit.graphemeId}`);
      }
    }
    const sentence = sentenceByWord[String(word.id)];
    return { word, graphemes: graphemeMap, sentences: sentence ? [sentence] : [] };
  });
}

/**
 * @returns {Promise<{
 *   adapter: MemoryAdapter|IndexedDBAdapter,
 *   storage: 'indexeddb'|'memory',
 *   contentSeeded: boolean,
 *   units: {id: string, label: string, count: number}[],
 *   settings: {questionsPerPractice: number, defaultMode: 'review'|'effort'},
 *   refresh: () => Promise<void>,
 *   startPractice: (request: {units?: string[]|null, mode?: 'review'|'effort'}) => Promise<{
 *     session: PracticeSession,
 *     scheduler: Scheduler,
 *     loadReport: () => Promise<any>
 *   }>
 * }>}
 */
export async function createPracticeWorkspace() {
  const { adapter, storage } = await createAdapter();
  const content = await ensureContent(adapter);
  let snapshot = await readContent(adapter);

  const refresh = async () => {
    snapshot = await readContent(adapter);
  };

  const startPractice = async ({ units = null, mode = null } = {}) => {
    // 下一轮练习开始前重新读内容；当前会话不会因为后台编辑而重建。
    snapshot = await readContent(adapter);
    const selectedUnits = Array.isArray(units) && units.length > 0 ? new Set(units.map(String)) : null;
    const words = snapshot.activeWords.filter(
      (word) => !selectedUnits || selectedUnits.has(String(word.unitId ?? `level-${word.level ?? 1}`)),
    );
    if (words.length === 0) throw new Error('no words in selected units');
    const selectedMode = mode ?? snapshot.settings.defaultMode;
    const attempts = await adapter.query('attempts', {});
    const sessionSeed = hashSeed(`session|${attempts.length}|${toDayKey(new Date())}|${[...selectedUnits ?? []].sort().join(',')}|${selectedMode}`);
    const bundles = buildBundles(words, snapshot.graphemeMap, snapshot.sentenceByWord);
    const wordRepository = new WordRepository(adapter);
    const stateRepository = new StateRepository(adapter);
    const attemptRepository = new AttemptRepository(adapter);
    const scheduler = new Scheduler({
      wordRepository: {
        all: async () => words,
        get: async (id) => words.find((word) => String(word.id) === String(id)),
      },
      stateRepository,
      attemptRepository,
      graphemeMap: snapshot.graphemeMap,
      distractorPool: snapshot.graphemes.map((item) => ({ id: item.id, text: item.text })),
      sentences: snapshot.sentenceByWord,
      seed: sessionSeed,
      size: snapshot.settings.questionsPerPractice,
    });
    const specs = await scheduler.buildDailyQueue({
      size: snapshot.settings.questionsPerPractice,
      units: selectedUnits ? [...selectedUnits] : null,
      mode: selectedMode,
    });
    const session = new PracticeSession({
      bundles,
      distractorPool: snapshot.graphemes.map((item) => ({ id: item.id, text: item.text })),
      seed: sessionSeed,
      specs,
    });
    const loadReport = async () => ({
      attempts: await attemptRepository.recent(200),
      wordStates: await stateRepository.listWordStates(),
      graphemeStates: await adapter.query('graphemeStates', {}),
    });
    return { session, scheduler, loadReport };
  };

  return {
    adapter,
    storage,
    contentSeeded: content.seeded,
    get revision() { return snapshot.revision; },
    get textbook() { return snapshot.activeTextbook; },
    get units() { return snapshot.units; },
    get terms() { return snapshot.terms; },
    autoSelection(target = snapshot.settings.questionsPerPractice) {
      return selectAutoUnits(snapshot.units, target);
    },
    get settings() { return snapshot.settings; },
    refresh,
    startPractice,
    // 兼容旧调试引用：默认全单元、后台默认模式
    loadReport: async () => ({
      attempts: await new AttemptRepository(adapter).recent(200),
      wordStates: await new StateRepository(adapter).listWordStates(),
      graphemeStates: await adapter.query('graphemeStates', {}),
    }),
  };
}

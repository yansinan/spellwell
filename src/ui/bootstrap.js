/**
 * @layer ui
 * @phase P3
 * @doc §2.1 孩子端（学习模块）
 *
 * P2 内容持久化 + P3 每日队列：IndexedDBAdapter 优先，
 * Scheduler 生成 5—8 个词；IndexedDB 不可用时回退 MemoryAdapter。
 */

import { MemoryAdapter } from '../storage/MemoryAdapter.js';
import { IndexedDBAdapter } from '../storage/IndexedDBAdapter.js';
import { CONTENT_VERSION, importContent, readContentVersion } from '../storage/contentImport.js';
import { GraphemeRepository } from '../repositories/GraphemeRepository.js';
import { WordRepository } from '../repositories/WordRepository.js';
import { StateRepository } from '../repositories/StateRepository.js';
import { AttemptRepository } from '../repositories/AttemptRepository.js';
import { SentenceRepository } from '../repositories/SentenceRepository.js';
import { Scheduler } from '../scheduler/Scheduler.js';
import { PracticeSession } from './PracticeSession.js';

export const P1_WORD_IDS = Object.freeze(['w.fish', 'w.ship', 'w.night']);

/**
 * @param {string} relativePath
 * @returns {Promise<any>}
 */
async function fetchJson(relativePath) {
  const response = await fetch(new URL(relativePath, import.meta.url));
  if (!response.ok) {
    throw new Error(`failed to load ${relativePath}: HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * @returns {Promise<{adapter: MemoryAdapter|IndexedDBAdapter, storage: 'indexeddb'|'memory'}>}
 */
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

/**
 * @param {MemoryAdapter|IndexedDBAdapter} adapter
 * @returns {Promise<{seeded: boolean, version: number, counts: Record<string, number>}>}
 */
async function ensureContent(adapter) {
  const current = await readContentVersion(adapter);
  if (current === CONTENT_VERSION) {
    return { seeded: false, version: CONTENT_VERSION, counts: {} };
  }

  const [words, graphemes, sentences, confusables] = await Promise.all([
    fetchJson('../content/words.json'),
    fetchJson('../content/graphemes.json'),
    fetchJson('../content/sentences.json'),
    fetchJson('../content/confusables.json'),
  ]);
  return importContent(adapter, {
    words,
    graphemes,
    sentences,
    confusables,
    version: CONTENT_VERSION,
  });
}

/**
 * @param {{
 *   wordIds?: readonly string[]|null,
 *   seed?: number|string,
 *   size?: number
 * }} [options]
 * @returns {Promise<{
 *   session: PracticeSession,
 *   adapter: MemoryAdapter|IndexedDBAdapter,
 *   scheduler: Scheduler,
 *   storage: 'indexeddb'|'memory',
 *   contentSeeded: boolean
 * }>}
 */
export async function createP1Session({ wordIds = null, seed = 20261111, size = 6 } = {}) {
  const { adapter, storage } = await createAdapter();
  const content = await ensureContent(adapter);

  const wordRepository = new WordRepository(adapter);
  const graphemeRepository = new GraphemeRepository(adapter);
  const stateRepository = new StateRepository(adapter);
  const attemptRepository = new AttemptRepository(adapter);
  const sentenceRepository = new SentenceRepository(adapter);

  const allGraphemes = await graphemeRepository.all();
  const graphemeMap = Object.fromEntries(allGraphemes.map((grapheme) => [grapheme.id, grapheme]));
  const allWords = await wordRepository.all();
  const allSentences = await sentenceRepository.all();
  const sentenceByWord = Object.fromEntries(allSentences.map((sentence) => [String(sentence.wordId), sentence]));
  const allowedIds = wordIds ? new Set(wordIds) : null;
  const words = allowedIds ? allWords.filter((word) => allowedIds.has(String(word.id))) : allWords;

  const bundles = [];
  for (const word of words) {
    if (!word || typeof word.id !== 'string' || !Array.isArray(word.units)) {
      throw new Error('invalid word content');
    }
    for (const unit of word.units) {
      if (!graphemeMap[unit.graphemeId]) {
        throw new Error(`${word.id} references missing grapheme ${unit.graphemeId}`);
      }
    }
    bundles.push({ word: /** @type {any} */ (word), graphemes: graphemeMap });
  }
  if (bundles.length === 0) throw new Error('no word bundles available');

  const distractorPool = allGraphemes.map((grapheme) => ({ id: grapheme.id, text: grapheme.text }));
  const scheduler = new Scheduler({
    wordRepository: {
      all: async () => words,
      get: async (id) => words.find((word) => String(word.id) === String(id)),
    },
    stateRepository,
    attemptRepository,
    graphemeMap,
    distractorPool,
    sentences: sentenceByWord,
    seed,
    size,
  });
  const specs = await scheduler.buildDailyQueue({ size });
  const session = new PracticeSession({
    bundles,
    distractorPool,
    sentences: sentenceByWord,
    seed,
    specs,
  });

  return {
    session,
    adapter,
    scheduler,
    storage,
    contentSeeded: content.seeded,
  };
}

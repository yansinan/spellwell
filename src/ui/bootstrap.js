/**
 * @layer ui
 * @phase P2
 * @doc §2.1 孩子端（学习模块）
 *
 * P2 内容装配：优先 IndexedDBAdapter；首次加载导入 content JSON，
 * 之后按 meta.contentVersion 幂等跳过网络与写入。IndexedDB 不可用时回退 MemoryAdapter。
 */

import { MemoryAdapter } from '../storage/MemoryAdapter.js';
import { IndexedDBAdapter } from '../storage/IndexedDBAdapter.js';
import { CONTENT_VERSION, importContent, readContentVersion } from '../storage/contentImport.js';
import { GraphemeRepository } from '../repositories/GraphemeRepository.js';
import { WordRepository } from '../repositories/WordRepository.js';
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
 * @param {{wordIds?: readonly string[], seed?: number|string}} [options]
 * @returns {Promise<{
 *   session: PracticeSession,
 *   adapter: MemoryAdapter|IndexedDBAdapter,
 *   storage: 'indexeddb'|'memory',
 *   contentSeeded: boolean
 * }>}
 */
export async function createP1Session({ wordIds = P1_WORD_IDS, seed = 20261111 } = {}) {
  const { adapter, storage } = await createAdapter();
  const content = await ensureContent(adapter);

  const wordRepository = new WordRepository(adapter);
  const graphemeRepository = new GraphemeRepository(adapter);
  const allGraphemes = await graphemeRepository.all();
  const graphemeMap = Object.fromEntries(allGraphemes.map((grapheme) => [grapheme.id, grapheme]));

  const bundles = [];
  for (const wordId of wordIds) {
    const word = await wordRepository.get(wordId);
    if (!word) throw new Error(`missing word content: ${wordId}`);
    for (const unit of word.units ?? []) {
      if (!graphemeMap[unit.graphemeId]) {
        throw new Error(`${wordId} references missing grapheme ${unit.graphemeId}`);
      }
    }
    bundles.push({ word, graphemes: graphemeMap });
  }

  const session = new PracticeSession({
    bundles,
    distractorPool: allGraphemes.map((grapheme) => ({ id: grapheme.id, text: grapheme.text })),
    seed,
  });
  return {
    session,
    adapter,
    storage,
    contentSeeded: content.seeded,
  };
}

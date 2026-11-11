/**
 * @layer ui
 * @phase P1
 * @doc §2.1 孩子端（学习模块）
 *
 * P1 内容装配：同源读取 content JSON → MemoryAdapter → repositories → ResourceBundle。
 * 这是 P1 的临时边界；P2 会把内容导入切到 IndexedDBAdapter，P3 才接调度队列。
 */

import { MemoryAdapter } from '../storage/MemoryAdapter.js';
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
 * @param {{wordIds?: readonly string[], seed?: number|string}} [options]
 * @returns {Promise<{session: PracticeSession, debug: boolean}>}
 */
export async function createP1Session({ wordIds = P1_WORD_IDS, seed = 20261111 } = {}) {
  const [wordsDoc, graphemesDoc] = await Promise.all([
    fetchJson('../content/words.json'),
    fetchJson('../content/graphemes.json'),
  ]);

  const adapter = new MemoryAdapter({
    initialData: {
      words: wordsDoc.items,
      graphemes: graphemesDoc.items,
    },
  });
  await adapter.init();

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
  return { session, debug: false };
}

/**
 * @layer tests
 * @phase P1
 * @doc §2.1 孩子端（学习模块）
 *
 * P1 测试辅助：读取真实内容，构造 ResourceBundle / QuestionSpec / InputEvent。
 */

import { readFile } from 'node:fs/promises';
import { wordUnitId } from '../../src/questionTypes/shared.js';

export const P1_WORD_IDS = Object.freeze(['w.fish', 'w.ship', 'w.night']);
export const FIXED_NOW = 1760000000000;

/**
 * @param {string} relativePath
 * @returns {Promise<any>}
 */
async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, import.meta.url), 'utf8'));
}

export async function loadP1Content() {
  const [wordsDoc, graphemesDoc] = await Promise.all([
    readJson('../../src/content/words.json'),
    readJson('../../src/content/graphemes.json'),
  ]);
  const wordsById = new Map(wordsDoc.items.map((word) => [word.id, word]));
  const graphemesById = new Map(graphemesDoc.items.map((grapheme) => [grapheme.id, grapheme]));
  return { wordsDoc, graphemesDoc, wordsById, graphemesById };
}

export async function loadP1Bundles(wordIds = P1_WORD_IDS) {
  const content = await loadP1Content();
  const allGraphemes = Object.fromEntries(content.graphemesDoc.items.map((grapheme) => [grapheme.id, grapheme]));
  const bundles = wordIds.map((wordId) => {
    const word = content.wordsById.get(wordId);
    if (!word) throw new Error(`missing word ${wordId}`);
    return { word: structuredClone(word), graphemes: allGraphemes };
  });
  return { ...content, bundles };
}

/**
 * @param {{
 *   word: {id: string, text: string, units: {text: string, graphemeId: string}[]},
 *   typeId: string,
 *   params?: Record<string, unknown>,
 *   focusIndex?: number,
 *   seed?: number
 * }} input
 * @returns {import('../../src/core/contracts.js').QuestionSpec}
 */
export function makeSpec({ word, typeId, params = {}, focusIndex, seed = 42 }) {
  const focus = Number.isInteger(focusIndex)
    ? focusIndex
    : word.units.findIndex((unit) => unit.text.length > 1);
  const resolvedFocus = focus >= 0 ? focus : word.units.length - 1;
  return {
    specId: `spec.${word.id}.${typeId}.test`,
    typeId,
    target: { kind: 'word', id: word.id },
    focus: { kind: 'grapheme', id: word.units[resolvedFocus].graphemeId },
    params,
    resourceHints: { wordIds: [word.id], graphemeIds: word.units.map((unit) => unit.graphemeId) },
    seed,
  };
}

/**
 * @param {import('../../src/core/contracts.js').RenderModel} renderModel
 * @param {string} text
 * @param {number} [occurrence]
 * @returns {import('../../src/core/contracts.js').RenderUnit}
 */
export function tileByText(renderModel, text, occurrence = 0) {
  const matches = renderModel.units.filter((unit) => unit.text === text);
  if (!matches[occurrence]) throw new Error(`no tile "${text}" at occurrence ${occurrence}`);
  return matches[occurrence];
}

/**
 * 按目标词的正确单位生成 T-SEQUENCE 事件（使用 word#index，避开干扰项）。
 * @param {{id: string, units: {text: string}[]}} word
 * @param {import('../../src/core/contracts.js').RenderModel} renderModel
 * @returns {import('../../src/core/contracts.js').InputEvent[]}
 */
export function correctSequenceEvents(word, renderModel) {
  return word.units.map((unit, index) => {
    const unitId = wordUnitId(word, index);
    if (!renderModel.units.some((candidate) => candidate.unitId === unitId)) {
      throw new Error(`render model is missing correct unit ${unitId}`);
    }
    return { kind: 'tap-unit', unitId, slotIndex: index };
  });
}

/**
 * @param {string} unitId
 * @param {number} [slotIndex]
 * @returns {import('../../src/core/contracts.js').InputEvent}
 */
export function tap(unitId, slotIndex = 0) {
  return { kind: 'tap-unit', unitId, slotIndex };
}

/**
 * @param {string} text
 * @returns {import('../../src/core/contracts.js').InputEvent}
 */
export function keyText(text) {
  return { kind: 'key-text', text };
}

/**
 * @param {{
 *   typeId: 'T-SEQUENCE'|'T-FILL'|'T-TYPE',
 *   spec: import('../../src/core/contracts.js').QuestionSpec,
 *   renderModel: import('../../src/core/contracts.js').RenderModel,
 *   word: {id: string, text: string, units: {text: string, graphemeId: string}[]}
 * }} input
 * @returns {import('../../src/core/contracts.js').InputEvent[]}
 */
export function correctEvents({ typeId, spec, renderModel, word }) {
  if (typeId === 'T-SEQUENCE') return correctSequenceEvents(word, renderModel);
  if (typeId === 'T-FILL') {
    const blankIndex = Number(spec.params.blankUnitIndex);
    return [tap(wordUnitId(word, blankIndex), blankIndex)];
  }
  return [keyText(word.text)];
}

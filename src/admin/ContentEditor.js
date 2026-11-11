/**
 * @layer admin
 * @phase P7
 * @doc §2.3 内容后台
 *
 * 单词/unit 编辑的纯函数；不自动推断 grapheme，不做持久化。
 */

import { ContractError } from '../core/errors.js';

/** @param {any} value */
export function cloneContent(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {{words: {items: any[]}}} content
 * @param {string} text
 * @returns {string}
 */
export function nextWordId(content, text) {
  const base = `w.${String(text).toLowerCase().replace(/[^a-z]/g, '') || 'word'}`;
  const ids = new Set((content.words?.items ?? []).map((item) => item.id));
  if (!ids.has(base)) return base;
  let index = 2;
  while (ids.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

/**
 * @param {{words: {items: any[]}}} content
 * @param {any} word
 */
export function addWord(content, word) {
  if (!word || typeof word.id !== 'string' || typeof word.text !== 'string') {
    throw new ContractError('CONTENT_EDIT_INVALID', 'word needs id + text');
  }
  if ((content.words.items ?? []).some((item) => item.id === word.id)) {
    throw new ContractError('CONTENT_EDIT_DUPLICATE', `duplicate word id ${word.id}`);
  }
  content.words.items.push(word);
  return word;
}

/**
 * @param {{words: {items: any[]}}} content
 * @param {string} wordId
 * @param {Partial<any>} patch
 */
export function updateWord(content, wordId, patch) {
  const word = content.words.items.find((item) => item.id === wordId);
  if (!word) throw new ContractError('CONTENT_EDIT_MISSING', `missing word ${wordId}`);
  Object.assign(word, patch);
  return word;
}

/**
 * @param {any} word
 * @param {{text: string, graphemeId: string}} unit
 */
export function addUnit(word, unit) {
  if (!unit || typeof unit.text !== 'string' || typeof unit.graphemeId !== 'string') {
    throw new ContractError('CONTENT_EDIT_INVALID', 'unit needs text + graphemeId');
  }
  word.units = [...(word.units ?? []), { text: unit.text, graphemeId: unit.graphemeId }];
  return word;
}

/**
 * @param {any} word
 * @param {number} index
 * @param {{text?: string, graphemeId?: string}} patch
 */
export function updateUnit(word, index, patch) {
  if (!Array.isArray(word.units) || !word.units[index]) {
    throw new ContractError('CONTENT_EDIT_MISSING', `missing unit ${index}`);
  }
  Object.assign(word.units[index], patch);
  return word;
}

/**
 * @param {any} word
 * @param {number} index
 */
export function removeUnit(word, index) {
  if (!Array.isArray(word.units) || !word.units[index]) {
    throw new ContractError('CONTENT_EDIT_MISSING', `missing unit ${index}`);
  }
  word.units.splice(index, 1);
  return word;
}

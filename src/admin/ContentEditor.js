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

/**
 * 用逗号切分 token 写入 units；token 必须已有 grapheme。
 * @param {any} word
 * @param {string[]} tokens
 * @param {Record<string, string>} graphemeByText
 */
export function applySegments(word, tokens, graphemeByText) {
  const clean = tokens.map((token) => String(token).trim().toLowerCase()).filter(Boolean);
  if (clean.length === 0) throw new ContractError('CONTENT_EDIT_INVALID', 'segmentation is empty');
  const units = clean.map((text) => {
    if (!/^[a-z]+$/.test(text)) throw new ContractError('CONTENT_EDIT_INVALID', `invalid unit ${text}`);
    const graphemeId = graphemeByText[text];
    if (!graphemeId) throw new ContractError('CONTENT_EDIT_INVALID', `no grapheme for ${text}`);
    return { text, graphemeId };
  });
  word.units = units;
  return word;
}

/**
 * 删除单词（不删除内容库中的其他引用；校验会提示悬空句子）。
 * @param {{words: {items: any[]}}} content
 * @param {string} wordId
 */
export function deleteWord(content, wordId) {
  const index = content.words.items.findIndex((item) => item.id === wordId);
  if (index < 0) throw new ContractError('CONTENT_EDIT_MISSING', `missing word ${wordId}`);
  const [removed] = content.words.items.splice(index, 1);
  return removed;
}

/**
 * 批量导入时处理同文本词：
 * - merge：保留已有 ID/units/reviewStatus，只补空的中文/音标；无 units 时补切分；
 * - replace：保留 ID，覆盖 units/中文/音标，并将 reviewStatus 标记为 unreviewed；
 * - skip：不修改。
 * @param {{words: {items: any[]}}} content
 * @param {{text: string, units: any[], translation?: string, phonetic?: string}} entry
 * @param {'merge'|'replace'|'skip'} mode
 * @returns {'created'|'merged'|'replaced'|'skipped'}
 */
export function importWord(content, entry, mode = 'merge') {
  const existing = content.words.items.find((item) => item.text === entry.text);
  if (!existing) {
    addWord(content, {
      id: nextWordId(content, entry.text),
      text: entry.text,
      units: entry.units,
      translation: entry.translation ?? '',
      phonetic: entry.phonetic ?? '',
      level: entry.level ?? 1,
      unitId: entry.unitId ?? 'u1-1',
      unitLabel: entry.unitLabel ?? '一年级下学期 · 第1单元',
      reviewStatus: 'unreviewed',
    });
    return 'created';
  }
  if (mode === 'skip') return 'skipped';
  if (mode === 'replace') {
    existing.units = entry.units;
    existing.translation = entry.translation ?? '';
    existing.phonetic = entry.phonetic ?? '';
    existing.reviewStatus = 'unreviewed';
    return 'replaced';
  }
  if (!Array.isArray(existing.units) || existing.units.length === 0) {
    existing.units = entry.units;
  }
  if (!existing.translation && entry.translation) existing.translation = entry.translation;
  if (!existing.phonetic && entry.phonetic) existing.phonetic = entry.phonetic;
  return 'merged';
}

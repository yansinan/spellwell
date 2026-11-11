/**
 * @layer admin
 * @phase P7
 * @doc §2.3 内容后台 / CONTENT_SPEC §6
 *
 * ContentValidator V1—V10：只读校验 4 个内容库。
 * 不读写学习状态，不做自动 grapheme 推断。
 */

import { ContractError } from '../core/errors.js';

const REVIEW_STATUSES = new Set(['unreviewed', 'reviewed', 'retired']);
const PREFIX = Object.freeze({ words: 'w.', graphemes: 'g.', sentences: 's.', confusables: 'c.' });
const STORES = Object.freeze(['words', 'graphemes', 'sentences', 'confusables']);

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {string} code
 * @param {string} path
 * @param {string} message
 * @returns {{code: string, path: string, message: string}}
 */
function error(code, path, message) {
  return { code, path, message };
}

/**
 * @param {{
 *   words: {version: number, items: any[]},
 *   graphemes: {version: number, items: any[]},
 *   sentences: {version: number, items: any[]},
 *   confusables: {version: number, items: any[]}
 * }} content
 * @returns {{valid: boolean, errors: {code: string, path: string, message: string}[], counts: Record<string, number>}}
 */
export function validateContent(content) {
  const errors = [];
  const counts = {};
  if (!isObject(content)) {
    return { valid: false, errors: [error('CONTENT_TOP_INVALID', '$', 'content must be an object')], counts };
  }

  for (const store of STORES) {
    const doc = content[store];
    if (!isObject(doc) || !Number.isInteger(doc.version) || doc.version < 1 || !Array.isArray(doc.items)) {
      errors.push(error('CONTENT_TOP_INVALID', store, `${store} needs version + items[]`));
      counts[store] = 0;
      continue;
    }
    counts[store] = doc.items.length;
    const ids = new Set();
    for (const [index, item] of doc.items.entries()) {
      const path = `${store}[${index}]`;
      if (!isObject(item)) {
        errors.push(error('CONTENT_ITEM_INVALID', path, 'item must be an object'));
        continue;
      }
      if (typeof item.id !== 'string' || !item.id.startsWith(PREFIX[store])) {
        errors.push(error('CONTENT_ID_INVALID', `${path}.id`, `id must start with ${PREFIX[store]}`));
      } else if (ids.has(item.id)) {
        errors.push(error('CONTENT_ID_DUPLICATE', `${path}.id`, `duplicate id ${item.id}`));
      } else {
        ids.add(item.id);
      }
      if (!REVIEW_STATUSES.has(item.reviewStatus)) {
        errors.push(error('CONTENT_REVIEW_STATUS_INVALID', `${path}.reviewStatus`, 'invalid reviewStatus'));
      }
    }
  }

  const graphemeMap = new Map(
    Array.isArray(content.graphemes?.items)
      ? content.graphemes.items.filter(isObject).map((item) => [item.id, item])
      : [],
  );
  const wordMap = new Map(
    Array.isArray(content.words?.items)
      ? content.words.items.filter(isObject).map((item) => [item.id, item])
      : [],
  );

  for (const [index, word] of (content.words?.items ?? []).entries()) {
    if (!isObject(word)) continue;
    const path = `words[${index}]`;
    if (typeof word.text !== 'string' || !/^[a-z]+$/.test(word.text)) {
      errors.push(error('WORD_TEXT_INVALID', `${path}.text`, 'word text must be lowercase ASCII'));
      continue;
    }
    if (![1, 2, 3, 4, 5, 6].includes(word.grade) || !['上', '下'].includes(word.term) || !Number.isInteger(word.unit) || word.unit < 1) {
      errors.push(error('WORD_SCOPE_INVALID', `${path}.grade/term/unit`, 'word needs grade 1—6, term 上/下, unit >= 1'));
    }
    if (!Array.isArray(word.units) || word.units.length === 0) {
      errors.push(error('WORD_UNITS_INVALID', `${path}.units`, 'word needs manually annotated units'));
      continue;
    }
    let joined = '';
    for (const [unitIndex, unit] of word.units.entries()) {
      if (!isObject(unit) || typeof unit.text !== 'string' || typeof unit.graphemeId !== 'string') {
        errors.push(error('WORD_UNITS_INVALID', `${path}.units[${unitIndex}]`, 'unit needs text + graphemeId'));
        continue;
      }
      joined += unit.text;
      const grapheme = graphemeMap.get(unit.graphemeId);
      if (!grapheme) {
        errors.push(error('GRAPHEME_MISSING', `${path}.units[${unitIndex}].graphemeId`, `missing ${unit.graphemeId}`));
      } else if (grapheme.text !== unit.text) {
        errors.push(error('GRAPHEME_TEXT_MISMATCH', `${path}.units[${unitIndex}].text`, 'unit text != grapheme text'));
      }
    }
    if (joined !== word.text) {
      errors.push(error('WORD_UNITS_MISMATCH', `${path}.units`, `units join to ${joined}, expected ${word.text}`));
    }
  }

  for (const [index, sentence] of (content.sentences?.items ?? []).entries()) {
    if (!isObject(sentence)) continue;
    const path = `sentences[${index}]`;
    const word = wordMap.get(sentence.wordId);
    if (!word) {
      errors.push(error('SENTENCE_WORD_MISSING', `${path}.wordId`, `unknown word ${String(sentence.wordId)}`));
    }
    if (typeof sentence.text !== 'string' || typeof sentence.answer !== 'string'
      || sentence.blank !== sentence.answer || sentence.answer !== word?.text) {
      errors.push(error('SENTENCE_BLANK_INVALID', path, 'blank/answer must equal the target word'));
    } else {
      const occurrences = sentence.text.split(sentence.answer).length - 1;
      if (occurrences !== 1) {
        errors.push(error('SENTENCE_BLANK_COUNT', `${path}.text`, `answer must occur exactly once, got ${occurrences}`));
      }
    }
  }

  const seenPairs = new Set();
  for (const [index, confusable] of (content.confusables?.items ?? []).entries()) {
    if (!isObject(confusable)) continue;
    const path = `confusables[${index}]`;
    if (!graphemeMap.has(confusable.a) || !graphemeMap.has(confusable.b) || confusable.a === confusable.b) {
      errors.push(error('CONFUSABLE_REFERENCE_INVALID', path, 'a/b must be two different existing graphemes'));
      continue;
    }
    const pair = [confusable.a, confusable.b].sort().join('|');
    if (seenPairs.has(pair)) {
      errors.push(error('CONFUSABLE_DUPLICATE_PAIR', path, 'unordered pair must be unique'));
    } else {
      seenPairs.add(pair);
    }
  }

  return { valid: errors.length === 0, errors, counts };
}

/**
 * 生产导出：先跑 V1—V9，再执行 V10（只导出 reviewed）。
 * @param {Parameters<typeof validateContent>[0]} content
 * @returns {{version: number, exportedAt: string, counts: Record<string, number>, stores: Record<string, any[]>}}
 */
export function buildExport(content) {
  const report = validateContent(content);
  if (!report.valid) {
    throw new ContractError('CONTENT_EXPORT_BLOCKED', 'content validation failed', { errors: report.errors });
  }

  const unreviewed = [];
  const stores = {};
  for (const store of STORES) {
    stores[store] = content[store].items.filter((item) => item.reviewStatus === 'reviewed');
    for (const item of content[store].items) {
      if (item.reviewStatus !== 'reviewed') {
        unreviewed.push({ store, id: item.id, reviewStatus: item.reviewStatus });
      }
    }
  }
  if (unreviewed.length > 0) {
    throw new ContractError('CONTENT_EXPORT_UNREVIEWED', 'only reviewed content can be exported', {
      unreviewed,
      errors: unreviewed.map((item) => ({
        code: 'CONTENT_EXPORT_UNREVIEWED',
        path: `${item.store}.${item.id}.reviewStatus`,
        message: `${item.id} is ${item.reviewStatus}`,
      })),
    });
  }

  return {
    version: Math.max(...STORES.map((store) => content[store].version)),
    exportedAt: new Date().toISOString(),
    counts: Object.fromEntries(STORES.map((store) => [store, stores[store].length])),
    stores,
  };
}

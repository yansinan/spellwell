/**
 * @layer admin
 * @phase P7
 * @doc §2.3 内容后台
 *
 * 批量单词输入、显式逗号切分、自动切分建议。
 * 自动切分只生成草稿 units，保存前仍由后台校验/人工确认。
 */

import { ContractError } from '../core/errors.js';

const END_SUFFIXES = new Set([
  'ing', 'ed', 'es', 'ly', 'est', 'tion', 'sion', 'ment', 'ness', 'ful', 'less',
  'ture', 'sure', 'able', 'ible', 'ance', 'ence', 'ous', 'ious',
  'ble', 'cle', 'dle', 'fle', 'gle', 'kle', 'ple', 'tle', 'zle', 'all',
]);
const SUFFIX_MIN_LENGTH = Object.freeze({ ed: 5, es: 5, ly: 4, est: 6, all: 4 });

/** 人工确认过的异常切分；按 token 写入，最后仍校验 join === text。 */
export const SEGMENTATION_OVERRIDES = Object.freeze({
  different: ['d', 'i', 'ff', 'er', 'e', 'n', 't'],
  interesting: ['i', 'n', 't', 'er', 'e', 'st', 'ing'],
  favourite: ['f', 'a', 'v', 'ou', 'r', 'i', 't', 'e'],
  classroom: ['cl', 'a', 'ss', 'r', 'oo', 'm'],
  blackboard: ['bl', 'a', 'ck', 'b', 'oar', 'd'],
  basketball: ['b', 'a', 's', 'k', 'e', 't', 'b', 'all'],
  grandpa: ['gr', 'a', 'n', 'd', 'p', 'a'],
  grandma: ['gr', 'a', 'n', 'd', 'm', 'a'],
  thing: ['th', 'i', 'ng'],
  sing: ['s', 'i', 'ng'],
  king: ['k', 'i', 'ng'],
  ring: ['r', 'i', 'ng'],
  bring: ['br', 'i', 'ng'],
  spring: ['spr', 'i', 'ng'],
  string: ['str', 'i', 'ng'],
  swing: ['sw', 'i', 'ng'],
  wing: ['w', 'i', 'ng'],
  yes: ['y', 'e', 's'],
  bed: ['b', 'e', 'd'],
  red: ['r', 'e', 'd'],
  rest: ['r', 'e', 'st'],
  best: ['b', 'e', 'st'],
  test: ['t', 'e', 'st'],
  forest: ['f', 'or', 'e', 'st'],
  table: ['t', 'a', 'ble'],
  timetable: ['t', 'i', 'm', 'e', 't', 'a', 'ble'],
  transportation: ['tr', 'a', 'n', 's', 'p', 'or', 't', 'a', 'tion'],
});

function isEndSuffixAllowed(candidate, index, text) {
  if (!END_SUFFIXES.has(candidate)) return true;
  if (index + candidate.length !== text.length) return false;
  const min = SUFFIX_MIN_LENGTH[candidate] ?? 1;
  return text.length >= min;
}



/**
 * 最长匹配优先的自动切分。graphemeByText 由内容库构建。
 * @param {string} word
 * @param {Record<string, string>} graphemeByText text -> graphemeId
 * @returns {{text: string, graphemeId: string}[]}
 */
export function autoSegment(word, graphemeByText) {
  const text = String(word ?? '').trim().toLowerCase();
  if (!/^[a-z]+$/.test(text)) {
    throw new ContractError('WORD_IMPORT_INVALID', `word must be lowercase ASCII: ${text}`);
  }
  const override = SEGMENTATION_OVERRIDES[text];
  if (override) {
    const tokens = override.map((token) => ({ text: token, graphemeId: graphemeByText[token] }));
    if (tokens.every((token) => token.graphemeId) && tokens.map((token) => token.text).join('') === text) {
      return tokens;
    }
  }

  const units = [];
  let index = 0;
  while (index < text.length) {
    let matched = null;
    for (let length = Math.min(6, text.length - index); length >= 1; length -= 1) {
      const candidate = text.slice(index, index + length);
      const id = graphemeByText[candidate];
      if (!id || !isEndSuffixAllowed(candidate, index, text)) continue;
      matched = { text: candidate, graphemeId: id };
      break;
    }
    if (!matched) {
      throw new ContractError('WORD_IMPORT_INVALID', `no grapheme for "${text[index]}"`);
    }
    units.push(matched);
    index += matched.text.length;
  }
  return units;
}


/**
 * 单元标题行：
 *   一年级上unit2
 *   二年级下 unit 5
 *   一年级下第2单元
 * @param {string} line
 * @returns {{grade: number, term: '上'|'下', unit: number, unitId: string, unitLabel: string}|null}
 */
export function parseUnitHeader(line) {
  const raw = String(line ?? '').trim();
  if (!raw) return null;
  const match = raw.match(/^([一二1-2])年级\s*([上下])\s*(?:unit|单元|第)?\s*(\d+)\s*(?:单元)?$/i);
  if (!match) return null;
  const grade = match[1] === '二' || match[1] === '2' ? 2 : 1;
  const term = match[2];
  const unit = Number(match[3]);
  if (!Number.isInteger(unit) || unit < 1 || unit > 20) {
    throw new ContractError('WORD_IMPORT_INVALID', `invalid unit number: ${match[3]}`);
  }
  return {
    grade,
    term,
    unit,
    unitId: `g${grade}-s${term === '下' ? '2' : '1'}-u${unit}`,
    unitLabel: `${grade === 1 ? '一' : '二'}年级${term} · 第${unit}单元`,
  };
}

/**
 * 解析一行：
 *   w,ea,th,er | 天气 | /ˈweðər/
 *   weather | 天气 | /ˈweðər/
 *   weather
 * @param {string} line
 * @param {Record<string, string>} graphemeByText
 * @returns {{text: string, units: {text: string, graphemeId: string}[], translation: string, phonetic: string, explicit: boolean}|null}
 */
export function parseWordLine(line, graphemeByText) {
  const raw = String(line ?? '').trim();
  if (!raw || raw.startsWith('#')) return null;
  const [head, translation = '', phonetic = ''] = raw.split('|').map((part) => part.trim());
  if (!head) return null;

  if (head.includes(',')) {
    const tokens = head.split(',').map((token) => token.trim().toLowerCase()).filter(Boolean);
    if (tokens.length === 0) throw new ContractError('WORD_IMPORT_INVALID', 'empty segmentation');
    for (const token of tokens) {
      if (!/^[a-z]+$/.test(token)) {
        throw new ContractError('WORD_IMPORT_INVALID', `invalid unit "${token}"`);
      }
      if (!graphemeByText[token]) {
        throw new ContractError('WORD_IMPORT_INVALID', `no grapheme "${token}"`);
      }
    }
    const text = tokens.join('');
    return {
      text,
      units: tokens.map((token) => ({ text: token, graphemeId: graphemeByText[token] })),
      translation,
      phonetic,
      explicit: true,
    };
  }

  const text = head.toLowerCase();
  return {
    text,
    units: autoSegment(text, graphemeByText),
    translation,
    phonetic,
    explicit: false,
  };
}

/**
 * @param {string} input
 * @param {Record<string, string>} graphemeByText
 * @returns {{entries: ReturnType<typeof parseWordLine>[], errors: {line: number, message: string}[]}}
 */
export function parseBatch(input, graphemeByText) {
  const entries = [];
  const errors = [];
  let currentUnit = null;
  for (const [index, line] of String(input ?? '').split(/\r?\n/).entries()) {
    try {
      const unit = parseUnitHeader(line);
      if (unit) {
        currentUnit = unit;
        continue;
      }
      const entry = parseWordLine(line, graphemeByText);
      if (entry) entries.push(currentUnit ? { ...entry, ...currentUnit } : entry);
    } catch (error) {
      errors.push({ line: index + 1, message: error.message });
    }
  }
  return { entries, errors };
}

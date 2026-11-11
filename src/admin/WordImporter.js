/**
 * @layer admin
 * @phase P7
 * @doc §2.3 内容后台
 *
 * 批量单词输入、显式逗号切分、自动切分建议。
 * 自动切分只生成草稿 units，保存前仍由后台校验/人工确认。
 */

import { ContractError } from '../core/errors.js';

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
  const units = [];
  let index = 0;
  while (index < text.length) {
    let matched = null;
    for (let length = Math.min(6, text.length - index); length >= 1; length -= 1) {
      const candidate = text.slice(index, index + length);
      const id = graphemeByText[candidate];
      if (id) {
        matched = { text: candidate, graphemeId: id };
        break;
      }
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
  for (const [index, line] of String(input ?? '').split(/\r?\n/).entries()) {
    try {
      const entry = parseWordLine(line, graphemeByText);
      if (entry) entries.push(entry);
    } catch (error) {
      errors.push({ line: index + 1, message: error.message });
    }
  }
  return { entries, errors };
}

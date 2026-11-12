/**
 * @layer admin
 * @phase P9
 * @doc §2.3 内容后台
 *
 * 词库单独导入/导出：只含 words，不含学习状态。
 * 重复词按 merge / replace / skip 处理。
 */

import { importWord, nextWordId } from './ContentEditor.js';
import { textbookLabel as labelFor } from '../storage/textbooks.js';

export const WORD_LIBRARY_SCHEMA = 'spellwell.words.v1';

/**
 * @param {Record<string, any>[]} words
 * @param {{exportedAt?: string}} [options]
 */
export function buildWordLibrary(words, { exportedAt } = {}) {
  return {
    schema: WORD_LIBRARY_SCHEMA,
    version: 1,
    exportedAt: exportedAt ?? new Date().toISOString(),
    items: Array.isArray(words) ? words.map((word) => ({ ...word })) : [],
  };
}

/**
 * @param {string|Record<string, any>|Record<string, any>[]} input
 * @returns {{items: Record<string, any>[], errors: string[]}}
 */
export function parseWordLibrary(input) {
  let data = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch {
      return { items: [], errors: ['文件不是合法 JSON'] };
    }
  }
  const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : null;
  if (!items) return { items: [], errors: ['词库文件需要 items 数组'] };
  const errors = [];
  const valid = [];
  for (const [index, item] of items.entries()) {
    if (!item || typeof item !== 'object' || typeof item.text !== 'string' || !/^[a-z]+$/.test(item.text)) {
      errors.push(`第 ${index + 1} 个词缺少合法 text`);
      continue;
    }
    if (!Array.isArray(item.units) || item.units.length === 0) {
      errors.push(`第 ${index + 1} 个词缺少 units`);
      continue;
    }
    valid.push(item);
  }
  return { items: valid, errors };
}

/**
 * 导入词库到内容草稿；重复词按 mode 合并/替换/跳过。
 * @param {{words: {items: Record<string, any>[]}}} content
 * @param {Record<string, any>[]} items
 * @param {'merge'|'replace'|'skip'} mode
 * @returns {{created: number, merged: number, replaced: number, skipped: number, errors: {text: string, message: string}[]}}
 */
export function applyWordLibrary(content, items, mode = 'merge', textbook = 'pep-2026') {
  const counts = { created: 0, merged: 0, replaced: 0, skipped: 0, errors: [] };
  for (const item of Array.isArray(items) ? items : []) {
    try {
      const text = String(item.text ?? '').trim().toLowerCase();
      const existing = content.words.items.find(
        (word) => word.text === text && (word.textbook ?? 'pep-2026') === textbook,
      );
      const id = item.id && !content.words.items.some((word) => word.id === item.id)
        ? item.id
        : existing?.id ?? nextWordId(content, text);
      const result = importWord(content, {
        ...item,
        id,
        text,
        grade: Number(item.grade ?? 1),
        term: item.term === '上' ? '上' : '下',
        unit: Number(item.unit ?? 1),
        unitId: item.unitId ?? `g${Number(item.grade ?? 1)}-s${item.term === '上' ? '1' : '2'}-u${Number(item.unit ?? 1)}`,
        unitLabel: item.unitLabel ?? `${['一', '二', '三', '四', '五', '六'][Math.max(0, Math.min(5, Number(item.grade ?? 1) - 1))]}年级${item.term === '上' ? '上' : '下'} · 第${Number(item.unit ?? 1)}单元`,
        textbook,
        textbookLabel: labelFor(textbook),
      }, mode);
      counts[result] += 1;
    } catch (error) {
      counts.errors.push({ text: String(item?.text ?? ''), message: String(error.message ?? error) });
    }
  }
  return counts;
}

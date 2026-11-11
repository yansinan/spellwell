/**
 * @layer storage
 * @phase P9
 * @doc §2.3 内容后台
 *
 * 教材版本注册表；meta.activeTextbook 指定当前学习/后台使用的版本。
 */

export const TEXTBOOKS = Object.freeze([
  { id: 'pep-2026', label: '人教版新起点（2026）' },
  { id: 'fltrp-2026', label: '外研版新交际（北京专版）' },
]);

export const DEFAULT_TEXTBOOK = 'pep-2026';
export const ACTIVE_TEXTBOOK_KEY = 'activeTextbook';

/** @param {unknown} value */
export function normalizeTextbook(value) {
  return TEXTBOOKS.some((book) => book.id === value) ? value : DEFAULT_TEXTBOOK;
}

/** @param {import('./StorageAdapter.js').StorageAdapter} adapter */
export async function readActiveTextbook(adapter) {
  const record = await adapter.get('meta', ACTIVE_TEXTBOOK_KEY);
  return normalizeTextbook(record?.value);
}

/**
 * @param {import('./StorageAdapter.js').StorageAdapter} adapter
 * @param {string} textbook
 */
export async function saveActiveTextbook(adapter, textbook) {
  const normalized = normalizeTextbook(textbook);
  await adapter.put('meta', { key: ACTIVE_TEXTBOOK_KEY, value: normalized });
  return normalized;
}

/** @param {string} textbook */
export function textbookLabel(textbook) {
  return TEXTBOOKS.find((book) => book.id === textbook)?.label ?? textbook;
}

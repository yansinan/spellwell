/**
 * @layer scheduler
 * @phase P9
 * @doc §3.4 9 个题型注册表
 *
 * 从真实 attempts 的 firstError 学习历史混淆项。
 * 只读聚合，不写状态，不参与 judge。
 */

/**
 * @typedef {{actual: string, count: number, lastAt: number}} HistoryActual
 */

/**
 * @param {Record<string, any>[]} attempts
 * @returns {{
 *   byWord: Map<string, Map<string, {actual: string, count: number, lastAt: number}>>,
 *   byExpected: Map<string, Map<string, {actual: string, count: number, lastAt: number}>>,
 *   byWordExpected: Map<string, Map<string, Map<string, {actual: string, count: number, lastAt: number, unitId: string}>>>
 * }}
 */
export function buildErrorHistory(attempts) {
  const byWord = new Map();
  const byExpected = new Map();
  const byWordExpected = new Map();
  const bump = (bucket, actual, at) => {
    const existing = bucket.get(actual);
    if (existing) {
      existing.count += 1;
      existing.lastAt = Math.max(existing.lastAt, at);
      return;
    }
    bucket.set(actual, { actual, count: 1, lastAt: at });
  };
  const ensureWord = (wordId) => {
    const bucket = byWord.get(wordId) ?? new Map();
    byWord.set(wordId, bucket);
    return bucket;
  };
  const ensureExpected = (expected) => {
    const bucket = byExpected.get(expected) ?? new Map();
    byExpected.set(expected, bucket);
    return bucket;
  };
  const ensureWordExpected = (wordId, expected) => {
    const wordBucket = byWordExpected.get(wordId) ?? new Map();
    const bucket = wordBucket.get(expected) ?? new Map();
    wordBucket.set(expected, bucket);
    byWordExpected.set(wordId, wordBucket);
    return bucket;
  };

  for (const [index, attempt] of (Array.isArray(attempts) ? attempts : []).entries()) {
    const error = attempt?.firstError;
    if (!error || typeof error.actual !== 'string' || error.actual.length === 0) continue;
    if (typeof error.expected !== 'string' || error.expected.length === 0) continue;
    const at = Date.parse(attempt.timestamp ?? '') || index;
    const wordId = String(attempt.wordId ?? '');
    if (wordId) {
      bump(ensureWord(wordId), error.actual, at);
      const detail = ensureWordExpected(wordId, error.expected);
      const existing = detail.get(error.actual);
      if (existing) {
        existing.count += 1;
        existing.lastAt = Math.max(existing.lastAt, at);
        existing.unitId = String(error.unitId ?? existing.unitId ?? '');
      } else {
        detail.set(error.actual, {
          actual: error.actual,
          count: 1,
          lastAt: at,
          unitId: String(error.unitId ?? ''),
        });
      }
    }
    bump(ensureExpected(error.expected), error.actual, at);
  }
  return { byWord, byExpected, byWordExpected };
}

/**
 * 某词/某目标组合的历史错误，按次数和最近时间排序。
 * @param {{byWord: Map<string, Map<string, HistoryActual[]>>, byExpected: Map<string, Map<string, HistoryActual[]>>}|undefined} history
 * @param {{wordId?: string, expected?: string, unitId?: string}} key
 * @param {number} [limit]
 * @returns {string[]}
 */
export function historicalActuals(history, { wordId = '', expected = '' }, limit = 2) {
  if (!history) return [];
  const sortItems = (items) => items
    .sort((a, b) => (b.count - a.count) || (b.lastAt - a.lastAt) || a.actual.localeCompare(b.actual))
    .map((item) => item.actual);
  const result = [];
  const seen = new Set();
  const add = (items) => {
    for (const actual of sortItems(items)) {
      if (seen.has(actual)) continue;
      seen.add(actual);
      result.push(actual);
      if (result.length >= limit) return;
    }
  };
  if (wordId) {
    const wordBucket = history.byWord.get(String(wordId));
    if (wordBucket) add([...wordBucket.values()]);
  }
  if (result.length < limit && expected) {
    const expectedBucket = history.byExpected.get(String(expected));
    if (expectedBucket) add([...expectedBucket.values()]);
  }
  return result.slice(0, limit);
}

/**
 * 某词自己的历史错误明细：保留 expected/unitId，供判断题回放。
 * @param {{byWordExpected?: Map<string, Map<string, Map<string, {actual: string, count: number, lastAt: number, unitId: string}>>>}|undefined} history
 * @param {string} wordId
 * @returns {{expected: string, actual: string, unitId: string, count: number, lastAt: number}[]}
 */
export function historicalErrorsForWord(history, wordId) {
  const byExpected = history?.byWordExpected?.get(String(wordId));
  if (!byExpected) return [];
  const result = [];
  for (const [expected, bucket] of byExpected) {
    for (const item of bucket.values()) {
      result.push({ expected, ...item });
    }
  }
  return result.sort((a, b) => (b.count - a.count)
    || (b.lastAt - a.lastAt)
    || a.actual.localeCompare(b.actual));
}

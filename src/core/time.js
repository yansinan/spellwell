/**
 * @layer core
 * @phase P0
 * @doc §1.3 记忆曲线是调度器，不是装饰
 *
 * 统一使用“本地日历日” `YYYY-MM-DD`，避免 UTC 与本地时区跨日。
 */

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {Date} [date]
 * @returns {string} YYYY-MM-DD（本地时区）
 */
export function toDayKey(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError('toDayKey expects a valid Date');
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * @param {string} dayKey
 * @returns {Date} 本地时间正午，避免 DST 边界把日期推前一天
 */
export function fromDayKey(dayKey) {
  if (typeof dayKey !== 'string' || !DAY_KEY_PATTERN.test(dayKey)) {
    throw new TypeError(`invalid dayKey: ${String(dayKey)}`);
  }
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  if (toDayKey(date) !== dayKey) {
    throw new TypeError(`invalid calendar date: ${dayKey}`);
  }
  return date;
}

/**
 * @param {string} dayKey
 * @param {number} days 可为负
 * @returns {string}
 */
export function addDays(dayKey, days) {
  if (!Number.isInteger(days)) {
    throw new TypeError('addDays expects an integer day count');
  }
  const date = fromDayKey(dayKey);
  date.setDate(date.getDate() + days);
  return toDayKey(date);
}

/**
 * @returns {string} 今天的本地日历日
 */
export function todayKey() {
  return toDayKey(new Date());
}

/**
 * dueDate 为 null 表示“未排期”，不算到期。
 * @param {string|null|undefined} dueDate
 * @param {string} [today]
 * @returns {boolean}
 */
export function isDue(dueDate, today = todayKey()) {
  if (typeof dueDate !== 'string' || !DAY_KEY_PATTERN.test(dueDate)) return false;
  return dueDate <= today;
}

/**
 * @param {string} dayKey
 * @returns {boolean}
 */
export function isDayKey(dayKey) {
  return typeof dayKey === 'string' && DAY_KEY_PATTERN.test(dayKey);
}

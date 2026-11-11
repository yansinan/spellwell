/**
 * @layer scheduler
 * @phase P0
 * @doc §1.3 记忆曲线是调度器，不是装饰
 *
 * 间隔阶梯与升降档规则。纯函数，不读时钟、不写库。
 */

import { validateWordState } from '../core/contracts.js';
import { addDays, toDayKey } from '../core/time.js';

export const REVIEW_INTERVALS_DAYS = Object.freeze([1, 3, 7, 14, 30]);
export const MAX_INTERVAL_INDEX = REVIEW_INTERVALS_DAYS.length - 1;

/** 组合进入待抽查池的条件（P5 使用）。 */
export const PROBE_STREAK = 3;
export const PROBE_DISTINCT_WORDS = 2;
export const PROBE_INTERVAL_DAYS = 60;

/**
 * @typedef {Object} ReviewSnapshot
 * @property {number} intervalIndex
 * @property {number} consecutiveCorrect
 * @property {'correct'|'wrong'|null} lastResult
 */

/**
 * 答对升一档；答错降两档（不小于 0）；若上一次也是错，则归零。
 * @param {ReviewSnapshot} state
 * @param {boolean} correct
 * @returns {{intervalIndex: number, consecutiveCorrect: number, lastResult: 'correct'|'wrong'}}
 */
export function nextReview(state, correct) {
  if (!Number.isInteger(state.intervalIndex) || state.intervalIndex < 0) {
    throw new RangeError('intervalIndex must be a non-negative integer');
  }
  if (!Number.isInteger(state.consecutiveCorrect) || state.consecutiveCorrect < 0) {
    throw new RangeError('consecutiveCorrect must be a non-negative integer');
  }

  if (correct) {
    return {
      intervalIndex: Math.min(state.intervalIndex + 1, MAX_INTERVAL_INDEX),
      consecutiveCorrect: state.consecutiveCorrect + 1,
      lastResult: 'correct',
    };
  }

  const wasWrong = state.lastResult === 'wrong';
  return {
    intervalIndex: wasWrong ? 0 : Math.max(0, state.intervalIndex - 2),
    consecutiveCorrect: 0,
    lastResult: 'wrong',
  };
}

/**
 * @param {number} intervalIndex
 * @param {Date} [from]
 * @returns {string} YYYY-MM-DD
 */
export function dueDateFor(intervalIndex, from = new Date()) {
  if (!Number.isInteger(intervalIndex) || intervalIndex < 0 || intervalIndex > MAX_INTERVAL_INDEX) {
    throw new RangeError(`intervalIndex must be 0..${MAX_INTERVAL_INDEX}`);
  }
  return addDays(toDayKey(from), REVIEW_INTERVALS_DAYS[intervalIndex]);
}

/**
 * 把一次复习结果应用到单词状态，返回新对象（不修改入参）。
 * 只处理间隔字段；错误画像与状态迁移由调度器在 P3 组合。
 * @param {import('../core/contracts.js').WordState} state
 * @param {boolean} correct
 * @param {Date} [now]
 * @returns {import('../core/contracts.js').WordState}
 */
export function applyWordReview(state, correct, now = new Date()) {
  validateWordState(state);
  const next = nextReview(state, correct);
  const updated = {
    ...state,
    ...next,
    dueDate: dueDateFor(next.intervalIndex, now),
    updatedAt: now.toISOString(),
  };
  validateWordState(updated);
  return updated;
}

/**
 * 组合是否满足“跨词稳定”的候选条件。真正的 state 迁移在 P5。
 * @param {{consecutiveCorrect: number, wordsPassed: string[]}} state
 * @returns {boolean}
 */
export function isProbeEligible(state) {
  return state.consecutiveCorrect >= PROBE_STREAK
    && new Set(state.wordsPassed).size >= PROBE_DISTINCT_WORDS;
}

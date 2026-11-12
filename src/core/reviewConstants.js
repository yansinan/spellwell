/**
 * @layer core
 * @phase P0
 * @doc §1.3 记忆曲线是调度器，不是装饰
 *
 * 纯常量，供 scheduler 与 admin 受控状态服务共享。
 */

export const REVIEW_INTERVALS_DAYS = Object.freeze([1, 3, 7, 14, 30]);
export const MAX_INTERVAL_INDEX = REVIEW_INTERVALS_DAYS.length - 1;
export const PROBE_STREAK = 3;
export const PROBE_DISTINCT_WORDS = 2;
export const PROBE_INTERVAL_DAYS = 60;

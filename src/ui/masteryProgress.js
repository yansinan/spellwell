/**
 * @layer ui
 * @phase P9
 * @doc §2.1 孩子端（学习模块）
 *
 * 单元掌握进度：从 wordState 的记忆曲线 + 错题修正情况估算。
 * 只读，不写学习状态，不参与调度。
 */

import { MAX_INTERVAL_INDEX, PROBE_STREAK } from '../scheduler/IntervalPolicy.js';

/**
 * @param {Record<string, any>|undefined} state
 * @returns {number} 0—1
 */
export function wordProgress(state) {
  if (!state) return 0;
  if (state.status === 'mastered' && (state.errorProfile?.length ?? 0) === 0) return 1;
  const interval = Number(state.intervalIndex ?? 0);
  const memory = MAX_INTERVAL_INDEX > 0 ? Math.min(1, interval / MAX_INTERVAL_INDEX) : 0;
  const streak = Math.min(Number(state.consecutiveCorrect ?? 0), PROBE_STREAK) / PROBE_STREAK;
  const errors = Math.min(4, Number(state.errorProfile?.length ?? 0));
  const errorPenalty = (errors / 4) * 0.35;
  const wrongPenalty = state.lastResult === 'wrong' ? 0.1 : 0;
  const progress = memory * 0.55 + streak * 0.45 - errorPenalty - wrongPenalty;
  return Math.max(0, Math.min(1, Number(progress.toFixed(4))));
}

/**
 * @param {Record<string, any>[]} states
 * @param {{id: string}[]} words
 * @returns {{progress: number, percent: number, practiced: number, mastered: number}}
 */
export function unitProgress(states, words) {
  const byId = new Map((states ?? []).map((state) => [String(state.wordId), state]));
  let total = 0;
  let practiced = 0;
  let mastered = 0;
  for (const word of words ?? []) {
    const state = byId.get(String(word.id));
    if (state) practiced += 1;
    if (state?.status === 'mastered' && (state?.errorProfile?.length ?? 0) === 0) mastered += 1;
    total += wordProgress(state);
  }
  const progress = words?.length ? total / words.length : 0;
  return {
    progress: Number(progress.toFixed(4)),
    percent: Math.round(progress * 100),
    practiced,
    mastered,
  };
}

/**
 * @layer ui
 * @phase P9
 * @doc §2.1 孩子端（学习模块）
 *
 * 单元掌握进度：用真实 attempts 校准记忆曲线，而不是固定权重。
 * 只读，不写学习状态，不参与调度。
 */

import { MAX_INTERVAL_INDEX, PROBE_STREAK } from '../scheduler/IntervalPolicy.js';

/**
 * @param {Record<string, any>[]} attempts
 * @returns {{globalAccuracy: number, byWord: Map<string, {correct: number, wrong: number}>}}
 */
export function collectAttemptStats(attempts) {
  const byWord = new Map();
  let correct = 0;
  let total = 0;
  for (const attempt of Array.isArray(attempts) ? attempts : []) {
    const wordId = String(attempt.wordId ?? '');
    if (!wordId) continue;
    const bucket = byWord.get(wordId) ?? { correct: 0, wrong: 0 };
    if (attempt.wordCorrect) bucket.correct += 1;
    else bucket.wrong += 1;
    byWord.set(wordId, bucket);
    total += 1;
    if (attempt.wordCorrect) correct += 1;
  }
  return {
    globalAccuracy: total === 0 ? 0.5 : correct / total,
    byWord,
  };
}

/**
 * @param {Record<string, any>|undefined} state
 * @param {{correct: number, wrong: number}|undefined} stats
 * @param {number} priorAccuracy
 * @returns {number} 0—1
 */
export function wordProgress(state, stats, priorAccuracy = 0.5) {
  if (!state || state.status === 'unstarted') return 0;
  if (state.status === 'mastered' && (state.errorProfile?.length ?? 0) === 0) return 1;
  const interval = Number(state.intervalIndex ?? 0);
  const memory = MAX_INTERVAL_INDEX > 0 ? Math.min(1, interval / MAX_INTERVAL_INDEX) : 0;
  const streak = Math.min(Number(state.consecutiveCorrect ?? 0), PROBE_STREAK) / PROBE_STREAK;
  const errors = Math.min(4, Number(state.errorProfile?.length ?? 0));
  const errorPenalty = (errors / 4) * 0.35;
  const wrongPenalty = state.lastResult === 'wrong' ? 0.1 : 0;
  const model = Math.max(0, Math.min(1, memory * 0.55 + streak * 0.45 - errorPenalty - wrongPenalty));

  const observed = stats ? stats.correct + stats.wrong : 0;
  if (observed === 0) return Number(model.toFixed(4));

  // 真实答题准确率：小样本向全局准确率平滑；样本越多，权重越高。
  const empirical = (stats.correct + priorAccuracy * 4) / (observed + 4);
  const confidence = Math.min(1, observed / 8);
  const calibrated = model * (1 - 0.45 * confidence) + empirical * (0.45 * confidence);
  return Number(Math.max(0, Math.min(1, calibrated)).toFixed(4));
}

/**
 * @param {Record<string, any>[]} states
 * @param {{id: string}[]} words
 * @param {Record<string, any>[]} [attempts]
 * @returns {{progress: number, percent: number, practiced: number, mastered: number, sampleSize: number}}
 */
export function unitProgress(states, words, attempts = []) {
  const stats = collectAttemptStats(attempts);
  const byId = new Map((states ?? []).map((state) => [String(state.wordId), state]));
  let total = 0;
  let practiced = 0;
  let mastered = 0;
  let sampleSize = 0;
  for (const word of words ?? []) {
    const state = byId.get(String(word.id));
    const wordStats = stats.byWord.get(String(word.id));
    if (state && state.status !== 'unstarted') practiced += 1;
    if (state?.status === 'mastered' && (state?.errorProfile?.length ?? 0) === 0) mastered += 1;
    if (wordStats) sampleSize += wordStats.correct + wordStats.wrong;
    total += wordProgress(state, wordStats, stats.globalAccuracy);
  }
  const progress = words?.length ? total / words.length : 0;
  return {
    progress: Number(progress.toFixed(4)),
    percent: Math.round(progress * 100),
    practiced,
    mastered,
    sampleSize,
  };
}

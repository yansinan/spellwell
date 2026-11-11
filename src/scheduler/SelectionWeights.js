/**
 * @layer scheduler
 * @phase P9
 * @doc §3.5 难度与权重
 *
 * 用真实 attempts 校准选词权重：按词、按题型统计错误率，
 * 做小样本平滑；调度器只用权重排序，不写状态。
 */

export const PRIOR_ERROR_RATE = 0.35;
const PRIOR_ATTEMPTS = 2;

function smoothedRate(wrong, total) {
  return (wrong + PRIOR_ERROR_RATE * PRIOR_ATTEMPTS) / (total + PRIOR_ATTEMPTS);
}

/**
 * @param {Record<string, any>[]} attempts
 * @returns {{
 *   sampleSize: number,
 *   globalErrorRate: number,
 *   byWord: Record<string, {wrong: number, correct: number, errorRate: number}>,
 *   byType: Record<string, {wrong: number, correct: number, errorRate: number}>
 * }}
 */
export function calibrateWeights(attempts) {
  const byWord = {};
  const byType = {};
  let total = 0;
  let wrongTotal = 0;
  for (const attempt of Array.isArray(attempts) ? attempts : []) {
    const wordId = String(attempt.wordId ?? '');
    if (!wordId) continue;
    const typeId = String(attempt.typeId ?? 'unknown');
    const correct = Boolean(attempt.wordCorrect);
    total += 1;
    if (!correct) wrongTotal += 1;
    byWord[wordId] ??= { wrong: 0, correct: 0 };
    byType[typeId] ??= { wrong: 0, correct: 0 };
    if (correct) {
      byWord[wordId].correct += 1;
      byType[typeId].correct += 1;
    } else {
      byWord[wordId].wrong += 1;
      byType[typeId].wrong += 1;
    }
  }
  for (const stats of Object.values(byWord)) {
    stats.errorRate = smoothedRate(stats.wrong, stats.wrong + stats.correct);
  }
  for (const stats of Object.values(byType)) {
    stats.errorRate = smoothedRate(stats.wrong, stats.wrong + stats.correct);
  }
  return {
    sampleSize: total,
    globalErrorRate: total === 0 ? PRIOR_ERROR_RATE : wrongTotal / total,
    priorErrorRate: PRIOR_ERROR_RATE,
    byWord,
    byType,
  };
}

/**
 * 选词得分：约束由调用方保证；这里只做同层排序。
 * @param {{
 *   word: Record<string, any>,
 *   state: Record<string, any>|undefined,
 *   weights: ReturnType<typeof calibrateWeights>,
 *   today: string,
 *   mode: 'review'|'effort'
 * }} input
 */
export function scoreWord({ word, state, weights, today, mode }) {
  const stats = weights.byWord[String(word.id)];
  const errorRate = stats?.errorRate ?? PRIOR_ERROR_RATE;
  let score = 0;
  if (!state) {
    score += mode === 'effort' ? 2.0 : 0.8;
  } else {
    if (state.errorProfile?.length > 0) score += 4.0;
    if (typeof state.dueDate === 'string' && state.dueDate <= today) score += 3.0;
    if (state.status === 'probe') score += 2.0;
    if (state.status === 'mastered') score -= 2.0;
    const interval = Number(state.intervalIndex ?? 0);
    score += mode === 'effort' ? Math.min(2, interval * 0.4) : Math.max(0, 1 - interval * 0.1);
  }
  score += errorRate * 3.0;
  score += (stats?.wrong ?? 0) * 0.15;
  return Number(score.toFixed(4));
}

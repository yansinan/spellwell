/**
 * @layer ui
 * @phase P9
 * @doc §2.1 孩子端（学习模块）
 *
 * 练习结束摘要：先正确率，再错词；只使用第一次作答结果。
 */

import { summarizeSession } from './analytics.js';

/**
 * @param {import('../core/contracts.js').AttemptResult[]} results
 * @param {(wordId: string) => string} wordText
 */
export function buildCompletionSummary(results, wordText) {
  const summary = summarizeSession(results);
  const wrongWords = [...new Set(
    results.filter((result) => !result.wordCorrect).map((result) => wordText(result.wordId)),
  )];
  const encouragement = summary.accuracy >= 90
    ? 'Outstanding!'
    : summary.accuracy >= 70
      ? 'Great effort!'
      : 'You kept going. Every word counts.';
  return {
    ...summary,
    wrongWords,
    encouragement,
    firstTryLabel: `${summary.correct} / ${summary.total} correct first try`,
  };
}

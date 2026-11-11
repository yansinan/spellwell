/**
 * @layer admin
 * @phase P7
 * @doc §2.3 内容后台
 *
 * 后台只读统计：按 wordId 汇总 attempts 的错/对次数。
 * 不写 attempts、wordStates、graphemeStates。
 */

/**
 * @param {Record<string, any>[]} attempts
 * @returns {Record<string, {wrong: number, correct: number}>}
 */
export function countAttemptsByWord(attempts) {
  const counts = {};
  for (const attempt of Array.isArray(attempts) ? attempts : []) {
    const wordId = String(attempt.wordId ?? '');
    if (!wordId) continue;
    if (!counts[wordId]) counts[wordId] = { wrong: 0, correct: 0 };
    if (attempt.wordCorrect) counts[wordId].correct += 1;
    else counts[wordId].wrong += 1;
  }
  return counts;
}

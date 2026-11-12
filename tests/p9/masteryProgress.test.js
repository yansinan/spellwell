/**
 * @layer tests
 * @phase P9
 * @doc §2.1 孩子端（学习模块）
 */

import { unitProgress, wordProgress } from '../../src/ui/masteryProgress.js';
import { assertEqual, test } from '../harness.js';

test('单元进度：记忆曲线 + 连对 + 错题惩罚，mastered 为 100%', () => {
  assertEqual(wordProgress(undefined), 0);
  const learning = wordProgress({
    intervalIndex: 2,
    consecutiveCorrect: 1,
    errorProfile: [{ type: 'OMISSION' }],
    lastResult: 'wrong',
    status: 'learning',
  });
  const strong = wordProgress({
    intervalIndex: 4,
    consecutiveCorrect: 3,
    errorProfile: [],
    lastResult: 'correct',
    status: 'reviewing',
  });
  assertEqual(strong > learning, true);
  assertEqual(wordProgress({ status: 'mastered', errorProfile: [] }), 1);
});

test('单元进度：未练词计 0，按词平均并四舍五入', () => {
  const words = [{ id: 'a' }, { id: 'b' }];
  const result = unitProgress([
    { wordId: 'a', status: 'mastered', errorProfile: [] },
    { wordId: 'b', intervalIndex: 0, consecutiveCorrect: 0, status: 'learning', errorProfile: [] },
  ], words);
  assertEqual(result.percent, 50);
  assertEqual(result.practiced, 2);
  assertEqual(result.mastered, 1);
});

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

test('单元进度：真实 attempts 校准，错题多则进度更低', () => {
  const state = { intervalIndex: 3, consecutiveCorrect: 2, errorProfile: [], lastResult: 'correct', status: 'reviewing' };
  const noData = wordProgress(state, undefined, 0.7);
  const good = wordProgress(state, { correct: 6, wrong: 0 }, 0.7);
  const bad = wordProgress(state, { correct: 1, wrong: 5 }, 0.7);
  assertEqual(good > noData, true);
  assertEqual(bad < noData, true);
  assertEqual(wordProgress(state, { correct: 20, wrong: 0 }, 0.7) > good, true);
});

test('单元进度：sampleSize 来自真实 attempts', () => {
  const words = [{ id: 'a' }, { id: 'b' }];
  const result = unitProgress([
    { wordId: 'a', status: 'mastered', errorProfile: [] },
    { wordId: 'b', intervalIndex: 1, consecutiveCorrect: 1, status: 'learning', errorProfile: [] },
  ], words, [
    { wordId: 'a', wordCorrect: true },
    { wordId: 'b', wordCorrect: false },
    { wordId: 'b', wordCorrect: true },
  ]);
  assertEqual(result.sampleSize, 3);
  assertEqual(result.percent > 0, true);
});

test('未开始状态：进度 0，且不算 practiced/mastered', () => {
  const words = [{ id: 'a' }];
  const states = [{ wordId: 'a', status: 'unstarted', intervalIndex: 0, consecutiveCorrect: 0, errorProfile: [], lastResult: null, dueDate: null }];
  assertEqual(wordProgress(states[0]), 0);
  const result = unitProgress(states, words);
  assertEqual(result.percent, 0);
  assertEqual(result.practiced, 0);
  assertEqual(result.mastered, 0);
});

test('进度封顶：probe/reviewing 未 mastered 不显示 100%', () => {
  const probe = { status: 'probe', intervalIndex: 4, consecutiveCorrect: 5, errorProfile: [], lastResult: 'correct' };
  const reviewing = { status: 'reviewing', intervalIndex: 4, consecutiveCorrect: 4, errorProfile: [], lastResult: 'correct' };
  assertEqual(wordProgress(probe) < 1, true);
  assertEqual(wordProgress(reviewing) < 1, true);
  assertEqual(wordProgress({ status: 'mastered', errorProfile: [] }), 1);
});

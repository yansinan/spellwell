/**
 * @layer tests
 * @phase P9
 * @doc §2.1 孩子端（学习模块）
 */

import { buildCompletionSummary } from '../../src/ui/completionSummary.js';
import { assertDeepEqual, assertEqual, test } from '../harness.js';

test('结束摘要：先正确率，再去重错词与鼓励语', () => {
  const summary = buildCompletionSummary([
    { wordId: 'w.weather', wordCorrect: false },
    { wordId: 'w.weather', wordCorrect: false },
    { wordId: 'w.fish', wordCorrect: true },
    { wordId: 'w.ship', wordCorrect: true },
  ], (id) => id.replace('w.', ''));
  assertEqual(summary.accuracy, 50);
  assertEqual(summary.correct, 2);
  assertEqual(summary.total, 4);
  assertDeepEqual(summary.wrongWords, ['weather']);
  assertEqual(summary.encouragement, 'You kept going. Every word counts.');
});

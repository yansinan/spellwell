/**
 * @layer tests
 * @phase P8
 * @doc §2.1/§2.2 学习分析
 */

import {
  buildReport,
  groupAttemptsByDay,
  summarizeAttempts,
  summarizeSession,
  summarizeWordStates,
} from '../../src/ui/analytics.js';
import { assertDeepEqual, assertEqual, test } from '../harness.js';

function attempt(wordId, correct, type, timestamp) {
  return {
    id: `a.${timestamp}`,
    wordId,
    wordCorrect: correct,
    firstError: correct ? null : { type, unitKind: 'grapheme', unitId: 'g.sh', position: 2, expected: 'sh', actual: 's' },
    timestamp,
  };
}

const attempts = [
  attempt('w.fish', true, null, new Date(2026, 10, 11, 10).getTime()),
  attempt('w.fish', false, 'OMISSION', new Date(2026, 10, 11, 11).getTime()),
  attempt('w.ship', false, 'OMISSION', new Date(2026, 10, 12, 10).getTime()),
];

test('本次练习：正确数、正确率、错误类型', () => {
  const summary = summarizeSession([
    { wordCorrect: true, firstError: null },
    { wordCorrect: false, firstError: { type: 'OMISSION' } },
    { wordCorrect: false, firstError: { type: 'OMISSION' } },
  ]);
  assertEqual(summary.total, 3);
  assertEqual(summary.correct, 1);
  assertEqual(summary.wrong, 2);
  assertEqual(summary.accuracy, 33);
  assertEqual(summary.topError, 'OMISSION');
  assertDeepEqual(summary.errors, { OMISSION: 2 });
});

test('历史 attempts：汇总与按日聚合', () => {
  const summary = summarizeAttempts(attempts);
  assertEqual(summary.total, 3);
  assertEqual(summary.correct, 1);
  assertEqual(summary.accuracy, 33);
  assertEqual(summary.topError, 'OMISSION');
  assertEqual(summary.byWord['w.fish'].total, 2);
  const days = groupAttemptsByDay(attempts);
  assertEqual(days.length, 2);
  assertEqual(days[0].date, '2026-11-12');
  assertEqual(days[1].accuracy, 50);
});

test('状态分布与总报告', () => {
  assertDeepEqual(
    summarizeWordStates([{ status: 'learning' }, { status: 'reviewing' }, { status: 'probe' }]),
    { learning: 1, reviewing: 1, probe: 1, mastered: 0 },
  );
  const report = buildReport({
    attempts,
    wordStates: [{ status: 'learning' }, { status: 'probe' }],
    graphemeStates: [{ status: 'probe' }],
  });
  assertEqual(report.attempts.total, 3);
  assertEqual(report.states.probe, 1);
  assertEqual(report.graphemeProbe, 1);
  assertEqual(report.recent.length, 3);
});

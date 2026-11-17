/**
 * @layer tests
 * @phase P12
 * @doc §2.3 内容后台
 */

import { buildHistoryAnalytics, groupPracticeSessions } from '../../src/admin/HistoryAnalytics.js';
import { toDayKey } from '../../src/core/time.js';
import { assert, assertEqual, test } from '../harness.js';

const base = new Date(2026, 10, 17, 18, 0, 0).getTime();

function attempt(offsetMinutes, wordId, correct = true, errorType = null) {
  return {
    id: `a.${offsetMinutes}.${wordId}`,
    wordId,
    wordCorrect: correct,
    firstError: errorType ? { type: errorType } : null,
    timestamp: base + offsetMinutes * 60_000,
  };
}

test('做题分析：按 30 分钟间隔估算练习场次', () => {
  const sessions = groupPracticeSessions([
    attempt(0, 'w.a'),
    attempt(10, 'w.b', false, 'OMISSION'),
    attempt(120, 'w.c'),
  ]);
  assertEqual(sessions.length, 2);
  assertEqual(sessions[0].total, 1);
  assertEqual(sessions[1].total, 2);
  assertEqual(sessions[1].accuracy, 50);
});

test('做题分析：正确率、趋势、薄弱词与到期复习', () => {
  const words = [
    { id: 'w.a', text: 'apple', translation: '苹果' },
    { id: 'w.b', text: 'book', translation: '书' },
  ];
  const today = toDayKey(new Date(base));
  const analysis = buildHistoryAnalytics({
    attempts: [
      attempt(0, 'w.a', true),
      attempt(1, 'w.b', false, 'SUBSTITUTION'),
      attempt(2, 'w.b', false, 'OMISSION'),
      attempt(120, 'w.a', true),
    ],
    wordStates: [
      { wordId: 'w.a', status: 'mastered', dueDate: null },
      { wordId: 'w.b', status: 'reviewing', dueDate: today },
    ],
    words,
    now: base + 130 * 60_000,
  });
  assertEqual(analysis.summary.total, 4);
  assertEqual(analysis.summary.accuracy, 50);
  assertEqual(analysis.summary.sessions, 2);
  assertEqual(analysis.summary.latestAccuracy, 100);
  assertEqual(analysis.summary.accuracyDelta, 67);
  assertEqual(analysis.focusWords[0].wordId, 'w.b');
  assertEqual(analysis.focusWords[0].wrong, 2);
  assertEqual(analysis.sessions[1].errorDetails.length, 2);
  assertEqual(analysis.sessions[1].errorDetails[0].word, 'book');
  assertEqual(analysis.dueCount, 1);
  assertEqual(analysis.statusCounts.mastered, 1);
});

test('做题分析：空数据也能生成稳定结果', () => {
  const analysis = buildHistoryAnalytics({ attempts: [], wordStates: [], words: [], now: base });
  assertEqual(analysis.hasData, false);
  assertEqual(analysis.summary.total, 0);
  assertEqual(analysis.daily.length, 14);
  assert(analysis.sessions.length === 0);
});

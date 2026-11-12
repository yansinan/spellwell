/**
 * @layer tests
 * @phase P11
 * @doc §2.1 孩子端（学习模块）
 */

import { addSpeedRecord, bestSpeed, formatElapsed, formatPace, normalizeSpeedHistory } from '../../src/ui/speedStats.js';
import { assertEqual, test } from '../harness.js';

test('练习速度：按每题秒数记录，保留历史最佳', () => {
  const first = addSpeedRecord([], { at: 1, elapsedMs: 60000, questions: 20 });
  assertEqual(first[0].secondsPerQuestion, 3);
  assertEqual(formatElapsed(60000), '1:00');
  assertEqual(formatPace(3), '3.0s/q');
  const second = addSpeedRecord(first, { at: 2, elapsedMs: 70000, questions: 20 });
  assertEqual(bestSpeed(second), 3);
  assertEqual(normalizeSpeedHistory({ items: second }).length, 2);
});

test('练习速度：不限时，格式化与空历史', () => {
  assertEqual(bestSpeed([]), null);
  assertEqual(formatElapsed(0), '0:00');
  assertEqual(formatPace(0), '—');
});

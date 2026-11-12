/**
 * @layer tests
 * @phase P11
 * @doc §2.1 孩子端（学习模块）
 */

import { RapidTapChallenge } from '../../src/input/RapidTapChallenge.js';
import { assertEqual, assertThrows, test } from '../harness.js';

test('RapidTapChallenge：默认关闭，挑战结果只在内存', () => {
  const challenge = new RapidTapChallenge({ durationMs: 5000, now: () => 100 });
  assertEqual(challenge.active, false);
  const started = challenge.start({ words: ['book', 'fish'], morphMode: true });
  assertEqual(started.active, true);
  assertEqual(started.persisted, false);
  assertEqual(started.morphMode, true);
  const after = challenge.tap({ wordId: 'book', correct: true });
  assertEqual(after.correct, 1);
  assertEqual(after.streak, 1);
  const stopped = challenge.stop();
  assertEqual(stopped.active, false);
  assertEqual(stopped.persisted, false);
  assertEqual(stopped.correct, 1);
});

test('RapidTapChallenge：状态机错误显式报错，不产生副作用', () => {
  const challenge = new RapidTapChallenge({ now: () => 0 });
  assertThrows(() => challenge.tap({ correct: true }), /not running/);
  challenge.start();
  assertThrows(() => challenge.start(), /already running/);
  challenge.stop();
});

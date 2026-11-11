/**
 * @layer tests
 * @phase P0
 * @doc §1.3 记忆曲线是调度器，不是装饰
 */

import { ERROR_TYPES } from '../../src/core/contracts.js';
import { Scheduler } from '../../src/scheduler/Scheduler.js';
import {
  applyWordReview,
  dueDateFor,
  isProbeEligible,
  nextReview,
  PROBE_DISTINCT_WORDS,
  PROBE_STREAK,
  REVIEW_INTERVALS_DAYS,
} from '../../src/scheduler/IntervalPolicy.js';
import {
  appendErrorProfile,
  createErrorProfile,
  describeErrorForParent,
  primaryError,
} from '../../src/scheduler/ErrorProfile.js';
import {
  candidatesForError,
  NEW_WORD_ROTATION,
  REPAIR_PREFERENCE,
  selectForNewWord,
  selectType,
} from '../../src/scheduler/TypeSelector.js';
import { QUESTION_TYPE_IDS } from '../../src/questionTypes/registry.js';
import { createWordState } from '../../src/repositories/StateRepository.js';
import {
  assert,
  assertDeepEqual,
  assertEqual,
  assertIncludes,
  assertRejects,
  assertThrows,
  test,
} from '../harness.js';

test('间隔阶梯精确为 1/3/7/14/30 天', () => {
  assertDeepEqual([...REVIEW_INTERVALS_DAYS], [1, 3, 7, 14, 30]);
});

test('nextReview：答对升一档并在 30 天封顶', () => {
  assertDeepEqual(nextReview({ intervalIndex: 0, consecutiveCorrect: 0, lastResult: null }, true), {
    intervalIndex: 1,
    consecutiveCorrect: 1,
    lastResult: 'correct',
  });
  assertDeepEqual(nextReview({ intervalIndex: 4, consecutiveCorrect: 9, lastResult: 'correct' }, true), {
    intervalIndex: 4,
    consecutiveCorrect: 10,
    lastResult: 'correct',
  });
});

test('nextReview：答错降两档；降档后再错归零', () => {
  assertDeepEqual(nextReview({ intervalIndex: 3, consecutiveCorrect: 2, lastResult: 'correct' }, false), {
    intervalIndex: 1,
    consecutiveCorrect: 0,
    lastResult: 'wrong',
  });
  assertDeepEqual(nextReview({ intervalIndex: 1, consecutiveCorrect: 0, lastResult: 'wrong' }, false), {
    intervalIndex: 0,
    consecutiveCorrect: 0,
    lastResult: 'wrong',
  });
  assertDeepEqual(nextReview({ intervalIndex: 4, consecutiveCorrect: 0, lastResult: 'wrong' }, false), {
    intervalIndex: 0,
    consecutiveCorrect: 0,
    lastResult: 'wrong',
  });
});

test('dueDateFor：按本地日历日推进，不跨日错位', () => {
  const from = new Date(2026, 10, 11, 12, 0, 0);
  assertEqual(dueDateFor(0, from), '2026-11-12');
  assertEqual(dueDateFor(1, from), '2026-11-14');
  assertEqual(dueDateFor(2, from), '2026-11-18');
  assertEqual(dueDateFor(3, from), '2026-11-25');
  assertEqual(dueDateFor(4, from), '2026-12-11');
});

test('applyWordReview：不修改原状态，保留错误画像并写 dueDate', () => {
  const original = createWordState('w.fish', new Date(2026, 10, 11, 9, 0, 0));
  const next = applyWordReview(original, true, new Date(2026, 10, 11, 10, 0, 0));
  assertEqual(original.intervalIndex, 0);
  assertEqual(original.dueDate, '2026-11-11');
  assertEqual(next.intervalIndex, 1);
  assertEqual(next.dueDate, '2026-11-14');
  assertEqual(next.consecutiveCorrect, 1);
  assertEqual(next.lastResult, 'correct');
  assertDeepEqual(next.errorProfile, []);
});

test('isProbeEligible：连续 3 次且跨 2 个不同词', () => {
  assertEqual(PROBE_STREAK, 3);
  assertEqual(PROBE_DISTINCT_WORDS, 2);
  assertEqual(isProbeEligible({ consecutiveCorrect: 3, wordsPassed: ['w.fish', 'w.ship'] }), true);
  assertEqual(isProbeEligible({ consecutiveCorrect: 2, wordsPassed: ['w.fish', 'w.ship'] }), false);
  assertEqual(isProbeEligible({ consecutiveCorrect: 3, wordsPassed: ['w.fish', 'w.fish'] }), false);
});

test('TypeSelector：每个错误类型都有修复题型，且题型均存在', () => {
  for (const errorType of ERROR_TYPES) {
    const candidates = candidatesForError(errorType);
    assert(candidates.length > 0, `${errorType} has no candidates`);
    for (const typeId of candidates) assertIncludes(QUESTION_TYPE_IDS, typeId);
  }
  assertDeepEqual([...NEW_WORD_ROTATION], ['T-SEQUENCE', 'T-FILL', 'T-TYPE']);
  assertDeepEqual([...REPAIR_PREFERENCE.UNKNOWN], ['T-SEQUENCE', 'T-FILL', 'T-TYPE']);
});

test('TypeSelector：同 seed 选择稳定，available 过滤与降级可用', () => {
  const a = selectType({ errorType: 'TRANSPOSITION', seed: 'fish' });
  const b = selectType({ errorType: 'TRANSPOSITION', seed: 'fish' });
  assertEqual(a, b);
  assertIncludes(candidatesForError('TRANSPOSITION'), a);

  const constrained = selectType({ errorType: 'OMISSION', seed: 1, available: ['T-SEQUENCE'] });
  assertEqual(constrained, 'T-SEQUENCE');
  assertEqual(selectType({ errorType: 'OMISSION', seed: 1, available: [] }), null);
  assertEqual(selectForNewWord({ seed: 1, available: [] }), null);
  assertIncludes(NEW_WORD_ROTATION, selectForNewWord({ seed: 1 }));
});

test('ErrorProfile：去重、截断与主错误按位置选择', () => {
  const base = createErrorProfile({
    type: 'OMISSION',
    unitKind: 'grapheme',
    unitId: 'g.sh',
    position: 2,
    expected: 'sh',
    actual: '',
  });
  let list = appendErrorProfile([], base);
  list = appendErrorProfile(list, base);
  assertEqual(list.length, 1);

  for (let position = 0; position < 10; position += 1) {
    list = appendErrorProfile(list, {
      ...base,
      position,
      expected: `e${position}`,
    });
  }
  assertEqual(list.length, 8);
  assertEqual(list[list.length - 1].position, 9);

  const primary = primaryError([
    { ...base, position: 4 },
    { ...base, position: 1 },
    { ...base, position: 2 },
  ]);
  assertEqual(primary.position, 1);
  assertEqual(primaryError([]), null);
});

test('ErrorProfile：家长端描述具体到位置与目标块', () => {
  const profile = createErrorProfile({
    type: 'SUBSTITUTION',
    unitKind: 'grapheme',
    unitId: 'g.sh',
    position: 2,
    expected: 'sh',
    actual: 's',
  });
  const text = describeErrorForParent(profile, { wordText: 'fish' });
  assertIncludes(text, 'fish');
  assertIncludes(text, 'sh');
  assertIncludes(text, '第 3 位');
});

test('Scheduler：P3 需要完整依赖，不静默返回空队列', () => {
  const error = assertThrows(() => new Scheduler({}), 'SCHEDULER_DEPS_INVALID');
  assertEqual(error.code, 'SCHEDULER_DEPS_INVALID');
});

/**
 * @layer tests
 * @phase P0
 * @doc §3.4 9 个题型注册表
 */

import {
  EXPECTED_QUESTION_TYPE_IDS,
  getQuestionType,
  getQuestionTypesByRepair,
  listQuestionTypes,
  QUESTION_TYPE_IDS,
  assertRegistry,
} from '../../src/questionTypes/registry.js';
import {
  assert,
  assertDeepEqual,
  assertEqual,
  assertThrows,
  test,
} from '../harness.js';

const IMPLEMENTED_IN_P1 = new Set(['T-SEQUENCE', 'T-FILL', 'T-TYPE']);

const EXPECTED_PHASES = {
  'T-SEQUENCE': 'P1',
  'T-FILL': 'P1',
  'T-REORDER': 'P4',
  'T-TYPE': 'P1',
  'T-JUDGE-FIX': 'P6',
  'T-EDIT': 'P4',
  'T-MATCH': 'P5',
  'T-CLOZE': 'P6',
  'T-SEGMENT': 'P4',
};

test('注册表：精确 9 个题型，顺序与 DESIGN §3.4 一致', () => {
  assertRegistry();
  assertEqual(QUESTION_TYPE_IDS.length, 9);
  assertDeepEqual([...QUESTION_TYPE_IDS], [...EXPECTED_QUESTION_TYPE_IDS]);
  assertDeepEqual(listQuestionTypes().map((meta) => meta.id), [...EXPECTED_QUESTION_TYPE_IDS]);
});

test('注册表：每个题型有阶段、任务与修复信号', () => {
  for (const meta of listQuestionTypes()) {
    assertEqual(meta.phase, EXPECTED_PHASES[meta.id]);
    assert(typeof meta.task === 'string' && meta.task.length > 0, `${meta.id} task missing`);
    assert(Array.isArray(meta.repairs) && meta.repairs.length > 0, `${meta.id} repairs missing`);
    assertEqual(meta.contractVersion, 1);
  }
});

test('注册表：按修复信号反查（供调度层选择）', () => {
  assertDeepEqual(getQuestionTypesByRepair('TRANSPOSITION'), ['T-REORDER', 'T-EDIT']);
  assertDeepEqual(getQuestionTypesByRepair('EXTRA'), ['T-EDIT']);
  const forBoundary = getQuestionTypesByRepair('BOUNDARY_MISPLACED');
  assert(forBoundary.includes('T-SEGMENT'));
  assert(forBoundary.includes('T-JUDGE-FIX'));
});

test('注册表：未知题型明确报错', () => {
  const error = assertThrows(() => getQuestionType('T-NOPE'), 'QUESTION_TYPE_UNKNOWN');
  assertEqual(error.details.id, 'T-NOPE');
});

test('未实现题型：build/judge 在对应阶段前必须抛 PHASE_NOT_IMPLEMENTED', () => {
  for (const meta of listQuestionTypes()) {
    if (IMPLEMENTED_IN_P1.has(meta.id)) continue;
    const { build, judge } = getQuestionType(meta.id);
    const buildError = assertThrows(() => build({}, {}), 'PHASE_NOT_IMPLEMENTED');
    assertEqual(buildError.phase, meta.phase);
    assertEqual(buildError.feature, `${meta.id}.build`);

    const judgeError = assertThrows(() => judge({}, {}, []), 'PHASE_NOT_IMPLEMENTED');
    assertEqual(judgeError.phase, meta.phase);
    assertEqual(judgeError.feature, `${meta.id}.judge`);
  }
});

test('题型元数据不可变（防止运行时篡改注册表）', () => {
  const meta = listQuestionTypes()[0];
  assert(Object.isFrozen(meta));
  assert(Object.isFrozen(meta.repairs));
});

/**
 * @layer tests
 * @phase P0
 * @doc §5.2 核心契约
 */

import {
  CONTRACT_VERSION,
  ERROR_TYPES,
  MAX_ERROR_PROFILE_ENTRIES,
  validateAttemptResult,
  validateErrorProfile,
  validateGraphemeState,
  validateInputEvent,
  validateQuestionSpec,
  validateRenderModel,
  validateWordState,
} from '../../src/core/contracts.js';
import { assertDeepEqual, assertEqual, assertThrows, test } from '../harness.js';

const spec = {
  specId: 'spec.fish.sequence.1',
  typeId: 'T-SEQUENCE',
  target: { kind: 'word', id: 'w.fish' },
  params: { mode: 'initial' },
  resourceHints: { wordIds: ['w.fish'] },
  seed: 42,
};

const renderModel = {
  layout: 'sequence',
  slots: [
    { slotId: 'slot-0', index: 0 },
    { slotId: 'slot-1', index: 1 },
  ],
  units: [
    { unitId: 'unit-f', text: 'f', kind: 'letter' },
    { unitId: 'unit-sh', text: 'sh', kind: 'grapheme' },
  ],
  fixedText: '',
  focus: { kind: 'grapheme', id: 'g.sh' },
  interactionHints: {
    allowTap: true,
    allowDrag: false,
    allowKeyboard: false,
    allowReorder: false,
    allowEdit: false,
    keyboardScope: 'grapheme',
  },
  seed: 42,
};

const errorProfile = {
  type: 'OMISSION',
  unitKind: 'grapheme',
  unitId: 'g.sh',
  position: 2,
  expected: 'sh',
  actual: '',
};

const wordState = {
  wordId: 'w.fish',
  intervalIndex: 0,
  consecutiveCorrect: 0,
  lastResult: null,
  errorProfile: [],
  status: 'learning',
  dueDate: '2026-11-11',
  updatedAt: '2026-11-11T09:00:00.000Z',
};

test('契约版本为 1，错误类型精确覆盖 DESIGN §3.3 的 9 种', () => {
  assertEqual(CONTRACT_VERSION, 1);
  assertEqual(ERROR_TYPES.length, 9);
  assertDeepEqual([...ERROR_TYPES], [
    'OMISSION',
    'SUBSTITUTION',
    'TRANSPOSITION',
    'EXTRA',
    'BOUNDARY_OVER_SEGMENT',
    'BOUNDARY_UNDER_SEGMENT',
    'BOUNDARY_MISPLACED',
    'SUFFIX_RULE',
    'UNKNOWN',
  ]);
});

test('QuestionSpec：合法 spec 通过校验', () => {
  assertEqual(validateQuestionSpec(spec), true);
});

test('QuestionSpec：seed 必须是 uint32', () => {
  assertThrows(() => validateQuestionSpec({ ...spec, seed: -1 }), 'QUESTION_SPEC_INVALID');
  assertThrows(() => validateQuestionSpec({ ...spec, seed: 1.5 }), 'QUESTION_SPEC_INVALID');
  assertThrows(() => validateQuestionSpec({ ...spec, seed: 2 ** 32 }), 'QUESTION_SPEC_INVALID');
});

test('QuestionSpec：typeId 与 target 必须是合法形状', () => {
  assertThrows(() => validateQuestionSpec({ ...spec, typeId: 'sequence' }), 'QUESTION_SPEC_INVALID');
  assertThrows(() => validateQuestionSpec({ ...spec, target: { kind: 'grapheme', id: 'g.sh' } }), 'QUESTION_SPEC_INVALID');
  assertThrows(() => validateQuestionSpec({ ...spec, focus: { kind: 'word', id: 'w.fish' } }), 'QUESTION_SPEC_INVALID');
});

test('RenderModel：合法模型通过校验', () => {
  assertEqual(validateRenderModel(renderModel), true);
});

test('RenderModel：slot/unit 的唯一性与 interactionHints 必填布尔值', () => {
  assertThrows(
    () => validateRenderModel({ ...renderModel, slots: [...renderModel.slots, { slotId: 'slot-0', index: 2 }] }),
    'RENDER_MODEL_INVALID',
  );
  assertThrows(
    () => validateRenderModel({ ...renderModel, units: [...renderModel.units, { unitId: 'unit-f', text: 'x' }] }),
    'RENDER_MODEL_INVALID',
  );
  const { allowTap, ...hintsWithoutTap } = renderModel.interactionHints;
  assertThrows(
    () => validateRenderModel({ ...renderModel, interactionHints: hintsWithoutTap }),
    'RENDER_MODEL_INVALID',
  );
});

test('InputEvent：六种语义事件均可通过', () => {
  const events = [
    { kind: 'tap-unit', unitId: 'unit-sh', slotIndex: 2 },
    { kind: 'drag-unit', unitId: 'unit-f', slotIndex: 0 },
    { kind: 'key-text', text: 'fish' },
    { kind: 'reorder', fromIndex: 0, toIndex: 1 },
    { kind: 'edit', op: 'insert', text: 'h' },
    { kind: 'tap-gap', gapIndex: 2 },
  ];
  for (const event of events) assertEqual(validateInputEvent(event), true);
});

test('InputEvent：拒绝未知类型与缺失必填字段', () => {
  assertThrows(() => validateInputEvent({ kind: 'click' }), 'INPUT_EVENT_INVALID');
  assertThrows(() => validateInputEvent({ kind: 'tap-unit' }), 'INPUT_EVENT_INVALID');
  assertThrows(() => validateInputEvent({ kind: 'tap-gap' }), 'INPUT_EVENT_INVALID');
});

test('AttemptResult：合法结果与 firstError=null 均可通过', () => {
  assertEqual(validateAttemptResult({
    specId: spec.specId,
    wordId: 'w.fish',
    wordCorrect: true,
    focusCorrect: true,
    firstError: null,
    timestamp: 1760000000000,
  }), true);
});

test('AttemptResult：时间戳与主错误必须合法', () => {
  assertThrows(
    () => validateAttemptResult({ specId: 's', wordId: 'w.fish', wordCorrect: true, timestamp: -1 }),
    'ATTEMPT_RESULT_INVALID',
  );
  assertThrows(
    () => validateAttemptResult({
      specId: 's',
      wordId: 'w.fish',
      wordCorrect: false,
      firstError: { type: 'NOPE', unitKind: 'word', unitId: '', position: 0, expected: 'a', actual: 'b' },
      timestamp: 1,
    }),
    'ERROR_PROFILE_INVALID',
  );
});

test('ErrorProfile：9 种错误类型全部可构造', () => {
  for (const type of ERROR_TYPES) {
    assertEqual(validateErrorProfile({ ...errorProfile, type }), true);
  }
  assertThrows(() => validateErrorProfile({ ...errorProfile, position: -1 }), 'ERROR_PROFILE_INVALID');
  assertThrows(() => validateErrorProfile({ ...errorProfile, actual: null }), 'ERROR_PROFILE_INVALID');
});

test('WordState：合法状态通过，errorProfile 上限为 8', () => {
  assertEqual(validateWordState(wordState), true);
  const profiles = Array.from({ length: MAX_ERROR_PROFILE_ENTRIES + 1 }, (_, index) => ({
    ...errorProfile,
    position: index,
  }));
  assertThrows(() => validateWordState({ ...wordState, errorProfile: profiles }), 'WORD_STATE_INVALID');
});

test('WordState：lastResult/status/dueDate 枚举受控', () => {
  assertThrows(() => validateWordState({ ...wordState, lastResult: 'maybe' }), 'WORD_STATE_INVALID');
  assertThrows(() => validateWordState({ ...wordState, status: 'done' }), 'WORD_STATE_INVALID');
  assertThrows(() => validateWordState({ ...wordState, dueDate: '2026/11/11' }), 'WORD_STATE_INVALID');
});

test('GraphemeState：合法状态通过，wordsPassed 必须是字符串数组', () => {
  const state = {
    graphemeId: 'g.sh',
    intervalIndex: 1,
    consecutiveCorrect: 2,
    wordsPassed: ['w.fish', 'w.ship'],
    status: 'learning',
    dueDate: '2026-11-14',
    lastResult: 'correct',
  };
  assertEqual(validateGraphemeState(state), true);
  assertThrows(() => validateGraphemeState({ ...state, wordsPassed: [1] }), 'GRAPHEME_STATE_INVALID');
  assertThrows(() => validateGraphemeState({ ...state, status: 'mastered' }), 'GRAPHEME_STATE_INVALID');
});

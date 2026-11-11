/**
 * @layer tests
 * @phase P1
 * @doc §3.4 9 个题型注册表
 */

import { getQuestionType } from '../../src/questionTypes/registry.js';
import { validateRenderModel } from '../../src/core/contracts.js';
import { assert, assertDeepEqual, assertEqual, assertThrows, test } from '../harness.js';
import {
  FIXED_NOW,
  correctSequenceEvents,
  loadP1Bundles,
  makeSpec,
  tap,
  tileByText,
} from './helpers.js';

const { bundles } = await loadP1Bundles();
const fish = bundles[0];
const type = getQuestionType('T-SEQUENCE');

function build(params = { distractorGraphemeIds: ['g.ch'] }, seed = 42) {
  const spec = makeSpec({ word: fish.word, typeId: 'T-SEQUENCE', params, seed });
  const renderModel = type.build(spec, fish);
  validateRenderModel(renderModel);
  return { spec, renderModel };
}

function judge(spec, renderModel, events) {
  return type.judge({ spec, renderModel, events, bundle: fish, now: FIXED_NOW });
}

test('T-SEQUENCE：build 生成正确的槽位、候选池与 focus', () => {
  const { spec, renderModel } = build();
  assertEqual(renderModel.layout, 'sequence');
  assertEqual(renderModel.slots.length, 3);
  assertDeepEqual(renderModel.slots.map((slot) => slot.index), [0, 1, 2]);
  assertEqual(renderModel.units.length, 4);
  assertDeepEqual(
    renderModel.units.map((unit) => unit.text).sort(),
    ['ch', 'f', 'i', 'sh'],
  );
  assertEqual(renderModel.focus.id, spec.focus.id);
  assertEqual(renderModel.interactionHints.allowTap, true);
  assertEqual(renderModel.interactionHints.allowDrag, true);
  assertEqual(renderModel.interactionHints.allowKeyboard, false);
});

test('T-SEQUENCE：同 seed 渲染稳定，候选顺序可复现', () => {
  const first = build({ distractorGraphemeIds: ['g.ch'] }, 42);
  const second = build({ distractorGraphemeIds: ['g.ch'] }, 42);
  const third = build({ distractorGraphemeIds: ['g.ch'] }, 43);
  assertDeepEqual(
    first.renderModel.units.map((unit) => unit.unitId),
    second.renderModel.units.map((unit) => unit.unitId),
  );
  assertDeepEqual(first.renderModel.slots, second.renderModel.slots);
  assert(
    first.renderModel.units.map((unit) => unit.unitId).join('|')
      !== third.renderModel.units.map((unit) => unit.unitId).join('|'),
    'different seeds should produce a different candidate order',
  );
});

test('T-SEQUENCE：按序点选正确单位判定为对', () => {
  const { spec, renderModel } = build();
  const result = judge(spec, renderModel, correctSequenceEvents(fish.word, renderModel));
  assertEqual(result.wordCorrect, true);
  assertEqual(result.focusCorrect, true);
  assertEqual(result.firstError, null);
  assertEqual(result.timestamp, FIXED_NOW);
  assertEqual(result.specId, spec.specId);
  assertEqual(result.wordId, fish.word.id);
});

test('T-SEQUENCE：拖拽事件按 slotIndex 重建顺序，可与点选混用', () => {
  const { spec, renderModel } = build();
  const byText = new Map(renderModel.units.map((unit) => [unit.text, unit.unitId]));
  const events = [
    { kind: 'drag-unit', unitId: byText.get('sh'), slotIndex: 2 },
    { kind: 'tap-unit', unitId: byText.get('f'), slotIndex: 0 },
    { kind: 'drag-unit', unitId: byText.get('i'), slotIndex: 1 },
  ];
  const result = judge(spec, renderModel, events);
  assertEqual(result.wordCorrect, true);
  assertEqual(result.firstError, null);
});

test('T-SEQUENCE：取消中间选择后留下空槽，定位为 OMISSION', () => {
  const { spec, renderModel } = build();
  const events = correctSequenceEvents(fish.word, renderModel);
  const withoutMiddle = [events[0], events[2]];
  const result = judge(spec, renderModel, withoutMiddle);
  assertEqual(result.wordCorrect, false);
  assertEqual(result.firstError.type, 'OMISSION');
  assertEqual(result.firstError.position, 1);
  assertEqual(result.firstError.expected, 'i');
});

test('T-SEQUENCE：少选一个单位定位为 OMISSION', () => {
  const { spec, renderModel } = build();
  const events = correctSequenceEvents(fish.word, renderModel).slice(0, 2);
  const result = judge(spec, renderModel, events);
  assertEqual(result.wordCorrect, false);
  assertEqual(result.firstError.type, 'OMISSION');
  assertEqual(result.firstError.position, 2);
  assertEqual(result.firstError.expected, 'sh');
  assertEqual(result.firstError.actual, '');
  assertEqual(result.firstError.unitId, 'g.sh');
  assertEqual(result.focusCorrect, false);
});

test('T-SEQUENCE：用干扰组合替换定位为 SUBSTITUTION', () => {
  const { spec, renderModel } = build();
  const events = correctSequenceEvents(fish.word, renderModel).slice(0, 2);
  events.push(tap(tileByText(renderModel, 'ch').unitId, 2));
  const result = judge(spec, renderModel, events);
  assertEqual(result.wordCorrect, false);
  assertEqual(result.firstError.type, 'SUBSTITUTION');
  assertEqual(result.firstError.position, 2);
  assertEqual(result.firstError.expected, 'sh');
  assertEqual(result.firstError.actual, 'ch');
});

test('T-SEQUENCE：多选一个单位定位为 EXTRA', () => {
  const { spec, renderModel } = build();
  const events = correctSequenceEvents(fish.word, renderModel);
  events.push(tap(tileByText(renderModel, 'ch').unitId, 3));
  const result = judge(spec, renderModel, events);
  assertEqual(result.wordCorrect, false);
  assertEqual(result.firstError.type, 'EXTRA');
  assertEqual(result.firstError.position, 3);
  assertEqual(result.firstError.expected, '');
  assertEqual(result.firstError.actual, 'ch');
});

test('T-SEQUENCE：单位顺序颠倒定位为 TRANSPOSITION', () => {
  const { spec, renderModel } = build();
  const events = correctSequenceEvents(fish.word, renderModel);
  const swapped = [
    { ...events[0], unitId: events[1].unitId },
    { ...events[1], unitId: events[0].unitId },
    events[2],
  ];
  const result = judge(spec, renderModel, swapped);
  assertEqual(result.wordCorrect, false);
  assertEqual(result.firstError.type, 'TRANSPOSITION');
  assertEqual(result.firstError.position, 0);
  assertEqual(result.firstError.expected, 'f');
  assertEqual(result.firstError.actual, 'i');
});

test('T-SEQUENCE：未知单位输入明确报错，不静默判错', () => {
  const { spec, renderModel } = build();
  assertThrows(
    () => judge(spec, renderModel, [tap('not-a-unit', 0)]),
    'QUESTION_INPUT_INVALID',
  );
});

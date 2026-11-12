/**
 * @layer tests
 * @phase P1
 * @doc §3.4 9 个题型注册表
 */

import { validateRenderModel } from '../../src/core/contracts.js';
import { getQuestionType } from '../../src/questionTypes/registry.js';
import { wordUnitId } from '../../src/questionTypes/shared.js';
import { assertDeepEqual, assertEqual, assertThrows, test } from '../harness.js';
import {
  FIXED_NOW,
  correctEvents,
  loadP1Bundles,
  makeSpec,
  tap,
  tileByText,
} from './helpers.js';

const { bundles } = await loadP1Bundles();
const fish = bundles[0];
const type = getQuestionType('T-FILL');

function build(blankUnitIndex = 2, distractorGraphemeIds = ['g.ch'], seed = 42) {
  const spec = makeSpec({
    word: fish.word,
    typeId: 'T-FILL',
    params: { blankUnitIndex, distractorGraphemeIds },
    seed,
  });
  const renderModel = type.build(spec, fish);
  validateRenderModel(renderModel);
  return { spec, renderModel };
}

function judge(spec, renderModel, events) {
  return type.judge({ spec, renderModel, events, bundle: fish, now: FIXED_NOW });
}

test('T-FILL：build 只留一个空位，骨架由词条单位确定', () => {
  const { spec, renderModel } = build(2);
  assertEqual(renderModel.layout, 'fill');
  assertEqual(renderModel.slots.length, 1);
  assertEqual(renderModel.slots[0].index, 2);
  assertDeepEqual(
    renderModel.units.map((unit) => unit.text).sort(),
    ['ch', 'sh'],
  );
  assertEqual(spec.params.blankUnitIndex, 2);
  assertEqual(renderModel.focus.id, 'g.sh');
  assertEqual(renderModel.interactionHints.allowTap, true);
});

test('T-FILL：选中正确组合判定为对', () => {
  const { spec, renderModel } = build(2);
  const events = correctEvents({ typeId: 'T-FILL', spec, renderModel, word: fish.word });
  const result = judge(spec, renderModel, events);
  assertEqual(result.wordCorrect, true);
  assertEqual(result.focusCorrect, true);
  assertEqual(result.firstError, null);
  assertEqual(result.timestamp, FIXED_NOW);
});

test('T-FILL：未选择定位为 OMISSION', () => {
  const { spec, renderModel } = build(2);
  const result = judge(spec, renderModel, []);
  assertEqual(result.wordCorrect, false);
  assertEqual(result.focusCorrect, false);
  assertEqual(result.firstError.type, 'OMISSION');
  assertEqual(result.firstError.position, 2);
  assertEqual(result.firstError.expected, 'sh');
  assertEqual(result.firstError.actual, '');
  assertEqual(result.firstError.unitId, 'g.sh');
});

test('T-FILL：选中错误组合定位为 SUBSTITUTION', () => {
  const { spec, renderModel } = build(2);
  const result = judge(spec, renderModel, [tap(tileByText(renderModel, 'ch').unitId, 2)]);
  assertEqual(result.wordCorrect, false);
  assertEqual(result.firstError.type, 'SUBSTITUTION');
  assertEqual(result.firstError.position, 2);
  assertEqual(result.firstError.expected, 'sh');
  assertEqual(result.firstError.actual, 'ch');
});

test('T-FILL：干扰组合 ch 触发替换错，且 focus 为错', () => {
  const { spec, renderModel } = build(2);
  const result = judge(spec, renderModel, [tap(tileByText(renderModel, 'ch').unitId, 2)]);
  assertEqual(result.wordCorrect, false);
  assertEqual(result.focusCorrect, false);
  assertEqual(result.firstError.type, 'SUBSTITUTION');
  assertEqual(result.firstError.actual, 'ch');
  assertEqual(result.firstError.expected, 'sh');
});

test('T-FILL：空位下标越界时 build 明确报错', () => {
  assertThrows(() => build(99), 'QUESTION_SPEC_INVALID');
  assertThrows(() => build(-1), 'QUESTION_SPEC_INVALID');
});

/**
 * @layer tests
 * @phase P1
 * @doc §3.4 9 个题型注册表
 */

import { validateRenderModel } from '../../src/core/contracts.js';
import { getQuestionType } from '../../src/questionTypes/registry.js';
import { assertEqual, test } from '../harness.js';
import {
  FIXED_NOW,
  keyText,
  loadP1Bundles,
  makeSpec,
} from './helpers.js';

const { bundles } = await loadP1Bundles();
const fish = bundles[0];
const type = getQuestionType('T-TYPE');

const spec = makeSpec({ word: fish.word, typeId: 'T-TYPE', params: {}, seed: 42 });
const renderModel = type.build(spec, fish);
validateRenderModel(renderModel);

function judge(text) {
  return type.judge({
    spec,
    renderModel,
    events: [keyText(text)],
    bundle: fish,
    now: FIXED_NOW,
  });
}

test('T-TYPE：build 要求键盘输入，不带槽位/候选块', () => {
  assertEqual(renderModel.layout, 'type');
  assertEqual(renderModel.slots.length, 0);
  assertEqual(renderModel.units.length, 0);
  assertEqual(renderModel.interactionHints.allowKeyboard, true);
  assertEqual(renderModel.interactionHints.keyboardScope, 'word');
  assertEqual(renderModel.interactionHints.allowTap, false);
  assertEqual(renderModel.focus.id, 'g.sh');
});

test('T-TYPE：整词正确判定为对，大小写不敏感', () => {
  const lower = judge('fish');
  assertEqual(lower.wordCorrect, true);
  assertEqual(lower.focusCorrect, true);
  assertEqual(lower.firstError, null);
  assertEqual(lower.timestamp, FIXED_NOW);

  assertEqual(judge('FISH').wordCorrect, true);
  assertEqual(judge('  Fish  ').wordCorrect, true);
});

test('T-TYPE：使用最后一个 key-text 作为当前输入', () => {
  const result = type.judge({
    spec,
    renderModel,
    events: [keyText('fis'), keyText('fish')],
    bundle: fish,
    now: FIXED_NOW,
  });
  assertEqual(result.wordCorrect, true);
});

test('T-TYPE：少字母定位为 OMISSION', () => {
  const result = judge('fis');
  assertEqual(result.wordCorrect, false);
  assertEqual(result.focusCorrect, false);
  assertEqual(result.firstError.type, 'OMISSION');
  assertEqual(result.firstError.position, 2);
  assertEqual(result.firstError.expected, 'sh');
  assertEqual(result.firstError.actual, '');
  assertEqual(result.firstError.unitId, 'g.sh');
});

test('T-TYPE：替换组合定位为 SUBSTITUTION', () => {
  const result = judge('fich');
  assertEqual(result.wordCorrect, false);
  assertEqual(result.firstError.type, 'SUBSTITUTION');
  assertEqual(result.firstError.position, 2);
  assertEqual(result.firstError.expected, 'sh');
  assertEqual(result.firstError.actual, 'ch');
  assertEqual(result.firstError.unitId, 'g.sh');
});

test('T-TYPE：多字母定位为 EXTRA', () => {
  const result = judge('fishy');
  assertEqual(result.wordCorrect, false);
  assertEqual(result.firstError.type, 'EXTRA');
  assertEqual(result.firstError.position, 3);
  assertEqual(result.firstError.expected, '');
  assertEqual(result.firstError.actual, 'y');
});

test('T-TYPE：交换字母定位为 TRANSPOSITION', () => {
  const result = judge('fsih');
  assertEqual(result.wordCorrect, false);
  assertEqual(result.firstError.type, 'TRANSPOSITION');
  assertEqual(result.firstError.position, 1);
  assertEqual(result.firstError.expected, 'i');
  assertEqual(result.firstError.actual, 's');
});

test('T-TYPE：空输入定位为第一位遗漏', () => {
  const result = judge('');
  assertEqual(result.wordCorrect, false);
  assertEqual(result.firstError.type, 'OMISSION');
  assertEqual(result.firstError.position, 0);
  assertEqual(result.firstError.expected, 'f');
  assertEqual(result.firstError.actual, '');
  assertEqual(result.focusCorrect, false);
});

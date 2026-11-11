/**
 * @layer questionTypes
 * @phase P1
 * @doc §3.4 9 个题型注册表
 *
 * T-SEQUENCE：从候选池按序选单位。
 * 候选池由调度层通过 spec.params.distractorGraphemeIds 提供；
 * 题型层只消费，不生成干扰项。
 */

import { ContractError } from '../core/errors.js';
import { createRng } from '../core/seedRandom.js';
import { defineQuestionType } from './QuestionType.js';
import {
  assertFocusInWord,
  distractorUnits,
  errorFor,
  firstUnitMismatch,
  focusCorrectFromUnitTexts,
  getWord,
  makeAttempt,
  renderUnitsForWord,
  sameUnitMultiset,
} from './shared.js';

/**
 * @param {import('../core/contracts.js').QuestionSpec} spec
 * @param {import('./QuestionType.js').ResourceBundle} bundle
 * @returns {import('../core/contracts.js').RenderModel}
 */
function buildSequence(spec, bundle) {
  const word = getWord(bundle);
  assertFocusInWord(spec, bundle);
  const candidates = [...renderUnitsForWord(word), ...distractorUnits(spec, bundle)];
  const units = createRng(spec.seed).shuffle(candidates);
  const slots = word.units.map((_, index) => ({
    slotId: `slot-${index}`,
    index,
    accepts: /** @type {const} */ ('unit'),
  }));

  return {
    layout: 'sequence',
    slots,
    units,
    ...(spec.focus ? { focus: spec.focus } : {}),
    interactionHints: {
      allowTap: true,
      allowDrag: true,
      allowKeyboard: false,
      allowReorder: false,
      allowEdit: false,
    },
    seed: spec.seed,
  };
}

/**
 * @param {{
 *   spec: import('../core/contracts.js').QuestionSpec,
 *   renderModel: import('../core/contracts.js').RenderModel,
 *   events: import('../core/contracts.js').InputEvent[],
 *   bundle: import('./QuestionType.js').ResourceBundle,
 *   now?: number
 * }} context
 * @returns {import('../core/contracts.js').AttemptResult}
 */
function judgeSequence({ spec, renderModel, events, bundle, now = Date.now() }) {
  const word = getWord(bundle);
  const unitById = new Map(renderModel.units.map((unit) => [unit.unitId, unit]));
  const slotCount = renderModel.slots.length;
  const chosenBySlot = new Array(slotCount).fill(undefined);
  const extras = [];

  for (const event of Array.isArray(events) ? events : []) {
    if (event.kind !== 'tap-unit' && event.kind !== 'drag-unit') continue;
    const unit = unitById.get(event.unitId);
    if (!unit) {
      throw new ContractError('QUESTION_INPUT_INVALID', `unknown unit ${String(event.unitId)}`);
    }

    let slotIndex = event.slotIndex;
    if (!Number.isInteger(slotIndex)) {
      slotIndex = chosenBySlot.findIndex((text) => text === undefined);
    }
    if (slotIndex === undefined || slotIndex < 0 || slotIndex >= slotCount) {
      extras.push(unit.text);
      continue;
    }
    chosenBySlot[slotIndex] = unit.text;
  }

  const targetTexts = word.units.map((unit) => unit.text);
  const firstEmpty = chosenBySlot.findIndex((text) => text === undefined);
  const allSlotsFilled = firstEmpty === -1;
  const wordCorrect = allSlotsFilled
    && extras.length === 0
    && chosenBySlot.every((text, index) => text === targetTexts[index]);

  let firstError = null;
  if (!wordCorrect) {
    if (!allSlotsFilled) {
      firstError = errorFor({
        type: 'OMISSION',
        word,
        unitIndex: firstEmpty,
        expected: targetTexts[firstEmpty],
        actual: '',
      });
    } else if (extras.length > 0) {
      firstError = errorFor({
        type: 'EXTRA',
        word,
        unitIndex: targetTexts.length,
        expected: '',
        actual: extras.join(''),
      });
    } else {
      const mismatch = firstUnitMismatch(chosenBySlot, targetTexts);
      const isTransposition = sameUnitMultiset(chosenBySlot, targetTexts);
      firstError = errorFor({
        type: isTransposition ? 'TRANSPOSITION' : 'SUBSTITUTION',
        word,
        unitIndex: mismatch,
        expected: targetTexts[mismatch],
        actual: chosenBySlot[mismatch],
      });
    }
  }

  const chosenTexts = chosenBySlot.map((text) => text ?? '');

  return makeAttempt({
    spec,
    wordCorrect,
    focusCorrect: focusCorrectFromUnitTexts(word, chosenTexts, spec.focus),
    firstError,
    now,
  });
}

export const { meta, build, judge } = defineQuestionType({
  id: 'T-SEQUENCE',
  phase: 'P1',
  task: '从候选池按序选单位',
  repairs: ['SUBSTITUTION'],
  build: buildSequence,
  judge: judgeSequence,
});

/**
 * @layer questionTypes
 * @phase P1
 * @doc §3.4 9 个题型注册表
 *
 * T-FILL：骨架已给，只填空位。
 * 空位由调度层通过 params.blankUnitIndex 指定；候选池可附干扰组合。
 */

import { ContractError } from '../core/errors.js';
import { createRng } from '../core/seedRandom.js';
import { defineQuestionType } from './QuestionType.js';
import {
  assertFocusInWord,
  distractorUnits,
  errorFor,
  focusUnitIndexes,
  getWord,
  makeAttempt,
  renderUnitsForWord,
} from './shared.js';

/**
 * @param {import('../core/contracts.js').QuestionSpec} spec
 * @param {{id: string, text: string, units: {text: string, graphemeId: string}[]}} word
 * @returns {number}
 */
function resolveBlankIndex(spec, word) {
  if (Number.isInteger(spec.params?.blankUnitIndex)) {
    const index = /** @type {number} */ (spec.params.blankUnitIndex);
    if (index < 0 || index >= word.units.length) {
      throw new ContractError('QUESTION_SPEC_INVALID', `blankUnitIndex ${index} is out of range`);
    }
    return index;
  }
  const focusIndex = word.units.findIndex(
    (unit) => spec.focus && unit.graphemeId === spec.focus.id,
  );
  return focusIndex >= 0 ? focusIndex : word.units.length - 1;
}

/**
 * @param {import('../core/contracts.js').QuestionSpec} spec
 * @param {import('./QuestionType.js').ResourceBundle} bundle
 * @returns {import('../core/contracts.js').RenderModel}
 */
function buildFill(spec, bundle) {
  const word = getWord(bundle);
  assertFocusInWord(spec, bundle);
  const blankIndex = resolveBlankIndex(spec, word);
  const candidates = [...renderUnitsForWord(word), ...distractorUnits(spec, bundle)];
  const units = createRng(spec.seed).shuffle(candidates);

  return {
    layout: 'fill',
    slots: [{
      slotId: `slot-${blankIndex}`,
      index: blankIndex,
      accepts: /** @type {const} */ ('unit'),
    }],
    units,
    ...(spec.focus ? { focus: spec.focus } : {}),
    interactionHints: {
      allowTap: true,
      allowDrag: false,
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
function judgeFill({ spec, renderModel, events, bundle, now = Date.now() }) {
  const word = getWord(bundle);
  const blankIndex = resolveBlankIndex(spec, word);
  const unitById = new Map(renderModel.units.map((unit) => [unit.unitId, unit]));

  const taps = (Array.isArray(events) ? events : []).filter((event) => event.kind === 'tap-unit');
  const selectedEvent = taps[taps.length - 1];
  const selected = selectedEvent ? unitById.get(selectedEvent.unitId) : undefined;
  if (selectedEvent && !selected) {
    throw new ContractError('QUESTION_INPUT_INVALID', `unknown unit ${String(selectedEvent.unitId)}`);
  }

  const expected = word.units[blankIndex].text;
  const actual = selected?.text ?? '';
  const wordCorrect = selected !== undefined && actual === expected;
  const firstError = wordCorrect
    ? null
    : errorFor({
      type: selected === undefined ? 'OMISSION' : 'SUBSTITUTION',
      word,
      unitIndex: blankIndex,
      expected,
      actual,
    });

  const focusIndexes = focusUnitIndexes(word, spec.focus);
  const focusCorrect = focusIndexes.length === 0
    ? undefined
    : focusIndexes.every((index) => (index === blankIndex
      ? wordCorrect
      : true));

  return makeAttempt({
    spec,
    wordCorrect,
    focusCorrect,
    firstError,
    now,
  });
}

export const { meta, build, judge } = defineQuestionType({
  id: 'T-FILL',
  phase: 'P1',
  task: '骨架已给，只填空位',
  repairs: ['OMISSION', 'SUBSTITUTION', 'BOUNDARY_OVER_SEGMENT', 'BOUNDARY_UNDER_SEGMENT', 'BOUNDARY_MISPLACED'],
  build: buildFill,
  judge: judgeFill,
});

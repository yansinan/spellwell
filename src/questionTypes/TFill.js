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
 * @param {{units: {text: string}[]}} word
 */
function resolveVowelSplit(spec, word) {
  const split = spec.params?.vowelSplit;
  if (!split) return null;
  const { unitIndex, letters } = split;
  if (!Number.isInteger(unitIndex) || unitIndex < 0 || unitIndex >= word.units.length
    || !Array.isArray(letters) || letters.length < 2
    || letters.some((letter) => typeof letter !== 'string' || letter.length !== 1)
    || letters.join('') !== word.units[unitIndex].text) {
    throw new ContractError('QUESTION_SPEC_INVALID', 'vowelSplit must split an existing unit into letters');
  }
  return { unitIndex, letters: [...letters] };
}

/**
 * @param {import('../core/contracts.js').QuestionSpec} spec
 * @param {{id: string, text: string, units: {text: string, graphemeId: string}[]}} word
 * @returns {number}
 */
function resolveBlankIndexes(spec, word) {
  const list = Array.isArray(spec.params?.blankUnitIndices)
    ? spec.params.blankUnitIndices
    : Number.isInteger(spec.params?.blankUnitIndex)
      ? [spec.params.blankUnitIndex]
      : [];
  if (list.length > 0) {
    const unique = [...new Set(list)];
    for (const index of unique) {
      if (!Number.isInteger(index) || index < 0 || index >= word.units.length) {
        throw new ContractError('QUESTION_SPEC_INVALID', `blankUnitIndex ${index} is out of range`);
      }
    }
    return unique;
  }
  const focusIndex = word.units.findIndex(
    (unit) => spec.focus && unit.graphemeId === spec.focus.id,
  );
  return [focusIndex >= 0 ? focusIndex : word.units.length - 1];
}

/**
 * @param {import('../core/contracts.js').QuestionSpec} spec
 * @param {import('./QuestionType.js').ResourceBundle} bundle
 * @returns {import('../core/contracts.js').RenderModel}
 */
function buildFill(spec, bundle) {
  const word = getWord(bundle);
  assertFocusInWord(spec, bundle);
  const vowelSplit = resolveVowelSplit(spec, word);
  const blankIndexes = vowelSplit ? [] : resolveBlankIndexes(spec, word);
  const allWordUnits = renderUnitsForWord(word);
  const candidates = vowelSplit
    ? [
      ...vowelSplit.letters.map((letter, index) => ({
        unitId: `split-${vowelSplit.unitIndex}-${index}`,
        text: letter,
        kind: /** @type {const} */ ('letter'),
      })),
      ...distractorUnits(spec, bundle).filter((unit) => !vowelSplit.letters.includes(unit.text)),
    ]
    : [
      ...blankIndexes.map((index) => allWordUnits[index]),
      ...distractorUnits(spec, bundle).filter((unit) => !blankIndexes.some((index) => word.units[index].text === unit.text)),
    ];
  const units = createRng(spec.seed).shuffle(candidates);

  return {
    layout: 'fill',
    slots: vowelSplit
      ? vowelSplit.letters.map((_, index) => ({
        slotId: `slot-split-${index}`,
        index,
        accepts: /** @type {const} */ ('unit'),
      }))
      : blankIndexes.map((index) => ({
        slotId: `slot-${index}`,
        index,
        accepts: /** @type {const} */ ('unit'),
      })),
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
  const vowelSplit = resolveVowelSplit(spec, word);
  const blankIndexes = vowelSplit ? vowelSplit.letters.map((_, index) => index) : resolveBlankIndexes(spec, word);
  const unitById = new Map(renderModel.units.map((unit) => [unit.unitId, unit]));
  const taps = (Array.isArray(events) ? events : []).filter((event) => event.kind === 'tap-unit');
  const selectedBySlot = new Map();
  for (const event of taps) {
    if (Number.isInteger(event.slotIndex)) selectedBySlot.set(event.slotIndex, event);
    else selectedBySlot.set(blankIndexes.find((index) => !selectedBySlot.has(index)), event);
  }
  const missing = blankIndexes.find((index) => !selectedBySlot.has(index));
  let firstError = null;
  for (const index of blankIndexes) {
    const event = selectedBySlot.get(index);
    const expected = vowelSplit ? vowelSplit.letters[index] : word.units[index].text;
    const selected = event ? unitById.get(event.unitId) : undefined;
    if (event && !selected) throw new ContractError('QUESTION_INPUT_INVALID', `unknown unit ${String(event.unitId)}`);
    const actual = selected?.text ?? '';
    if (!firstError && actual !== expected) {
      firstError = errorFor({
        type: event === undefined ? 'OMISSION' : 'SUBSTITUTION',
        word,
        unitIndex: vowelSplit ? vowelSplit.unitIndex : index,
        expected,
        actual,
      });
    }
  }
  const wordCorrect = !missing && firstError === null;

  const focusIndexes = focusUnitIndexes(word, spec.focus);
  const focusCorrect = focusIndexes.length === 0
    ? undefined
    : vowelSplit
      ? wordCorrect
      : focusIndexes.every((index) => (blankIndexes.includes(index) ? wordCorrect : true));

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

/**
 * @layer questionTypes
 * @phase P4
 * @doc §3.4 9 个题型注册表
 *
 * T-REORDER：单位初始打乱，孩子通过交换位置排成正确顺序。
 * 判定从 renderModel 的初始顺序出发，依次应用 reorder(fromIndex,toIndex)。
 */

import { createRng } from '../core/seedRandom.js';
import { defineQuestionType } from './QuestionType.js';
import {
  assertFocusInWord,
  errorFor,
  focusUnitIndexes,
  getWord,
  makeAttempt,
  renderUnitsForWord,
} from './shared.js';

/**
 * @param {import('../core/contracts.js').QuestionSpec} spec
 * @param {import('./QuestionType.js').ResourceBundle} bundle
 * @returns {import('../core/contracts.js').RenderModel}
 */
function buildType(spec, bundle) {
  const word = getWord(bundle);
  assertFocusInWord(spec, bundle);
  const units = renderUnitsForWord(word);
  const target = units.map((unit) => unit.unitId);
  let order = createRng(spec.seed).shuffle(target);
  if (order.length > 1 && order.every((unitId, index) => unitId === target[index])) {
    order = [...order.slice(1), order[0]];
  }

  return {
    layout: 'reorder',
    slots: order.map((unitId, index) => ({
      slotId: `reorder:${index}`,
      index,
      unitId,
      accepts: /** @type {const} */ ('unit'),
    })),
    units,
    ...(spec.focus ? { focus: spec.focus } : {}),
    interactionHints: {
      allowTap: true,
      allowDrag: false,
      allowKeyboard: false,
      allowReorder: true,
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
function judgeReorder({ spec, renderModel, events, bundle, now = Date.now() }) {
  const word = getWord(bundle);
  const target = renderUnitsForWord(word).map((unit) => unit.unitId);
  const initial = renderModel.slots.map((slot) => slot.unitId);
  if (initial.some((unitId) => typeof unitId !== 'string')) {
    throw new Error('T-REORDER slots must be filled with unit ids');
  }
  const order = [...initial];

  for (const event of Array.isArray(events) ? events : []) {
    if (event.kind !== 'reorder') continue;
    const from = event.fromIndex;
    const to = event.toIndex;
    if (!Number.isInteger(from) || !Number.isInteger(to)
      || from < 0 || to < 0 || from >= order.length || to >= order.length) {
      throw new Error('T-REORDER received an out-of-range reorder event');
    }
    [order[from], order[to]] = [order[to], order[from]];
  }

  const wordCorrect = order.every((unitId, index) => unitId === target[index]);
  const focusIndexes = focusUnitIndexes(word, spec.focus);
  const focusCorrect = spec.focus
    ? focusIndexes.every((index) => order[index] === target[index])
    : undefined;

  if (wordCorrect) {
    return makeAttempt({ spec, wordCorrect: true, focusCorrect, firstError: null, now });
  }

  const mismatch = order.findIndex((unitId, index) => unitId !== target[index]);
  const position = mismatch < 0 ? 0 : mismatch;
  const actualText = order[position]
    ? renderUnitsForWord(word).find((unit) => unit.unitId === order[position])?.text ?? ''
    : '';
  return makeAttempt({
    spec,
    wordCorrect: false,
    focusCorrect,
    firstError: errorFor({
      type: 'TRANSPOSITION',
      word,
      unitIndex: position,
      expected: word.units[position]?.text ?? '',
      actual: actualText,
    }),
    now,
  });
}

export const { meta, build, judge } = defineQuestionType({
  id: 'T-REORDER',
  phase: 'P4',
  task: '打乱单位排成正确顺序',
  repairs: ['TRANSPOSITION'],
  build: buildType,
  judge: judgeReorder,
});

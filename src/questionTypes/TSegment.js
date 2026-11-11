/**
 * @layer questionTypes
 * @phase P4
 * @doc §3.4 9 个题型注册表
 *
 * T-SEGMENT：在字母间隙点切分点。正确边界来自人工 units；
 * 判定区分过度切分、切分不足与位置错。
 */

import { defineQuestionType } from './QuestionType.js';
import {
  assertFocusInWord,
  errorFor,
  getWord,
  makeAttempt,
  unitIndexAtChar,
} from './shared.js';

/**
 * @param {import('../core/contracts.js').QuestionSpec} spec
 * @param {import('./QuestionType.js').ResourceBundle} bundle
 * @returns {import('../core/contracts.js').RenderModel}
 */
function buildType(spec, bundle) {
  const word = getWord(bundle);
  assertFocusInWord(spec, bundle);
  const letters = [...word.text].map((text, index) => ({
    unitId: `letter:${index}`,
    text,
    kind: /** @type {const} */ ('letter'),
  }));
  return {
    layout: 'segment',
    slots: [],
    units: letters,
    fixedText: word.text,
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
 * @param {{units: {text: string}[], text: string}} word
 * @returns {number[]}
 */
function targetGaps(word) {
  const gaps = [];
  let cursor = 0;
  for (let index = 0; index < word.units.length - 1; index += 1) {
    cursor += word.units[index].text.length;
    gaps.push(cursor);
  }
  return gaps;
}

/**
 * @param {{
 *   spec: import('../core/contracts.js').QuestionSpec,
 *   events: import('../core/contracts.js').InputEvent[],
 *   bundle: import('./QuestionType.js').ResourceBundle,
 *   now?: number
 * }} context
 * @returns {import('../core/contracts.js').AttemptResult}
 */
function judgeSegment({ spec, events, bundle, now = Date.now() }) {
  const word = getWord(bundle);
  const target = new Set(targetGaps(word));
  const selected = new Set();
  for (const event of Array.isArray(events) ? events : []) {
    if (event.kind !== 'tap-gap') continue;
    const gapIndex = event.gapIndex;
    if (!Number.isInteger(gapIndex) || gapIndex <= 0 || gapIndex >= word.text.length) {
      throw new Error('T-SEGMENT received an out-of-range gap index');
    }
    selected.add(gapIndex);
  }

  const wordCorrect = selected.size === target.size
    && [...target].every((gap) => selected.has(gap));
  if (wordCorrect) {
    return makeAttempt({ spec, wordCorrect: true, firstError: null, now });
  }

  const extra = [...selected].filter((gap) => !target.has(gap)).sort((a, b) => a - b);
  const missing = [...target].filter((gap) => !selected.has(gap)).sort((a, b) => a - b);
  const type = extra.length > 0
    ? missing.length > 0 ? 'BOUNDARY_MISPLACED' : 'BOUNDARY_OVER_SEGMENT'
    : 'BOUNDARY_UNDER_SEGMENT';
  const gap = extra[0] ?? missing[0] ?? 1;
  const at = unitIndexAtChar(word, gap);
  const unit = word.units[at.index] ?? word.units[0];
  const expected = type === 'BOUNDARY_UNDER_SEGMENT'
    ? `${unit.text.slice(0, Math.max(0, gap - at.start))}|${unit.text.slice(Math.max(0, gap - at.start))}`
    : unit.text;
  const actual = type === 'BOUNDARY_OVER_SEGMENT' ? '|' : unit.text.replace('|', '');
  return makeAttempt({
    spec,
    wordCorrect: false,
    firstError: errorFor({
      type,
      word,
      unitIndex: at.index,
      expected,
      actual,
    }),
    now,
  });
}

export const { meta, build, judge } = defineQuestionType({
  id: 'T-SEGMENT',
  phase: 'P4',
  task: '字母间隙点切分点',
  repairs: ['BOUNDARY_OVER_SEGMENT', 'BOUNDARY_UNDER_SEGMENT', 'BOUNDARY_MISPLACED'],
  build: buildType,
  judge: judgeSegment,
});

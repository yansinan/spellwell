/**
 * @layer questionTypes
 * @phase P6
 * @doc §3.4 9 个题型注册表
 *
 * T-JUDGE-FIX：判断一个声称答案是否正确；判错时再改对。
 * 判断与修正分开记录，避免“猜对判断但不会拼”。
 */

import { ContractError } from '../core/errors.js';
import { defineQuestionType } from './QuestionType.js';
import { analyzeTyped, assertFocusInWord, getWord, makeAttempt } from './shared.js';

const DECISIONS = new Set(['judge:correct', 'judge:wrong']);

/**
 * @param {import('../core/contracts.js').QuestionSpec} spec
 * @param {import('./QuestionType.js').ResourceBundle} bundle
 * @returns {import('../core/contracts.js').RenderModel}
 */
function buildType(spec, bundle) {
  const word = getWord(bundle);
  assertFocusInWord(spec, bundle);
  const claim = typeof spec.params?.claim === 'string' && spec.params.claim.length > 0
    ? spec.params.claim
    : word.text;
  return {
    layout: 'judge',
    slots: [],
    units: [],
    fixedText: claim,
    ...(spec.focus ? { focus: spec.focus } : {}),
    interactionHints: {
      allowTap: true,
      allowDrag: false,
      allowKeyboard: true,
      allowReorder: false,
      allowEdit: true,
      keyboardScope: /** @type {const} */ ('word'),
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
function judgeJudgeFix({ spec, renderModel, events, bundle, now = Date.now() }) {
  const word = getWord(bundle);
  const list = Array.isArray(events) ? events : [];
  const decisionEvent = [...list].reverse().find(
    (event) => event.kind === 'tap-unit' && DECISIONS.has(event.unitId),
  );
  const claim = renderModel.fixedText ?? word.text;
  const claimCorrect = claim === word.text;
  const decision = decisionEvent?.unitId === 'judge:correct' ? 'correct' : decisionEvent?.unitId === 'judge:wrong' ? 'wrong' : null;

  if (!decision) {
    throw new ContractError('T-JUDGE-FIX_DECISION_REQUIRED', 'T-JUDGE-FIX needs a correct/wrong decision');
  }

  if (decision === 'correct' && claimCorrect) {
    return makeAttempt({ spec, wordCorrect: true, focusCorrect: true, firstError: null, now });
  }

  if (decision === 'wrong' && !claimCorrect) {
    const edit = [...list].reverse().find((event) => event.kind === 'edit' || event.kind === 'key-text');
    const text = typeof edit?.text === 'string' ? edit.text : '';
    const analysis = analyzeTyped({ word, typed: text, focus: spec.focus });
    return makeAttempt({
      spec,
      wordCorrect: analysis.wordCorrect,
      focusCorrect: analysis.focusCorrect,
      firstError: analysis.firstError,
      now,
    });
  }

  return makeAttempt({
    spec,
    wordCorrect: false,
    focusCorrect: false,
    firstError: {
      type: 'UNKNOWN',
      unitKind: 'grapheme',
      unitId: word.units[0].graphemeId,
      position: 0,
      expected: claimCorrect ? 'correct' : 'wrong',
      actual: decision,
    },
    now,
  });
}

export const { meta, build, judge } = defineQuestionType({
  id: 'T-JUDGE-FIX',
  phase: 'P6',
  task: '判断对错并改对',
  repairs: ['SUBSTITUTION', 'BOUNDARY_OVER_SEGMENT', 'BOUNDARY_UNDER_SEGMENT', 'BOUNDARY_MISPLACED'],
  build: buildType,
  judge: judgeJudgeFix,
});

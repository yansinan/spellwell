/**
 * @layer questionTypes
 * @phase P6
 * @doc §3.4 9 个题型注册表
 *
 * T-CLOZE：英文句子挖空，输入目标词。只做拼写输入，不做选项。
 */

import { ContractError } from '../core/errors.js';
import { defineQuestionType } from './QuestionType.js';
import { analyzeTyped, assertFocusInWord, getWord, makeAttempt } from './shared.js';

/**
 * @param {import('../core/contracts.js').QuestionSpec} spec
 * @param {import('./QuestionType.js').ResourceBundle} bundle
 * @returns {import('../core/contracts.js').RenderModel}
 */
function buildType(spec, bundle) {
  const word = getWord(bundle);
  assertFocusInWord(spec, bundle);
  const sentence = spec.params?.sentence;
  if (typeof sentence !== 'string' || sentence.trim().length === 0) {
    throw new ContractError('QUESTION_SPEC_INVALID', 'T-CLOZE needs params.sentence');
  }
  const blanked = sentence.replace(word.text, '____');
  return {
    layout: 'cloze',
    slots: [],
    units: [],
    fixedText: blanked,
    ...(spec.focus ? { focus: spec.focus } : {}),
    interactionHints: {
      allowTap: false,
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
 *   events: import('../core/contracts.js').InputEvent[],
 *   bundle: import('./QuestionType.js').ResourceBundle,
 *   now?: number
 * }} context
 * @returns {import('../core/contracts.js').AttemptResult}
 */
function judgeCloze({ spec, events, bundle, now = Date.now() }) {
  const word = getWord(bundle);
  const edits = (Array.isArray(events) ? events : [])
    .filter((event) => event.kind === 'edit' || event.kind === 'key-text');
  const last = edits[edits.length - 1];
  const text = typeof last?.text === 'string' ? last.text : '';
  const analysis = analyzeTyped({ word, typed: text, focus: spec.focus });
  return makeAttempt({
    spec,
    wordCorrect: analysis.wordCorrect,
    focusCorrect: analysis.focusCorrect,
    firstError: analysis.firstError,
    now,
  });
}

export const { meta, build, judge } = defineQuestionType({
  id: 'T-CLOZE',
  phase: 'P6',
  task: '英文句子挖空拼写',
  repairs: ['SUBSTITUTION', 'UNKNOWN'],
  build: buildType,
  judge: judgeCloze,
});

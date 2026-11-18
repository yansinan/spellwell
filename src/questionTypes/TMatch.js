/**
 * @layer questionTypes
 * @phase P5
 * @doc §3.4 9 个题型注册表
 *
 * T-MATCH：组合分类。给出一个组合，孩子点选包含该组合的词。
 * 不是四选一：可多选/可全不选，提交的是词集合。
 */

import { ContractError } from '../core/errors.js';
import { defineQuestionType } from './QuestionType.js';
import { assertFocusInWord, errorFor, getWord, makeAttempt } from './shared.js';

/**
 * @param {import('../core/contracts.js').QuestionSpec} spec
 * @param {import('./QuestionType.js').ResourceBundle} bundle
 * @returns {import('../core/contracts.js').RenderModel}
 */
function buildType(spec, bundle) {
  const word = getWord(bundle);
  assertFocusInWord(spec, bundle);
  const options = spec.params?.options;
  if (!Array.isArray(options) || options.length < 2) {
    throw new ContractError('QUESTION_SPEC_INVALID', 'T-MATCH needs at least two options');
  }
  const units = options.map((option, index) => {
    if (!option || typeof option.wordId !== 'string' || typeof option.text !== 'string') {
      throw new ContractError('QUESTION_SPEC_INVALID', `T-MATCH option ${index} is invalid`);
    }
    return {
      unitId: option.wordId,
      text: option.text,
    };
  });
  return {
    layout: 'match',
    slots: [],
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
function judgeMatch({ spec, renderModel, events, bundle, now = Date.now() }) {
  const word = getWord(bundle);
  const options = Array.isArray(spec.params?.options) ? spec.params.options : [];
  const correct = new Set(options.filter((option) => option.correct === true).map((option) => option.wordId));
  const selected = new Set();
  for (const event of Array.isArray(events) ? events : []) {
    if (event.kind === 'tap-unit' && typeof event.unitId === 'string') selected.add(event.unitId);
  }
  // 只要选中的词全部属于正确集合且至少选一个，就算完成；
  // 不再要求穷举所有包含 focus 的词，避免只选目标词被误判。
  const wordCorrect = selected.size > 0 && [...selected].every((id) => correct.has(id));
  if (wordCorrect) {
    return makeAttempt({ spec, wordCorrect: true, firstError: null, now });
  }
  const option = options.find((candidate) => candidate.wordId === [...selected][0])
    ?? options.find((candidate) => candidate.correct);
  return makeAttempt({
    spec,
    wordCorrect: false,
    firstError: errorFor({
      type: 'SUBSTITUTION',
      word,
      unitIndex: 0,
      expected: spec.focus?.id ?? word.units[0].text,
      actual: option?.text ?? '',
    }),
    now,
  });
}

export const { meta, build, judge } = defineQuestionType({
  id: 'T-MATCH',
  phase: 'P5',
  task: '组合与词例配对/分类',
  repairs: ['SUBSTITUTION', 'BOUNDARY_OVER_SEGMENT', 'BOUNDARY_UNDER_SEGMENT', 'BOUNDARY_MISPLACED'],
  build: buildType,
  judge: judgeMatch,
});

/**
 * @layer questionTypes
 * @phase P4
 * @doc §3.4 9 个题型注册表
 *
 * T-EDIT：给定一个带错的词，孩子插入/删除/替换/移动修成正确词。
 * build 只读取 spec.params.initialText；judge 复用整词输入分析。
 */

import { defineQuestionType } from './QuestionType.js';
import {
  analyzeTyped,
  assertFocusInWord,
  getWord,
  makeAttempt,
} from './shared.js';

/**
 * @param {import('../core/contracts.js').QuestionSpec} spec
 * @param {import('./QuestionType.js').ResourceBundle} bundle
 * @returns {import('../core/contracts.js').RenderModel}
 */
function buildType(spec, bundle) {
  const word = getWord(bundle);
  assertFocusInWord(spec, bundle);
  let initialText = spec.params?.initialText;
  if (typeof initialText !== 'string' || initialText.length === 0) {
    // 容错：没有注入错误文本时，至少交换前两个单位，避免“原词即答案”。
    const units = word.units.map((unit) => unit.text);
    if (units.length > 1) [units[0], units[1]] = [units[1], units[0]];
    initialText = units.join('');
  }
  if (initialText === word.text) initialText = `${word.text}!`;

  return {
    layout: 'edit',
    slots: [],
    units: [],
    fixedText: initialText,
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
 *   renderModel: import('../core/contracts.js').RenderModel,
 *   events: import('../core/contracts.js').InputEvent[],
 *   bundle: import('./QuestionType.js').ResourceBundle,
 *   now?: number
 * }} context
 * @returns {import('../core/contracts.js').AttemptResult}
 */
function judgeEdit({ spec, events, bundle, now = Date.now() }) {
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
  id: 'T-EDIT',
  phase: 'P4',
  task: '插入/删除/替换/移动修错词',
  repairs: ['OMISSION', 'SUBSTITUTION', 'TRANSPOSITION', 'EXTRA', 'SUFFIX_RULE'],
  build: buildType,
  judge: judgeEdit,
});

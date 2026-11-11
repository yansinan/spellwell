/**
 * @layer questionTypes
 * @phase P1
 * @doc §3.4 9 个题型注册表
 *
 * T-TYPE：QWERTY 整词输入。P1 只接收语义 InputEvent，不碰键盘 DOM。
 * 判定按 grapheme unit 定位遗漏/替换/多余/顺序错误。
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

  return {
    layout: 'type',
    slots: [],
    units: [],
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
 * 使用最后一个 key-text 作为当前整词内容；UI 在提交时发送完整输入值。
 * @param {{
 *   spec: import('../core/contracts.js').QuestionSpec,
 *   renderModel: import('../core/contracts.js').RenderModel,
 *   events: import('../core/contracts.js').InputEvent[],
 *   bundle: import('./QuestionType.js').ResourceBundle,
 *   now?: number
 * }} context
 * @returns {import('../core/contracts.js').AttemptResult}
 */
function judgeType({ spec, renderModel, events, bundle, now = Date.now() }) {
  const word = getWord(bundle);
  const keyEvents = (Array.isArray(events) ? events : []).filter((event) => event.kind === 'key-text');
  const last = keyEvents[keyEvents.length - 1];
  const typed = typeof last?.text === 'string' ? last.text : '';
  const analysis = analyzeTyped({ word, typed, focus: spec.focus });

  return makeAttempt({
    spec,
    wordCorrect: analysis.wordCorrect,
    focusCorrect: analysis.focusCorrect,
    firstError: analysis.firstError,
    now,
  });
}

export const { meta, build, judge } = defineQuestionType({
  id: 'T-TYPE',
  phase: 'P1',
  task: 'QWERTY 整词输入',
  repairs: ['UNKNOWN'],
  build: buildType,
  judge: judgeType,
});

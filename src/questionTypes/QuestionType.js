/**
 * @layer questionTypes
 * @phase P0
 * @doc §3.2 三层解耦架构
 *
 * 题型契约：只做 build/judge。
 * - build(spec, bundle) → RenderModel
 * - judge({ spec, renderModel, events, bundle, now }) → AttemptResult
 * 禁止查库、碰 DOM、写记忆状态、生成干扰项。
 */

import { ERROR_TYPES } from '../core/contracts.js';
import { ContractError, NotImplementedError } from '../core/errors.js';

export const QUESTION_TYPE_CONTRACT_VERSION = 1;

/**
 * @typedef {Object} ResourceBundle 由 UI/用例层从仓库取好后传入
 * @property {Record<string, unknown>} word
 * @property {Record<string, Record<string, unknown>>} graphemes key 为 graphemeId
 * @property {Record<string, unknown>[]} [sentences]
 */

/**
 * @typedef {Object} QuestionTypeMeta
 * @property {string} id
 * @property {string} phase
 * @property {string} task
 * @property {string[]} repairs ERROR_TYPES 的子集
 * @property {number} contractVersion
 */

/**
 * @param {{
 *   id: string,
 *   phase: string,
 *   task: string,
 *   repairs: string[],
 *   build: (spec: import('../core/contracts.js').QuestionSpec, bundle: ResourceBundle) => import('../core/contracts.js').RenderModel,
 *   judge: (context: {spec: import('../core/contracts.js').QuestionSpec, renderModel: import('../core/contracts.js').RenderModel, events: import('../core/contracts.js').InputEvent[], bundle: ResourceBundle, now?: number}) => import('../core/contracts.js').AttemptResult
 * }} definition
 * @returns {{meta: QuestionTypeMeta, build: Function, judge: Function}}
 */
export function defineQuestionType(definition) {
  const { id, phase, task, repairs, build, judge } = definition;
  if (typeof id !== 'string' || !/^T-[A-Z]+(?:-[A-Z]+)*$/.test(id)) {
    throw new ContractError('QUESTION_TYPE_INVALID', `invalid question type id: ${String(id)}`);
  }
  if (typeof phase !== 'string' || !/^P(?:10|[0-9])$/.test(phase)) {
    throw new ContractError('QUESTION_TYPE_INVALID', `invalid phase for ${id}: ${String(phase)}`);
  }
  if (typeof task !== 'string' || task.length === 0) {
    throw new ContractError('QUESTION_TYPE_INVALID', `${id} needs a task description`);
  }
  if (!Array.isArray(repairs) || repairs.length === 0) {
    throw new ContractError('QUESTION_TYPE_INVALID', `${id} needs at least one repair signal`);
  }
  for (const errorType of repairs) {
    if (!ERROR_TYPES.includes(errorType)) {
      throw new ContractError('QUESTION_TYPE_INVALID', `${id} has unknown repair signal ${errorType}`);
    }
  }
  if (typeof build !== 'function' || typeof judge !== 'function') {
    throw new ContractError('QUESTION_TYPE_INVALID', `${id} must provide build() and judge()`);
  }

  const meta = Object.freeze({
    id,
    phase,
    task,
    repairs: Object.freeze([...repairs]),
    contractVersion: QUESTION_TYPE_CONTRACT_VERSION,
  });
  return Object.freeze({ meta, build, judge });
}

/**
 * P0 骨架：meta 已冻结，build/judge 明确抛错，防止“看似可用”。
 * P1/P4/P5/P6 实现时改用 defineQuestionType。
 * @param {{id: string, phase: string, task: string, repairs: string[]}} definition
 * @returns {{meta: QuestionTypeMeta, build: Function, judge: Function}}
 */
export function createStubType(definition) {
  const { id, phase } = definition;
  return defineQuestionType({
    ...definition,
    build() {
      throw new NotImplementedError(phase, `${id}.build`);
    },
    judge() {
      throw new NotImplementedError(phase, `${id}.judge`);
    },
  });
}

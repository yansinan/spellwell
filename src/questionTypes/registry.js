/**
 * @layer questionTypes
 * @phase P0
 * @doc §3.4 9 个题型注册表
 *
 * 9 个题型的唯一注册表。注册表只暴露元数据与 build/judge，
 * 不提供任何存储/调度能力。
 */

import { ContractError } from '../core/errors.js';
import * as TSequence from './TSequence.js';
import * as TFill from './TFill.js';
import * as TReorder from './TReorder.js';
import * as TType from './TType.js';
import * as TJudgeFix from './TJudgeFix.js';
import * as TEdit from './TEdit.js';
import * as TMatch from './TMatch.js';
import * as TCloze from './TCloze.js';
import * as TSegment from './TSegment.js';

const MODULES = [TSequence, TFill, TReorder, TType, TJudgeFix, TEdit, TMatch, TCloze, TSegment];

/** DESIGN §3.4 的顺序；测试锁定，防止悄然增删题型。 */
export const EXPECTED_QUESTION_TYPE_IDS = Object.freeze([
  'T-SEQUENCE',
  'T-FILL',
  'T-REORDER',
  'T-TYPE',
  'T-JUDGE-FIX',
  'T-EDIT',
  'T-MATCH',
  'T-CLOZE',
  'T-SEGMENT',
]);

export const QUESTION_TYPE_IDS = Object.freeze(MODULES.map((module) => module.meta.id));

/** @type {Map<string, typeof MODULES[number]>} */
const MODULE_BY_ID = new Map(MODULES.map((module) => [module.meta.id, module]));

export function assertRegistry() {
  if (QUESTION_TYPE_IDS.length !== EXPECTED_QUESTION_TYPE_IDS.length) {
    throw new ContractError(
      'QUESTION_REGISTRY_INVALID',
      `expected ${EXPECTED_QUESTION_TYPE_IDS.length} question types, got ${QUESTION_TYPE_IDS.length}`,
    );
  }
  for (const [index, expectedId] of EXPECTED_QUESTION_TYPE_IDS.entries()) {
    if (QUESTION_TYPE_IDS[index] !== expectedId) {
      throw new ContractError(
        'QUESTION_REGISTRY_INVALID',
        `question type at ${index} must be ${expectedId}, got ${QUESTION_TYPE_IDS[index]}`,
      );
    }
  }
  if (MODULE_BY_ID.size !== MODULES.length) {
    throw new ContractError('QUESTION_REGISTRY_INVALID', 'duplicate question type id');
  }
  for (const module of MODULES) {
    if (typeof module.build !== 'function' || typeof module.judge !== 'function') {
      throw new ContractError('QUESTION_REGISTRY_INVALID', `${module.meta.id} is missing build/judge`);
    }
  }
  return true;
}

// 模块加载即校验：注册表坏了，应用不应该启动。
assertRegistry();

/**
 * @returns {import('./QuestionType.js').QuestionTypeMeta[]}
 */
export function listQuestionTypes() {
  return QUESTION_TYPE_IDS.map((id) => /** @type {any} */ (MODULE_BY_ID.get(id)).meta);
}

/**
 * @param {string} id
 * @returns {{meta: import('./QuestionType.js').QuestionTypeMeta, build: Function, judge: Function}}
 */
export function getQuestionType(id) {
  const module = MODULE_BY_ID.get(id);
  if (!module) {
    throw new ContractError('QUESTION_TYPE_UNKNOWN', `unknown question type: ${id}`, { id });
  }
  return /** @type {any} */ (module);
}

/**
 * @param {string} errorType
 * @returns {string[]}
 */
export function getQuestionTypesByRepair(errorType) {
  return MODULES
    .filter((module) => module.meta.repairs.includes(errorType))
    .map((module) => module.meta.id);
}

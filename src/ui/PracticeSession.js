/**
 * @layer ui
 * @phase P1
 * @doc §2.1 孩子端（学习模块）
 *
 * P1 的最小练习会话：3 个词 × 3 个题型，规格与判定全部在内存中完成。
 * 不写 wordStates/graphemeStates/attempts，不接 IndexedDB；P3 才交给 Scheduler。
 */

import {
  validateAttemptResult,
  validateQuestionSpec,
  validateRenderModel,
} from '../core/contracts.js';
import { ContractError } from '../core/errors.js';
import { createRng, hashSeed } from '../core/seedRandom.js';
import { getQuestionType } from '../questionTypes/registry.js';

export const PRACTICE_TYPE_ROTATION = Object.freeze(['T-SEQUENCE', 'T-FILL', 'T-TYPE']);

/**
 * @param {{id: string, text: string, units: {text: string, graphemeId: string}[]}} word
 * @returns {number}
 */
function chooseFocusIndex(word) {
  const multi = word.units
    .map((unit, index) => ({ unit, index }))
    .filter((entry) => entry.unit.text.length > 1);
  return (multi[0] ?? { index: word.units.length - 1 }).index;
}

/**
 * 从组合池里选一个不在目标词中的组合，作为 P1 的演示干扰项。
 * 真正的按错误画像抽干扰项属于 P3 Scheduler。
 * @param {{id: string, text: string, units: {text: string, graphemeId: string}[]}} word
 * @param {{id: string, text: string}[]} pool
 * @param {number|string} seed
 * @returns {string[]}
 */
function chooseDistractorIds(word, pool, seed) {
  const usedIds = new Set(word.units.map((unit) => unit.graphemeId));
  const usedTexts = new Set(word.units.map((unit) => unit.text));
  const candidates = pool.filter(
    (grapheme) => !usedIds.has(grapheme.id) && !usedTexts.has(grapheme.text),
  );
  if (candidates.length === 0) return [];
  const multi = candidates.filter((grapheme) => grapheme.text.length > 1);
  const pickFrom = multi.length > 0 ? multi : candidates;
  return [createRng(hashSeed(`${word.id}|distractor|${seed}`)).pick(pickFrom).id];
}

/**
 * @param {{
 *   bundles: import('../questionTypes/QuestionType.js').ResourceBundle[],
 *   distractorPool?: {id: string, text: string}[],
 *   seed?: number|string
 * }} input
 * @returns {import('../core/contracts.js').QuestionSpec[]}
 */
export function buildPracticeSpecs({ bundles, distractorPool = [], seed = 20261111 }) {
  if (!Array.isArray(bundles) || bundles.length === 0) {
    throw new ContractError('PRACTICE_CONTENT_INVALID', 'at least one word bundle is required');
  }
  if (!Array.isArray(distractorPool)) {
    throw new ContractError('PRACTICE_CONTENT_INVALID', 'distractorPool must be an array');
  }

  /** @type {import('../core/contracts.js').QuestionSpec[]} */
  const specs = [];
  bundles.forEach((bundle, wordIndex) => {
    const word = bundle.word;
    if (!word || !Array.isArray(word.units) || word.units.length === 0) {
      throw new ContractError('PRACTICE_CONTENT_INVALID', `bundle ${wordIndex} has no valid word`);
    }
    const focusIndex = chooseFocusIndex(word);
    const focusUnit = word.units[focusIndex];
    const distractors = chooseDistractorIds(word, distractorPool, seed);

    PRACTICE_TYPE_ROTATION.forEach((_, typeIndex) => {
      const typeId = PRACTICE_TYPE_ROTATION[(typeIndex + wordIndex) % PRACTICE_TYPE_ROTATION.length];
      const params = typeId === 'T-SEQUENCE'
        ? { distractorGraphemeIds: distractors }
        : typeId === 'T-FILL'
          ? { blankUnitIndex: focusIndex, distractorGraphemeIds: distractors }
          : {};

      const spec = {
        specId: `spec.${word.id}.${typeId}.${wordIndex}.${typeIndex}`,
        typeId,
        target: { kind: /** @type {const} */ ('word'), id: word.id },
        focus: { kind: /** @type {const} */ ('grapheme'), id: focusUnit.graphemeId },
        params,
        resourceHints: {
          wordIds: [word.id],
          graphemeIds: [...new Set([
            ...word.units.map((unit) => unit.graphemeId),
            ...distractors,
          ])],
        },
        seed: hashSeed(`${seed}|${word.id}|${typeId}|${wordIndex}|${typeIndex}`),
      };
      validateQuestionSpec(spec);
      specs.push(spec);
    });
  });
  return specs;
}

export class PracticeSession {
  /** @type {import('../core/contracts.js').QuestionSpec[]} */
  #specs;

  /** @type {Map<string, import('../questionTypes/QuestionType.js').ResourceBundle>} */
  #bundles = new Map();

  #index = 0;
  #results = [];
  #now;
  #current = null;
  #submittedIndex = -1;

  /**
   * @param {{
   *   bundles: import('../questionTypes/QuestionType.js').ResourceBundle[],
   *   distractorPool?: {id: string, text: string}[],
   *   seed?: number|string,
   *   specs?: import('../core/contracts.js').QuestionSpec[],
   *   now?: () => number
   * }} input
   */
  constructor({ bundles, distractorPool = [], seed = 20261111, specs, now = () => Date.now() }) {
    if (specs !== undefined && (!Array.isArray(specs) || specs.length === 0)) {
      throw new ContractError('PRACTICE_CONTENT_INVALID', 'specs must be a non-empty array');
    }
    this.#specs = specs ? [...specs] : buildPracticeSpecs({ bundles, distractorPool, seed });
    this.#now = now;
    for (const bundle of bundles) {
      const wordId = bundle.word?.id;
      if (typeof wordId !== 'string' || this.#bundles.has(wordId)) {
        throw new ContractError('PRACTICE_CONTENT_INVALID', 'bundles must have unique word ids');
      }
      this.#bundles.set(wordId, bundle);
    }
  }

  /** @returns {number} */
  get size() {
    return this.#specs.length;
  }

  /** @returns {number} */
  get currentIndex() {
    return this.#index;
  }

  /** @returns {import('../core/contracts.js').QuestionSpec[]} */
  get specs() {
    return [...this.#specs];
  }

  /** @returns {import('../core/contracts.js').AttemptResult[]} */
  get results() {
    return [...this.#results];
  }

  /** @returns {boolean} */
  get isComplete() {
    return this.#index >= this.#specs.length;
  }

  /**
   * @returns {{
   *   spec: import('../core/contracts.js').QuestionSpec,
   *   bundle: import('../questionTypes/QuestionType.js').ResourceBundle,
   *   renderModel: import('../core/contracts.js').RenderModel
   * }}
   */
  buildCurrent() {
    if (this.isComplete) {
      throw new ContractError('PRACTICE_COMPLETE', 'the practice session is complete');
    }
    if (this.#current) return this.#current;

    const spec = this.#specs[this.#index];
    const bundle = this.#bundles.get(spec.target.id);
    if (!bundle) {
      throw new ContractError('PRACTICE_CONTENT_INVALID', `missing bundle for ${spec.target.id}`);
    }
    const { build } = getQuestionType(spec.typeId);
    const renderModel = build(spec, bundle);
    validateRenderModel(renderModel);
    this.#current = { spec, bundle, renderModel };
    return this.#current;
  }

  /**
   * @param {import('../core/contracts.js').InputEvent[]} events
   * @returns {import('../core/contracts.js').AttemptResult}
   */
  submit(events, { record = true } = {}) {
    if (this.isComplete) {
      throw new ContractError('PRACTICE_COMPLETE', 'the practice session is complete');
    }
    if (this.#submittedIndex === this.#index) {
      throw new ContractError('PRACTICE_ALREADY_SUBMITTED', 'this question was already submitted');
    }
    const current = this.buildCurrent();
    const { judge } = getQuestionType(current.spec.typeId);
    const result = judge({
      spec: current.spec,
      renderModel: current.renderModel,
      events,
      bundle: current.bundle,
      now: this.#now(),
    });
    validateAttemptResult(result);
    if (record) this.#results.push(result);
    this.#submittedIndex = this.#index;
    return result;
  }

  /** 允许同一题在答错后重试；不追加 session results。 */
  retry() {
    if (this.isComplete) return;
    this.#submittedIndex = -1;
  }

  /**
   * @param {string} wordId
   * @returns {string}
   */
  getWordText(wordId) {
    return String(this.#bundles.get(String(wordId))?.word?.text ?? String(wordId).replace(/^w\./, ''));
  }

  /**
   * @returns {boolean} 是否已到末尾
   */
  advance() {
    if (this.isComplete) return true;
    if (this.#submittedIndex !== this.#index) {
      throw new ContractError('PRACTICE_NOT_SUBMITTED', 'submit before advancing');
    }
    this.#index += 1;
    this.#current = null;
    this.#submittedIndex = -1;
    return this.isComplete;
  }

  /** 原地重开一轮，不持久化任何记录。 */
  restart() {
    this.#index = 0;
    this.#results = [];
    this.#current = null;
    this.#submittedIndex = -1;
  }
}

/**
 * @layer scheduler
 * @phase P3
 * @doc §1.3 记忆曲线是调度器，不是装饰
 *
 * 每日队列与尝试记录：
 * - 5—8 个词：昨日错词/错误画像优先，其次到期复习，再补新词；
 * - 答错降档并排到次日；
 * - 按错误类型选择修复题型（P3 只开放 P1 三题型）。
 * 调度层不渲染、不判定、不依赖 DOM。
 */

import { validateAttemptResult, validateQuestionSpec } from '../core/contracts.js';
import { ContractError } from '../core/errors.js';
import { isDayKey, toDayKey } from '../core/time.js';
import { createRng, hashSeed } from '../core/seedRandom.js';
import { applyWordReview, dueDateFor, isProbeEligible, nextReview } from './IntervalPolicy.js';
import { appendErrorProfile } from './ErrorProfile.js';
import { P4_AVAILABLE_TYPES, buildWordSpec } from './QuestionSpecBuilder.js';
import { NEW_WORD_ROTATION, candidatesForError } from './TypeSelector.js';

export const MIN_QUEUE_SIZE = 5;
export const MAX_QUEUE_SIZE = 8;
export const DEFAULT_QUEUE_SIZE = 6;

/** @param {unknown} size */
function normalizeSize(size) {
  if (size === undefined) return DEFAULT_QUEUE_SIZE;
  if (!Number.isInteger(size) || size < MIN_QUEUE_SIZE || size > MAX_QUEUE_SIZE) {
    throw new RangeError(`queue size must be ${MIN_QUEUE_SIZE}..${MAX_QUEUE_SIZE}`);
  }
  return size;
}

/** @param {string} a @param {string} b */
function compareStrings(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * @param {import('../core/contracts.js').WordState} state
 * @param {string} today
 */
function isDue(state, today) {
  return state.status !== 'mastered'
    && typeof state.dueDate === 'string'
    && state.dueDate <= today;
}

export class Scheduler {
  /**
   * @param {{
   *   wordRepository: import('../repositories/WordRepository.js').WordRepository,
   *   stateRepository: import('../repositories/StateRepository.js').StateRepository,
   *   attemptRepository: import('../repositories/AttemptRepository.js').AttemptRepository,
   *   graphemeMap?: Record<string, {id: string, text: string, tier?: string}>,
   *   distractorPool?: {id: string, text: string}[],
   *   seed?: number|string,
   *   size?: number,
   *   now?: () => Date
   * }} deps
   */
  constructor(deps) {
    if (!deps?.wordRepository || !deps?.stateRepository || !deps?.attemptRepository) {
      throw new ContractError('SCHEDULER_DEPS_INVALID', 'scheduler needs word/state/attempt repositories');
    }
    this.wordRepository = deps.wordRepository;
    this.stateRepository = deps.stateRepository;
    this.attemptRepository = deps.attemptRepository;
    this.graphemeMap = deps.graphemeMap ?? {};
    this.distractorPool = deps.distractorPool ?? [];
    this.seed = deps.seed ?? 20261111;
    this.size = normalizeSize(deps.size);
    this.now = deps.now ?? (() => new Date());
  }

  /**
   * 每天最多 1 个组合强化：选一个到期组合，构造 T-MATCH 分类题。
   * @param {string} today
   * @param {number|string} seed
   * @returns {Promise<import('../core/contracts.js').QuestionSpec|null>}
   */
  async #buildGraphemeDrill(today, seed) {
    const due = await this.stateRepository.listDueGraphemes(today);
    if (due.length === 0) return null;
    const words = await this.wordRepository.all();

    for (const state of due) {
      const grapheme = this.graphemeMap[state.graphemeId];
      if (!grapheme) continue;
      const containing = words.filter((word) => word.units.some((unit) => unit.graphemeId === state.graphemeId));
      if (containing.length < 2) continue;
      const correctWords = containing.slice(0, 3);
      const distractors = words
        .filter((word) => !containing.some((item) => item.id === word.id))
        .slice(0, 2);
      if (distractors.length === 0) continue;

      const options = [
        ...correctWords.map((word) => ({ wordId: String(word.id), text: String(word.text), correct: true })),
        ...distractors.map((word) => ({ wordId: String(word.id), text: String(word.text), correct: false })),
      ];
      const order = createRng(`${seed}|match|${state.graphemeId}`).shuffle(options);
      const target = correctWords[0];
      const spec = {
        specId: `spec.match.${state.graphemeId}.${today}`,
        typeId: 'T-MATCH',
        target: { kind: /** @type {const} */ ('word'), id: String(target.id) },
        focus: { kind: /** @type {const} */ ('grapheme'), id: state.graphemeId },
        params: {
          options: order,
          focusText: grapheme.text,
        },
        resourceHints: {
          wordIds: order.map((option) => option.wordId),
          graphemeIds: [state.graphemeId],
        },
        seed: hashSeed(`${seed}|match|${state.graphemeId}|${today}`),
      };
      validateQuestionSpec(spec);
      return spec;
    }
    return null;
  }

  /**
   * @param {{date?: string, size?: number, seed?: number|string}} [options]
   * @returns {Promise<import('../core/contracts.js').QuestionSpec[]>}
   */
  async buildDailyQueue(options = {}) {
    const now = this.now();
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
      throw new ContractError('SCHEDULER_CLOCK_INVALID', 'now must return a valid Date');
    }
    const today = options.date ?? toDayKey(now);
    if (!isDayKey(today)) throw new RangeError(`invalid date: ${String(today)}`);
    const target = normalizeSize(options.size ?? this.size);
    const seed = options.seed ?? this.seed;

    const words = await this.wordRepository.all();
    if (words.length === 0) {
      throw new ContractError('SCHEDULER_CONTENT_EMPTY', 'no words available for the daily queue');
    }
    const states = await this.stateRepository.listWordStates();
    const stateByWord = new Map(states.map((state) => [state.wordId, state]));

    const due = states
      .filter((state) => isDue(state, today))
      .sort((a, b) => {
        const dateCompare = compareStrings(String(a.dueDate), String(b.dueDate));
        return dateCompare !== 0 ? dateCompare : compareStrings(a.wordId, b.wordId);
      });
    const dueErrors = due.filter(
      (state) => state.lastResult === 'wrong' || state.errorProfile.length > 0,
    );
    const dueReviews = due.filter(
      (state) => state.lastResult !== 'wrong' && state.errorProfile.length === 0,
    );
    const newWords = words.filter((word) => !stateByWord.has(String(word.id)));
    const fillers = words
      .filter((word) => stateByWord.get(String(word.id))?.status !== 'mastered')
      .sort((a, b) => {
        const left = stateByWord.get(String(a.id));
        const right = stateByWord.get(String(b.id));
        const dateCompare = compareStrings(String(left?.dueDate ?? ''), String(right?.dueDate ?? ''));
        return dateCompare !== 0 ? dateCompare : compareStrings(String(a.id), String(b.id));
      });

    /** @type {Record<string, unknown>[]} */
    const selected = [];
    const seen = new Set();
    const push = (word) => {
      if (!word || selected.length >= target) return;
      const id = String(word.id);
      if (seen.has(id)) return;
      seen.add(id);
      selected.push(word);
    };

    for (const state of dueErrors) {
      push(words.find((word) => String(word.id) === state.wordId));
    }
    for (const state of dueReviews) {
      push(words.find((word) => String(word.id) === state.wordId));
    }
    for (const word of newWords) push(word);
    for (const word of fillers) push(word);
    for (const word of words) push(word);

    if (selected.length === 0) {
      throw new ContractError('SCHEDULER_QUEUE_EMPTY', 'daily queue has no words');
    }

    const specs = selected.map((word, index) => {
      const state = stateByWord.get(String(word.id));
      const latestError = state?.errorProfile?.at(-1);
      let typeId = latestError
        ? candidatesForError(latestError.type).find((candidate) => P4_AVAILABLE_TYPES.includes(candidate))
        : NEW_WORD_ROTATION[index % NEW_WORD_ROTATION.length];
      if (!typeId || !P4_AVAILABLE_TYPES.includes(typeId)) {
        typeId = NEW_WORD_ROTATION[index % NEW_WORD_ROTATION.length];
      }

      return buildWordSpec({
        word: /** @type {{id: string, text: string, units: {text: string, graphemeId: string}[]}} */ (word),
        typeId,
        graphemeMap: this.graphemeMap,
        distractorPool: this.distractorPool,
        seed,
        errorType: latestError?.type,
        specId: `spec.daily.${String(word.id)}.${typeId}.${index}`,
      });
    });
    const drill = await this.#buildGraphemeDrill(today, seed);
    if (drill && specs.length < MAX_QUEUE_SIZE) specs.push(drill);
    return specs;
  }

  /**
   * @param {import('../core/contracts.js').AttemptResult} result
   * @returns {Promise<import('../core/contracts.js').WordState>}
   */
  async recordAttempt(result) {
    validateAttemptResult(result);
    const now = this.now();
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
      throw new ContractError('SCHEDULER_CLOCK_INVALID', 'now must return a valid Date');
    }

    const state = await this.stateRepository.getWordState(result.wordId);
    const next = applyWordReview(state, result.wordCorrect, now);
    const latestError = result.firstError ?? null;
    next.errorProfile = result.wordCorrect
      ? []
      : latestError
        ? appendErrorProfile(state.errorProfile, latestError)
        : [...state.errorProfile];
    next.status = result.wordCorrect
      ? next.consecutiveCorrect >= 2 ? 'reviewing' : 'learning'
      : 'learning';
    await this.stateRepository.saveWordState(next);

    const word = await this.wordRepository.get(result.wordId);
    const units = Array.isArray(word?.units) ? word.units : [];
    const touched = result.wordCorrect
      ? units
      : units.filter((unit) => unit.graphemeId === result.firstError?.unitId);
    const seen = new Set();
    for (const unit of touched) {
      if (!unit?.graphemeId || seen.has(unit.graphemeId)) continue;
      seen.add(unit.graphemeId);
      const before = await this.stateRepository.getGraphemeState(unit.graphemeId);
      const review = nextReview(before, result.wordCorrect);
      const wordsPassed = result.wordCorrect
        ? [...new Set([...before.wordsPassed, result.wordId])]
        : before.wordsPassed;
      const status = result.wordCorrect
        ? isProbeEligible({ consecutiveCorrect: review.consecutiveCorrect, wordsPassed })
          ? 'probe'
          : review.consecutiveCorrect > 0 ? 'reviewing' : 'learning'
        : 'learning';
      await this.stateRepository.saveGraphemeState({
        ...before,
        ...review,
        wordsPassed,
        status,
        dueDate: dueDateFor(review.intervalIndex, now),
        updatedAt: now.toISOString(),
      });
    }

    await this.attemptRepository.record(result);
    return next;
  }
}

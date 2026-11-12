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
import { addDays, isDayKey, toDayKey } from '../core/time.js';
import { createRng, hashSeed } from '../core/seedRandom.js';
import { confusableGraphemes } from './ConfusableGraphemes.js';
import { buildErrorHistory, historicalActuals, historicalErrorsForWord } from './ErrorHistory.js';
import { variedType } from './TypeVariety.js';
import {
  applyWordReview,
  dueDateFor,
  isProbeEligible,
  MAX_INTERVAL_INDEX,
  nextReview,
  PROBE_INTERVAL_DAYS,
} from './IntervalPolicy.js';
import { appendErrorProfile } from './ErrorProfile.js';
import { P4_AVAILABLE_TYPES, P6_AVAILABLE_TYPES, buildWordSpec } from './QuestionSpecBuilder.js';
import { NEW_WORD_ROTATION, candidatesForError } from './TypeSelector.js';
import { calibrateWeights, scoreWord } from './SelectionWeights.js';

export const MIN_QUEUE_SIZE = 5;
export const MAX_QUEUE_SIZE = 30;
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
    this.sentences = deps.sentences ?? {};
    this.seed = deps.seed ?? 20261111;
    this.size = normalizeSize(deps.size);
    this.now = deps.now ?? (() => new Date());
  }

  /**
   * 每天最多 1 个组合强化：选一个到期组合，构造 T-MATCH 分类题。
   * @param {string} today
   * @param {number|string} seed
   * @param {Record<string, any>[]} words
   * @returns {Promise<import('../core/contracts.js').QuestionSpec|null>}
   */
  async #buildGraphemeDrill(today, seed, words, errorHistory = null) {
    const due = await this.stateRepository.listDueGraphemes(today);
    if (due.length === 0) return null;

    for (const state of due) {
      const grapheme = this.graphemeMap[state.graphemeId];
      if (!grapheme) continue;
      const containing = words.filter((word) => word.units.some((unit) => unit.graphemeId === state.graphemeId));
      if (containing.length < 2) continue;
      const correctWords = containing.slice(0, 3);
      const historyTexts = new Set(historicalActuals(errorHistory, { expected: grapheme.text }, 2));
      const similarIds = new Set([
        ...confusableGraphemes(grapheme.text, this.distractorPool).map((item) => item.id),
        ...this.distractorPool.filter((item) => historyTexts.has(item.text)).map((item) => item.id),
      ]);
      const available = words.filter((word) => !containing.some((item) => item.id === word.id));
      const similarWords = available.filter((word) => word.units.some((unit) => similarIds.has(unit.graphemeId)));
      const distractors = [...similarWords, ...available.filter((word) => !similarWords.includes(word))].slice(0, 2);
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
    const mode = options.mode ?? 'review';
    if (mode !== 'review' && mode !== 'effort') {
      throw new RangeError('mode must be review or effort');
    }
    const unitFilter = Array.isArray(options.units) && options.units.length > 0
      ? new Set(options.units.map(String))
      : null;

    const allWords = await this.wordRepository.all();
    const words = allWords.filter((word) => {
      if (word.reviewStatus === 'retired') return false;
      if (unitFilter && !unitFilter.has(String(word.unitId ?? `level-${word.level ?? 1}`))) return false;
      return true;
    });
    if (words.length === 0) {
      throw new ContractError('SCHEDULER_CONTENT_EMPTY', 'no active words available for the daily queue');
    }
    const states = (await this.stateRepository.listWordStates())
      .filter((state) => state.status !== 'unstarted');
    const stateByWord = new Map(states.map((state) => [state.wordId, state]));
    const attempts = this.attemptRepository?.recent ? await this.attemptRepository.recent(1000) : [];
    const historyAttempts = this.attemptRepository?.all ? await this.attemptRepository.all() : attempts;
    const errorHistory = buildErrorHistory(historyAttempts);
    const weights = calibrateWeights(attempts);
    const scoreFor = (word) => scoreWord({
      word,
      state: stateByWord.get(String(word.id)),
      weights,
      today,
      mode,
    });

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
    const byScore = (a, b) => {
      const diff = scoreFor(b) - scoreFor(a);
      return diff !== 0 ? diff : compareStrings(String(a.id), String(b.id));
    };
    const byUnit = (a, b) => {
      const grade = Number(a.grade ?? 0) - Number(b.grade ?? 0);
      if (grade !== 0) return grade;
      const term = String(a.term ?? '上') === String(b.term ?? '上') ? 0 : String(a.term) === '上' ? -1 : 1;
      if (term !== 0) return term;
      const unit = Number(a.unit ?? 0) - Number(b.unit ?? 0);
      return unit !== 0 ? unit : compareStrings(String(a.id), String(b.id));
    };
    const newWords = words
      .filter((word) => !stateByWord.has(String(word.id)))
      .sort((a, b) => {
        const score = scoreFor(b) - scoreFor(a);
        return score !== 0 ? score : byUnit(a, b);
      });
    const fillers = words
      .filter((word) => {
        const state = stateByWord.get(String(word.id));
        return state && state.status !== 'mastered';
      })
      .sort(byScore);

    /** @type {Record<string, unknown>[]} */
    const selected = [];
    const seen = new Set();
    const phaseByWord = new Map();
    const push = (word, phase) => {
      if (!word || selected.length >= target) return;
      const id = String(word.id);
      if (seen.has(id)) return;
      seen.add(id);
      selected.push(word);
      phaseByWord.set(id, phase);
    };

    // 稳定教学顺序：修复 → 复习 → 新词 → 巩固。
    for (const state of dueErrors) {
      push(words.find((word) => String(word.id) === state.wordId), 'repair');
    }
    for (const state of dueReviews) {
      push(words.find((word) => String(word.id) === state.wordId), 'review');
    }
    for (const word of newWords) push(word, 'new');
    for (const word of fillers) push(word, 'practice');
    for (const word of words) push(word, 'practice');

    if (selected.length === 0) {
      throw new ContractError('SCHEDULER_QUEUE_EMPTY', 'daily queue has no words');
    }

    const specs = selected.map((word, index) => {
      const state = stateByWord.get(String(word.id));
      const latestError = state?.errorProfile?.at(-1);
      const sentence = this.sentences[String(word.id)] ?? null;
      const ownHistory = historicalErrorsForWord(errorHistory, word.id).filter((error) =>
        word.units.some((unit) => (error.unitId && unit.graphemeId === error.unitId)
          || unit.text === error.expected));
      const phase = phaseByWord.get(String(word.id)) ?? 'practice';
      let typeId;
      let typeReason;
      if (state?.status === 'probe') {
        typeId = sentence ? 'T-CLOZE' : ownHistory.length > 0 ? 'T-JUDGE-FIX' : 'T-TYPE';
        typeReason = ownHistory.length > 0 ? 'probe:history' : 'probe:recall';
      } else if (latestError) {
        typeId = candidatesForError(latestError.type).find((candidate) => P4_AVAILABLE_TYPES.includes(candidate));
        typeReason = 'repair';
      } else if (phase === 'new') {
        typeId = variedType({ phase, mode, index, seed });
        typeReason = 'new:build';
      } else if (phase === 'review') {
        typeId = variedType({
          phase,
          intervalIndex: Number(state?.intervalIndex ?? 0),
          mode,
          index,
          seed,
        });
        typeReason = 'review:varied';
      } else {
        typeId = variedType({
          phase: 'practice',
          intervalIndex: Number(state?.intervalIndex ?? 0),
          mode,
          index,
          seed,
        });
        typeReason = 'practice:varied';
      }
      if (!typeId || !P6_AVAILABLE_TYPES.includes(typeId)) {
        typeId = NEW_WORD_ROTATION[index % NEW_WORD_ROTATION.length];
        typeReason = 'fallback';
      }

      const spec = buildWordSpec({
        word: /** @type {{id: string, text: string, units: {text: string, graphemeId: string}[]}} */ (word),
        typeId,
        graphemeMap: this.graphemeMap,
        distractorPool: this.distractorPool,
        seed,
        errorType: latestError?.type,
        sentence,
        errorHistory,
        specId: `spec.daily.${String(word.id)}.${typeId}.${index}`,
      });
      const reason = state?.status === 'probe'
        ? 'probe'
        : latestError
          ? `due-error:${latestError.type}`
          : state
            ? (typeof state.dueDate === 'string' && state.dueDate <= today ? 'due-review' : 'filler')
            : 'new-word';
      spec.params.plan = {
        reason,
        phase,
        typeReason,
        mode,
        policyVersion: 1,
        score: scoreFor(word),
        calibration: {
          sampleSize: weights.sampleSize,
          globalErrorRate: Number(weights.globalErrorRate.toFixed(4)),
          wordErrorRate: Number((weights.byWord[String(word.id)]?.errorRate ?? weights.priorErrorRate).toFixed(4)),
        },
      };
      return spec;
    });
    const drill = await this.#buildGraphemeDrill(today, seed, words, errorHistory);
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
    if (state.status === 'probe') {
      next.status = result.wordCorrect ? 'mastered' : 'learning';
      next.intervalIndex = result.wordCorrect ? next.intervalIndex : 0;
      next.dueDate = result.wordCorrect
        ? null
        : addDays(toDayKey(now), 1);
    } else if (result.wordCorrect && next.intervalIndex === MAX_INTERVAL_INDEX && next.consecutiveCorrect >= 3) {
      next.status = 'probe';
      next.dueDate = addDays(toDayKey(now), PROBE_INTERVAL_DAYS);
    } else {
      next.status = result.wordCorrect
        ? next.consecutiveCorrect >= 2 ? 'reviewing' : 'learning'
        : 'learning';
    }
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

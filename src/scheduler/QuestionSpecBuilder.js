/**
 * @layer scheduler
 * @phase P3
 * @doc §3.4 9 个题型注册表 / §3.5 难度梯度
 *
 * 为单个词构造一条 QuestionSpec。只做数据装配，不 build/judge、不读写库。
 */

import { ContractError } from '../core/errors.js';
import { validateQuestionSpec } from '../core/contracts.js';
import { createRng, hashSeed } from '../core/seedRandom.js';

export const P1_AVAILABLE_TYPES = Object.freeze(['T-SEQUENCE', 'T-FILL', 'T-TYPE']);
export const P4_AVAILABLE_TYPES = Object.freeze([...P1_AVAILABLE_TYPES, 'T-REORDER', 'T-EDIT', 'T-SEGMENT']);
export const P6_AVAILABLE_TYPES = Object.freeze([...P4_AVAILABLE_TYPES, 'T-JUDGE-FIX', 'T-CLOZE']);

/**
 * @param {{units: {text: string, graphemeId: string}[]}} word
 * @returns {number}
 */
export function chooseFocusIndex(word) {
  const multi = word.units
    .map((unit, index) => ({ unit, index }))
    .filter((entry) => entry.unit.text.length > 1);
  return (multi[0] ?? { index: word.units.length - 1 }).index;
}

/**
 * @param {{id: string, units: {text: string, graphemeId: string}[]}} word
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
 * @param {string} typeId
 * @returns {'fill'|'sequence'|'type'}
 */
function scaffoldOf(typeId) {
  if (typeId === 'T-FILL' || typeId === 'T-SEGMENT') return 'fill';
  if (typeId === 'T-SEQUENCE' || typeId === 'T-REORDER') return 'sequence';
  return 'type';
}

/**
 * @param {string|undefined} tier
 * @returns {number}
 */
function tierNumber(tier) {
  const match = /^T([1-4])$/.exec(tier ?? '');
  return match ? Number(match[1]) : 1;
}

/**
 * 构造 T-EDIT 的错词文本。只使用 spec 提供的错误类型与候选池，不自动推断切分。
 * @param {{
 *   word: {text: string, units: {text: string, graphemeId: string}[]},
 *   focusIndex: number,
 *   errorType?: string,
 *   distractorPool?: {id: string, text: string}[]
 * }} input
 * @returns {string}
 */
function initialEditText({ word, focusIndex, errorType, distractorPool = [] }) {
  const texts = word.units.map((unit) => unit.text);
  const focus = texts[focusIndex] ?? texts[0];
  const replacement = distractorPool.find((item) => item.text !== focus && item.text.length > 0)?.text
    ?? (focus.length > 1 ? focus[0] : `${focus}x`);
  let edited = [...texts];
  switch (errorType) {
    case 'OMISSION':
      edited.splice(focusIndex, 1);
      break;
    case 'EXTRA':
      edited.splice(focusIndex, 0, replacement);
      break;
    case 'TRANSPOSITION':
      if (edited.length > 1) {
        const next = focusIndex + 1 < edited.length ? focusIndex + 1 : focusIndex - 1;
        [edited[focusIndex], edited[next]] = [edited[next], edited[focusIndex]];
      }
      break;
    case 'SUBSTITUTION':
    case 'SUFFIX_RULE':
    case 'UNKNOWN':
    default:
      edited[focusIndex] = replacement;
      break;
  }
  const text = edited.join('');
  if (text !== word.text) return text;
  if (word.text.length > 1) return `${word.text.slice(1)}${word.text[0]}`;
  return `${word.text}${word.text}`;
}

/**
 * @param {{
 *   word: {id: string, text: string, units: {text: string, graphemeId: string}[]},
 *   typeId: string,
 *   graphemeMap?: Record<string, {tier?: string}>,
 *   distractorPool?: {id: string, text: string}[],
 *   seed?: number|string,
 *   errorType?: string,
 *   sentence?: { text: string }|null,
 *   claim?: string,
 *   specId: string
 * }} input
 * @returns {import('../core/contracts.js').QuestionSpec}
 */
export function buildWordSpec({
  word,
  typeId,
  graphemeMap = {},
  distractorPool = [],
  seed = 20261111,
  errorType,
  sentence = null,
  claim,
  specId,
}) {
  if (!word || typeof word.id !== 'string' || !Array.isArray(word.units) || word.units.length === 0) {
    throw new ContractError('SPEC_BUILD_INVALID', 'word with at least one unit is required');
  }
  if (!P6_AVAILABLE_TYPES.includes(typeId)) {
    throw new ContractError('SPEC_BUILD_INVALID', `P6 cannot build type ${typeId}`);
  }

  const focusIndex = chooseFocusIndex(word);
  const focusUnit = word.units[focusIndex];
  const distractors = chooseDistractorIds(word, distractorPool, seed);
  const params = typeId === 'T-SEQUENCE'
    ? { distractorGraphemeIds: distractors }
    : typeId === 'T-FILL'
      ? { blankUnitIndex: focusIndex, distractorGraphemeIds: distractors }
      : typeId === 'T-EDIT'
        ? {
          initialText: initialEditText({
            word,
            focusIndex,
            errorType,
            distractorPool,
          }),
          operation: errorType ?? 'replace',
        }
        : typeId === 'T-JUDGE-FIX'
          ? { claim: claim ?? word.text }
          : typeId === 'T-CLOZE'
            ? { sentence: sentence?.text ?? word.text }
            : {};

  params.difficulty = {
    scaffold: scaffoldOf(typeId),
    granularity: 'grapheme',
    slotCount: word.units.length,
    letterCount: word.text.length,
    graphemeTierMax: Math.max(
      1,
      ...word.units.map((unit) => tierNumber(graphemeMap[unit.graphemeId]?.tier)),
    ),
    distractorCount: ['T-SEQUENCE', 'T-FILL'].includes(typeId) ? distractors.length : 0,
    confusableCount: 0,
    inputMode: ['T-TYPE', 'T-EDIT', 'T-CLOZE', 'T-JUDGE-FIX'].includes(typeId) ? 'keyboard' : 'tap',
  };

  const spec = {
    specId,
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
    seed: hashSeed(`${seed}|${word.id}|${typeId}|${specId}`),
  };
  validateQuestionSpec(spec);
  return spec;
}

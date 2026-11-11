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
  if (typeId === 'T-FILL') return 'fill';
  if (typeId === 'T-SEQUENCE') return 'sequence';
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
 * @param {{
 *   word: {id: string, text: string, units: {text: string, graphemeId: string}[]},
 *   typeId: string,
 *   graphemeMap?: Record<string, {tier?: string}>,
 *   distractorPool?: {id: string, text: string}[],
 *   seed?: number|string,
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
  specId,
}) {
  if (!word || typeof word.id !== 'string' || !Array.isArray(word.units) || word.units.length === 0) {
    throw new ContractError('SPEC_BUILD_INVALID', 'word with at least one unit is required');
  }
  if (!P1_AVAILABLE_TYPES.includes(typeId)) {
    throw new ContractError('SPEC_BUILD_INVALID', `P3 cannot build type ${typeId}`);
  }

  const focusIndex = chooseFocusIndex(word);
  const focusUnit = word.units[focusIndex];
  const distractors = chooseDistractorIds(word, distractorPool, seed);
  const params = typeId === 'T-SEQUENCE'
    ? { distractorGraphemeIds: distractors }
    : typeId === 'T-FILL'
      ? { blankUnitIndex: focusIndex, distractorGraphemeIds: distractors }
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
    distractorCount: typeId === 'T-TYPE' ? 0 : distractors.length,
    confusableCount: 0,
    inputMode: typeId === 'T-TYPE' ? 'keyboard' : 'tap',
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

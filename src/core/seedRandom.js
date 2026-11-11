/**
 * @layer core
 * @phase P0
 * @doc §3.1 技术选型
 *
 * 唯一随机源：mulberry32 + 显式 seed。
 * 禁止在任何业务代码里使用环境随机数。
 */

import { ContractError } from './errors.js';

export const SEED_MAX = 0xffffffff;

/**
 * mulberry32：小而快、可复现的 32 位 PRNG。
 * @param {number} seed uint32
 * @returns {() => number} [0, 1)
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * FNV-1a 32 位哈希：把内容 ID / 字符串变成稳定 seed。
 * @param {string} input
 * @returns {number} uint32
 */
export function hashSeed(input) {
  if (typeof input !== 'string') {
    throw new ContractError('SEED_INVALID', 'hashSeed expects a string');
  }
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * 数字 → uint32；字符串 → hash；非法值抛错。
 * @param {number|string} seed
 * @returns {number}
 */
export function normalizeSeed(seed) {
  if (typeof seed === 'number') {
    if (!Number.isInteger(seed) || seed < 0 || seed > SEED_MAX) {
      throw new ContractError('SEED_INVALID', 'numeric seed must be an integer in uint32 range', { seed });
    }
    return seed >>> 0;
  }
  if (typeof seed === 'string' && seed.length > 0) {
    return hashSeed(seed);
  }
  throw new ContractError('SEED_INVALID', 'seed must be a number or non-empty string', { seed });
}

/**
 * 创建带便捷方法的确定性 RNG。
 * @param {number|string} seed
 */
export function createRng(seed) {
  const normalizedSeed = normalizeSeed(seed);
  const next = mulberry32(normalizedSeed);

  /** @returns {number} [0,1) */
  const float = () => next();

  /**
   * 闭区间整数。
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  function int(min, max) {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new ContractError('RNG_RANGE_INVALID', 'int(min,max) requires integers with max >= min', { min, max });
    }
    return min + Math.floor(float() * (max - min + 1));
  }

  /**
   * @template T
   * @param {readonly T[]} items
   * @returns {T}
   */
  function pick(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new ContractError('RNG_EMPTY_POOL', 'pick requires a non-empty array');
    }
    return items[int(0, items.length - 1)];
  }

  /**
   * Fisher-Yates，不改原数组。
   * @template T
   * @param {readonly T[]} items
   * @returns {T[]}
   */
  function shuffle(items) {
    if (!Array.isArray(items)) {
      throw new ContractError('RNG_INVALID_INPUT', 'shuffle requires an array');
    }
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = int(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /** @returns {boolean} */
  function bool() {
    return float() < 0.5;
  }

  return { seed: normalizedSeed, next: float, float, int, pick, shuffle, bool };
}

/**
 * 便捷函数：不保留 rng 时使用。
 * @template T
 * @param {readonly T[]} items
 * @param {number|string} seed
 * @returns {T[]}
 */
export function shuffleWithSeed(items, seed) {
  return createRng(seed).shuffle(items);
}

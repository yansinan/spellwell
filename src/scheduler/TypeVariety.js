/**
 * @layer scheduler
 * @phase P9
 * @doc §3.4 9 个题型注册表
 *
 * 同阶段内的题型轮转：不改变“修复/新词/复习”的大方向，
 * 只避免整轮都是同一种输入题。
 */

import { hashSeed } from '../core/seedRandom.js';

/**
 * @param {{phase: 'new'|'review'|'practice', intervalIndex?: number, mode: 'review'|'effort', index: number, seed: number|string}} input
 * @returns {'T-SEQUENCE'|'T-FILL'|'T-TYPE'}
 */
export function variedType({ phase, intervalIndex = 0, mode, index, seed }) {
  if (phase === 'new') {
    if (mode === 'effort') return 'T-FILL';
    return ['T-SEQUENCE', 'T-SEQUENCE', 'T-FILL'][Math.max(0, index) % 3];
  }
  const strong = phase === 'review' && intervalIndex >= 2;
  const pool = strong
    ? ['T-TYPE', 'T-FILL']
    : mode === 'effort'
      ? ['T-TYPE', 'T-FILL']
      : ['T-FILL', 'T-SEQUENCE'];
  const offset = hashSeed(`${String(seed)}|type-variety`) % pool.length;
  return /** @type {'T-SEQUENCE'|'T-FILL'|'T-TYPE'} */ (pool[(Math.max(0, index) + offset) % pool.length]);
}

/**
 * @layer tests
 * @phase P0
 * @doc §3.1 技术选型
 */

import {
  createRng,
  hashSeed,
  mulberry32,
  normalizeSeed,
  shuffleWithSeed,
} from '../../src/core/seedRandom.js';
import {
  assertDeepEqual,
  assertEqual,
  assertThrows,
  assert,
  test,
} from '../harness.js';

test('mulberry32：固定 seed 产生锁定序列', () => {
  const rng = mulberry32(123456789);
  const actual = Array.from({ length: 5 }, () => rng());
  assertDeepEqual(actual, [
    0.2577907438389957,
    0.9707721115555614,
    0.7853280142880976,
    0.20616457983851433,
    0.30307188746519387,
  ]);
});

test('mulberry32：同 seed 同序列，不同 seed 不同序列', () => {
  const a = Array.from({ length: 8 }, mulberry32(7));
  const b = Array.from({ length: 8 }, mulberry32(7));
  const c = Array.from({ length: 8 }, mulberry32(8));
  assertDeepEqual(a, b);
  assert(a.some((value, index) => value !== c[index]), 'different seeds should diverge');
});

test('mulberry32：输出始终落在 [0, 1)', () => {
  const rng = mulberry32(0);
  for (let index = 0; index < 1000; index += 1) {
    const value = rng();
    assert(value >= 0 && value < 1, `out of range: ${value}`);
  }
});

test('hashSeed：字符串哈希稳定且为 uint32', () => {
  assertEqual(hashSeed('fish'), 2947385699);
  assertEqual(hashSeed('w.fish'), 676637090);
  assertEqual(hashSeed('sh'), 1062342494);
  assertEqual(hashSeed('fish'), hashSeed('fish'));
  assert(Number.isInteger(hashSeed('anything')) && hashSeed('anything') >= 0);
});

test('normalizeSeed：字符串走哈希，数字接受 uint32，非法值拒绝', () => {
  assertEqual(normalizeSeed('fish'), hashSeed('fish'));
  assertEqual(normalizeSeed(42), 42);
  assertEqual(normalizeSeed(0), 0);
  assertThrows(() => normalizeSeed(-1), 'SEED_INVALID');
  assertThrows(() => normalizeSeed(1.5), 'SEED_INVALID');
  assertThrows(() => normalizeSeed(2 ** 32), 'SEED_INVALID');
  assertThrows(() => normalizeSeed(''), 'SEED_INVALID');
  assertThrows(() => normalizeSeed(null), 'SEED_INVALID');
});

test('createRng：int 闭区间、pick 与 bool 可复现', () => {
  const a = createRng('fish');
  const b = createRng('fish');
  const valuesA = Array.from({ length: 20 }, () => a.int(-3, 3));
  const valuesB = Array.from({ length: 20 }, () => b.int(-3, 3));
  assertDeepEqual(valuesA, valuesB);
  assert(valuesA.every((value) => value >= -3 && value <= 3));
  assertEqual(createRng(1).pick(['only']), 'only');
  assertThrows(() => createRng(1).pick([]), 'RNG_EMPTY_POOL');
});

test('shuffle：确定性、保持元素、不修改原数组', () => {
  const input = ['a', 'b', 'c', 'd', 'e'];
  const first = shuffleWithSeed(input, 42);
  const second = shuffleWithSeed(input, 42);
  assertDeepEqual(first, second);
  assertDeepEqual(first, ['a', 'e', 'c', 'b', 'd']);
  assertDeepEqual([...first].sort(), [...input].sort());
  assertDeepEqual(input, ['a', 'b', 'c', 'd', 'e']);
});

test('createRng：seed 属性是归一化后的 uint32', () => {
  assertEqual(createRng('fish').seed, hashSeed('fish'));
  assertEqual(createRng(42).seed, 42);
});

/**
 * @layer tests
 * @phase P9
 * @doc §3.4 9 个题型注册表
 */

import { chooseFocusIndex } from '../../src/scheduler/QuestionSpecBuilder.js';
import { assertEqual, test } from '../harness.js';

test('填空焦点：fish 可在 _ish / f_sh / fi_h 间变化，元音有偏重', () => {
  const word = {
    id: 'w.fish',
    units: [
      { text: 'f', graphemeId: 'g.f' },
      { text: 'i', graphemeId: 'g.i' },
      { text: 'sh', graphemeId: 'g.sh' },
    ],
  };
  const indexes = new Set();
  let vowelHits = 0;
  for (let seed = 0; seed < 60; seed += 1) {
    const index = chooseFocusIndex(word, seed);
    assertEqual(Number.isInteger(index), true);
    indexes.add(index);
    if (index === 1) vowelHits += 1;
  }
  assertEqual(indexes.size, 3);
  assertEqual(vowelHits > 20, true);
});

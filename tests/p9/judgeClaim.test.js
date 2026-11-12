/**
 * @layer tests
 * @phase P9
 * @doc §3.4 9 个题型注册表
 */

import { readFile } from 'node:fs/promises';
import { buildWordSpec } from '../../src/scheduler/QuestionSpecBuilder.js';
import { assert, assertEqual, test } from '../harness.js';

test('T-JUDGE-FIX：claim 不再永远是正确词', async () => {
  const words = JSON.parse(await readFile(new URL('../../src/content/words.json', import.meta.url), 'utf8'));
  const graphemes = JSON.parse(await readFile(new URL('../../src/content/graphemes.json', import.meta.url), 'utf8'));
  const word = words.items.find((item) => item.text === 'bird' && item.textbook === 'pep-2026');
  const map = Object.fromEntries(graphemes.items.map((item) => [item.id, item]));
  const pool = graphemes.items.map((item) => ({ id: item.id, text: item.text }));
  const claims = new Set();
  for (let seed = 0; seed < 30; seed += 1) {
    const spec = buildWordSpec({
      word,
      typeId: 'T-JUDGE-FIX',
      graphemeMap: map,
      distractorPool: pool,
      seed,
      specId: `spec.test.judge.${seed}`,
    });
    claims.add(spec.params.claim);
  }
  assert(claims.has('bird'), 'expected some correct claims');
  assert([...claims].some((claim) => claim !== 'bird'), 'expected some wrong claims');
  assert([...claims].filter((claim) => claim !== 'bird').every((claim) => claim.length === 4));
});

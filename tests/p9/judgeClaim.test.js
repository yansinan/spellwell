/**
 * @layer tests
 * @phase P9
 * @doc §3.4 9 个题型注册表
 */

import { readFile } from 'node:fs/promises';
import { buildErrorHistory } from '../../src/scheduler/ErrorHistory.js';
import { buildWordSpec } from '../../src/scheduler/QuestionSpecBuilder.js';
import { assert, assertEqual, test } from '../harness.js';

async function setup() {
  const words = JSON.parse(await readFile(new URL('../../src/content/words.json', import.meta.url), 'utf8'));
  const graphemes = JSON.parse(await readFile(new URL('../../src/content/graphemes.json', import.meta.url), 'utf8'));
  const word = words.items.find((item) => item.text === 'bird' && item.textbook === 'pep-2026');
  return {
    word,
    map: Object.fromEntries(graphemes.items.map((item) => [item.id, item])),
    pool: graphemes.items.map((item) => ({ id: item.id, text: item.text })),
  };
}

test('T-JUDGE-FIX：没有历史错误时不制造错误 claim', async () => {
  const { word, map, pool } = await setup();
  for (let seed = 0; seed < 30; seed += 1) {
    const spec = buildWordSpec({
      word,
      typeId: 'T-JUDGE-FIX',
      graphemeMap: map,
      distractorPool: pool,
      seed,
      specId: `spec.test.judge.none.${seed}`,
    });
    assertEqual(spec.params.claim, 'bird');
  }
});

test('T-JUDGE-FIX：有历史错误时只回放该词自己的错误', async () => {
  const { word, map, pool } = await setup();
  const history = buildErrorHistory([
    { wordId: 'w.bird', firstError: { expected: 'ir', actual: 'er', unitId: 'g.ir' } },
  ]);
  const claims = new Set();
  for (let seed = 0; seed < 30; seed += 1) {
    const spec = buildWordSpec({
      word,
      typeId: 'T-JUDGE-FIX',
      graphemeMap: map,
      distractorPool: pool,
      seed,
      specId: `spec.test.judge.history.${seed}`,
      errorHistory: history,
    });
    claims.add(spec.params.claim);
  }
  assert(claims.has('bird'), 'expected some correct claims');
  assert(claims.has('berd'), 'expected own historical error claim');
  assert([...claims].every((claim) => claim === 'bird' || claim === 'berd'));
});

test('T-JUDGE-FIX：空白历史错误不会生成 h t', async () => {
  const { word, map, pool } = await setup();
  const history = buildErrorHistory([
    { wordId: 'w.bird', firstError: { expected: 'ir', actual: ' ' } },
    { wordId: 'w.bird', firstError: { expected: 'ir', actual: 'h t' } },
  ]);
  for (let seed = 0; seed < 30; seed += 1) {
    const spec = buildWordSpec({
      word,
      typeId: 'T-JUDGE-FIX',
      graphemeMap: map,
      distractorPool: pool,
      seed,
      specId: `spec.test.judge.space.${seed}`,
      errorHistory: history,
    });
    assertEqual(spec.params.claim.includes(' '), false);
  }
});

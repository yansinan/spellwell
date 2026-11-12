/**
 * @layer tests
 * @phase P9
 * @doc §3.4 9 个题型注册表
 */

import { chooseFocusIndex } from '../../src/scheduler/QuestionSpecBuilder.js';
import { assert, assertEqual, test } from '../harness.js';

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

test('魔法 e 双空：name 的 T-FILL 空出 a 和末尾 e', async () => {
  const { readFile } = await import('node:fs/promises');
  const words = JSON.parse(await readFile(new URL('../../src/content/words.json', import.meta.url), 'utf8'));
  const name = words.items.find((word) => word.text === 'name' && word.textbook === 'pep-2026');
  const graphemes = JSON.parse(await readFile(new URL('../../src/content/graphemes.json', import.meta.url), 'utf8'));
  const { buildWordSpec } = await import('../../src/scheduler/QuestionSpecBuilder.js');
  const spec = buildWordSpec({
    word: name,
    typeId: 'T-FILL',
    graphemeMap: Object.fromEntries(graphemes.items.map((item) => [item.id, item])),
    distractorPool: [],
    seed: 1,
    specId: 'spec.test.name.fill',
  });
  assertEqual(JSON.stringify(spec.params.blankUnitIndices), JSON.stringify([1, 3]));
  assertEqual(name.units[1].text, 'a');
  assertEqual(name.units[3].silent, true);
});

test('魔法 e 双空：T-FILL 构建两个空位并可判定 a/e', async () => {
  const { readFile } = await import('node:fs/promises');
  const words = JSON.parse(await readFile(new URL('../../src/content/words.json', import.meta.url), 'utf8'));
  const name = words.items.find((word) => word.text === 'name' && word.textbook === 'pep-2026');
  const graphemes = JSON.parse(await readFile(new URL('../../src/content/graphemes.json', import.meta.url), 'utf8'));
  const { buildWordSpec } = await import('../../src/scheduler/QuestionSpecBuilder.js');
  const { build, judge } = await import('../../src/questionTypes/TFill.js');
  const spec = buildWordSpec({
    word: name,
    typeId: 'T-FILL',
    graphemeMap: Object.fromEntries(graphemes.items.map((item) => [item.id, item])),
    distractorPool: [],
    seed: 1,
    specId: 'spec.test.name.fill2',
  });
  const bundle = { word: name, graphemes: Object.fromEntries(graphemes.items.map((item) => [item.id, item])) };
  const model = build(spec, bundle);
  assertEqual(model.slots.length, 2);
  const a = model.units.find((unit) => unit.text === 'a');
  const e = model.units.find((unit) => unit.text === 'e');
  const result = judge({
    spec,
    renderModel: model,
    bundle,
    events: [
      { kind: 'tap-unit', unitId: a.unitId, slotIndex: 1 },
      { kind: 'tap-unit', unitId: e.unitId, slotIndex: 3 },
    ],
  });
  assertEqual(result.wordCorrect, true);
});

test('元音组合拆分：T-FILL 可把 ai 拆成 a/i 两个字母空', async () => {
  const { readFile } = await import('node:fs/promises');
  const words = JSON.parse(await readFile(new URL('../../src/content/words.json', import.meta.url), 'utf8'));
  const graphemes = JSON.parse(await readFile(new URL('../../src/content/graphemes.json', import.meta.url), 'utf8'));
  const word = words.items.find((item) => item.text === 'rain' && item.textbook === 'pep-2026');
  const map = Object.fromEntries(graphemes.items.map((item) => [item.id, item]));
  const { buildWordSpec } = await import('../../src/scheduler/QuestionSpecBuilder.js');
  const { build, judge } = await import('../../src/questionTypes/TFill.js');
  let spec = null;
  for (let seed = 0; seed < 30; seed += 1) {
    const candidate = buildWordSpec({
      word,
      typeId: 'T-FILL',
      graphemeMap: map,
      distractorPool: [],
      seed,
      specId: `spec.test.rain.${seed}`,
    });
    if (candidate.params.vowelSplit) { spec = candidate; break; }
  }
  assert(spec, 'expected at least one vowel-split seed');
  assertEqual(spec.params.vowelSplit.letters.join(''), 'ai');
  const bundle = { word, graphemes: map };
  const model = build(spec, bundle);
  assertEqual(model.slots.length, 2);
  const a = model.units.find((unit) => unit.text === 'a');
  const i = model.units.find((unit) => unit.text === 'i');
  const result = judge({
    spec,
    renderModel: model,
    bundle,
    events: [
      { kind: 'tap-unit', unitId: a.unitId, slotIndex: 0 },
      { kind: 'tap-unit', unitId: i.unitId, slotIndex: 1 },
    ],
  });
  assertEqual(result.wordCorrect, true);
});

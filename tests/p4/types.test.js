/**
 * @layer tests
 * @phase P4
 * @doc §3.4 9 个题型注册表
 */

import { readFile } from 'node:fs/promises';
import * as TReorder from '../../src/questionTypes/TReorder.js';
import * as TEdit from '../../src/questionTypes/TEdit.js';
import * as TSegment from '../../src/questionTypes/TSegment.js';
import { renderUnitsForWord } from '../../src/questionTypes/shared.js';
import { assertDeepEqual, assertEqual, test } from '../harness.js';

const words = JSON.parse(await readFile(new URL('../../src/content/words.json', import.meta.url), 'utf8'));
const graphemes = JSON.parse(await readFile(new URL('../../src/content/graphemes.json', import.meta.url), 'utf8'));
const word = words.items.find((item) => item.id === 'w.fish');
const graphemeMap = Object.fromEntries(graphemes.items.map((item) => [item.id, item]));
const bundle = { word, graphemes: graphemeMap };
const focus = { kind: 'grapheme', id: 'g.sh' };

function spec(typeId, extra = {}) {
  return {
    specId: `spec.test.${typeId}`,
    typeId,
    target: { kind: 'word', id: 'w.fish' },
    focus,
    params: {},
    resourceHints: { wordIds: ['w.fish'], graphemeIds: ['g.f', 'g.i', 'g.sh'] },
    seed: 123,
    ...extra,
  };
}

test('T-REORDER：初始顺序打乱，交换到正确顺序判对', () => {
  const model = TReorder.build(spec('T-REORDER'), bundle);
  assertEqual(model.layout, 'reorder');
  assertEqual(model.slots.length, 3);
  assertEqual(model.interactionHints.allowReorder, true);

  const target = renderUnitsForWord(word).map((unit) => unit.unitId);
  const order = model.slots.map((slot) => slot.unitId);
  const events = [];
  for (let index = 0; index < target.length; index += 1) {
    const at = order.indexOf(target[index], index);
    if (at !== index) {
      [order[index], order[at]] = [order[at], order[index]];
      events.push({ kind: 'reorder', fromIndex: index, toIndex: at });
    }
  }
  assertEqual(events.length > 0, true);
  const correct = TReorder.judge({ spec: spec('T-REORDER'), renderModel: model, events, bundle, now: 100 });
  assertEqual(correct.wordCorrect, true);
  assertEqual(correct.firstError, null);

  const wrong = TReorder.judge({ spec: spec('T-REORDER'), renderModel: model, events: [], bundle, now: 100 });
  if (model.slots.map((slot) => slot.unitId).join('|') !== target.join('|')) {
    assertEqual(wrong.wordCorrect, false);
    assertEqual(wrong.firstError.type, 'TRANSPOSITION');
  }
});

test('T-EDIT：预填错词，编辑为正确词判对；少字母定位 OMISSION', () => {
  const model = TEdit.build(spec('T-EDIT', { params: { initialText: 'fihs' } }), bundle);
  assertEqual(model.layout, 'edit');
  assertEqual(model.fixedText, 'fihs');

  const correct = TEdit.judge({
    spec: spec('T-EDIT', { params: { initialText: 'fihs' } }),
    renderModel: model,
    events: [{ kind: 'edit', text: 'fish' }],
    bundle,
    now: 100,
  });
  assertEqual(correct.wordCorrect, true);

  const wrong = TEdit.judge({
    spec: spec('T-EDIT', { params: { initialText: 'fihs' } }),
    renderModel: model,
    events: [{ kind: 'edit', text: 'fis' }],
    bundle,
    now: 100,
  });
  assertEqual(wrong.wordCorrect, false);
  assertEqual(wrong.firstError.type, 'OMISSION');
});

test('T-SEGMENT：正确切分、过度切分、切分不足与位置错', () => {
  const model = TSegment.build(spec('T-SEGMENT'), bundle);
  assertEqual(model.layout, 'segment');
  assertEqual(model.fixedText, 'fish');

  const correct = TSegment.judge({
    spec: spec('T-SEGMENT'),
    renderModel: model,
    events: [{ kind: 'tap-gap', gapIndex: 1 }, { kind: 'tap-gap', gapIndex: 2 }],
    bundle,
    now: 100,
  });
  assertEqual(correct.wordCorrect, true);

  const under = TSegment.judge({
    spec: spec('T-SEGMENT'),
    renderModel: model,
    events: [{ kind: 'tap-gap', gapIndex: 1 }],
    bundle,
    now: 100,
  });
  assertEqual(under.firstError.type, 'BOUNDARY_UNDER_SEGMENT');

  const over = TSegment.judge({
    spec: spec('T-SEGMENT'),
    renderModel: model,
    events: [1, 2, 3].map((gapIndex) => ({ kind: 'tap-gap', gapIndex })),
    bundle,
    now: 100,
  });
  assertEqual(over.firstError.type, 'BOUNDARY_OVER_SEGMENT');

  const misplaced = TSegment.judge({
    spec: spec('T-SEGMENT'),
    renderModel: model,
    events: [{ kind: 'tap-gap', gapIndex: 1 }, { kind: 'tap-gap', gapIndex: 3 }],
    bundle,
    now: 100,
  });
  assertEqual(misplaced.firstError.type, 'BOUNDARY_MISPLACED');
  assertDeepEqual(model.units.map((unit) => unit.text), ['f', 'i', 's', 'h']);
});

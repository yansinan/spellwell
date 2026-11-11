/**
 * @layer tests
 * @phase P4
 * @doc §3.4 9 个题型注册表
 */

import { readFile } from 'node:fs/promises';
import { MemoryAdapter } from '../../src/storage/MemoryAdapter.js';
import { WordRepository } from '../../src/repositories/WordRepository.js';
import { StateRepository, createWordState } from '../../src/repositories/StateRepository.js';
import { AttemptRepository } from '../../src/repositories/AttemptRepository.js';
import { Scheduler } from '../../src/scheduler/Scheduler.js';
import { createErrorProfile } from '../../src/scheduler/ErrorProfile.js';
import { assertEqual, test } from '../harness.js';

const DAY = new Date(2026, 10, 11, 10, 0, 0);

async function setup() {
  const [words, graphemes] = await Promise.all([
    JSON.parse(await readFile(new URL('../../src/content/words.json', import.meta.url), 'utf8')),
    JSON.parse(await readFile(new URL('../../src/content/graphemes.json', import.meta.url), 'utf8')),
  ]);
  const adapter = new MemoryAdapter({ initialData: { words: words.items, graphemes: graphemes.items } });
  await adapter.init();
  const stateRepository = new StateRepository(adapter);
  const graphemeMap = Object.fromEntries(graphemes.items.map((item) => [item.id, item]));
  const scheduler = new Scheduler({
    wordRepository: new WordRepository(adapter),
    stateRepository,
    attemptRepository: new AttemptRepository(adapter),
    graphemeMap,
    distractorPool: graphemes.items.map((item) => ({ id: item.id, text: item.text })),
    seed: 20261111,
    now: () => DAY,
  });
  return { scheduler, stateRepository };
}

async function specFor(errorType) {
  const { scheduler, stateRepository } = await setup();
  const state = createWordState('w.fish', DAY);
  state.lastResult = 'wrong';
  state.dueDate = '2026-11-11';
  state.errorProfile = [createErrorProfile({
    type: errorType,
    unitKind: 'grapheme',
    unitId: 'g.sh',
    position: 2,
    expected: 'sh',
    actual: 'ch',
  })];
  await stateRepository.saveWordState(state);
  const specs = await scheduler.buildDailyQueue();
  return specs.find((spec) => spec.target.id === 'w.fish');
}

test('P4 调度：替换错选 T-EDIT，顺序错选 T-REORDER，边界错选 T-SEGMENT', async () => {
  assertEqual((await specFor('SUBSTITUTION')).typeId, 'T-EDIT');
  assertEqual((await specFor('TRANSPOSITION')).typeId, 'T-REORDER');
  assertEqual((await specFor('BOUNDARY_OVER_SEGMENT')).typeId, 'T-SEGMENT');
  assertEqual((await specFor('BOUNDARY_UNDER_SEGMENT')).typeId, 'T-SEGMENT');
  assertEqual((await specFor('BOUNDARY_MISPLACED')).typeId, 'T-SEGMENT');
});

test('P4 调度：T-EDIT spec 带预填错词，T-REORDER/SEGMENT 不带', async () => {
  const edit = await specFor('SUBSTITUTION');
  assertEqual(typeof edit.params.initialText, 'string');
  assertEqual(edit.params.initialText === 'fish', false);
  const reorder = await specFor('TRANSPOSITION');
  assertEqual(reorder.params.initialText, undefined);
  const segment = await specFor('BOUNDARY_OVER_SEGMENT');
  assertEqual(segment.params.initialText, undefined);
});

/**
 * @layer tests
 * @phase P5
 * @doc §3.4 9 个题型注册表 / §3.3 组合状态
 */

import { readFile } from 'node:fs/promises';
import { MemoryAdapter } from '../../src/storage/MemoryAdapter.js';
import { WordRepository } from '../../src/repositories/WordRepository.js';
import { StateRepository } from '../../src/repositories/StateRepository.js';
import { AttemptRepository } from '../../src/repositories/AttemptRepository.js';
import { Scheduler } from '../../src/scheduler/Scheduler.js';
import * as TMatch from '../../src/questionTypes/TMatch.js';
import { assertDeepEqual, assertEqual, test } from '../harness.js';

const DAY = new Date(2026, 10, 11, 10, 0, 0);
const words = JSON.parse(await readFile(new URL('../../src/content/words.json', import.meta.url), 'utf8'));
const graphemes = JSON.parse(await readFile(new URL('../../src/content/graphemes.json', import.meta.url), 'utf8'));
const word = words.items.find((item) => item.id === 'w.fish');
const graphemeMap = Object.fromEntries(graphemes.items.map((item) => [item.id, item]));
const bundle = { word, graphemes: graphemeMap };

function spec() {
  return {
    specId: 'spec.match.sh',
    typeId: 'T-MATCH',
    target: { kind: 'word', id: 'w.fish' },
    focus: { kind: 'grapheme', id: 'g.sh' },
    params: {
      focusText: 'sh',
      options: [
        { wordId: 'w.fish', text: 'fish', correct: true },
        { wordId: 'w.ship', text: 'ship', correct: true },
        { wordId: 'w.cat', text: 'cat', correct: false },
      ],
    },
    resourceHints: { wordIds: ['w.fish', 'w.ship', 'w.cat'], graphemeIds: ['g.sh'] },
    seed: 123,
  };
}

async function setup() {
  const adapter = new MemoryAdapter({ initialData: { words: words.items, graphemes: graphemes.items } });
  await adapter.init();
  const stateRepository = new StateRepository(adapter);
  const wordRepository = new WordRepository(adapter);
  const attemptRepository = new AttemptRepository(adapter);
  const scheduler = new Scheduler({
    wordRepository,
    stateRepository,
    attemptRepository,
    graphemeMap,
    distractorPool: graphemes.items.map((item) => ({ id: item.id, text: item.text })),
    seed: 20261111,
    now: () => DAY,
  });
  return { scheduler, stateRepository, attemptRepository };
}

function correct(wordId) {
  return {
    specId: `spec.test.${wordId}`,
    wordId,
    wordCorrect: true,
    focusCorrect: true,
    firstError: null,
    timestamp: DAY.getTime(),
  };
}

test('T-MATCH：多选分类判对，选错集合判错', () => {
  const model = TMatch.build(spec(), bundle);
  assertEqual(model.layout, 'match');
  assertEqual(model.units.length, 3);

  const right = TMatch.judge({
    spec: spec(),
    renderModel: model,
    events: [{ kind: 'tap-unit', unitId: 'w.fish' }, { kind: 'tap-unit', unitId: 'w.ship' }],
    bundle,
    now: 1,
  });
  assertEqual(right.wordCorrect, true);

  const wrong = TMatch.judge({
    spec: spec(),
    renderModel: model,
    events: [{ kind: 'tap-unit', unitId: 'w.cat' }],
    bundle,
    now: 1,
  });
  assertEqual(wrong.wordCorrect, false);
});

test('组合状态：答对词写入 wordsPassed 与独立间隔', async () => {
  const { scheduler, stateRepository } = await setup();
  await scheduler.recordAttempt(correct('w.fish'));
  const sh = await stateRepository.getGraphemeState('g.sh');
  assertEqual(sh.wordsPassed.includes('w.fish'), true);
  assertEqual(sh.consecutiveCorrect, 1);
  assertEqual(sh.intervalIndex, 1);
  assertEqual(sh.status, 'reviewing');
  assertEqual(sh.dueDate, '2026-11-14');
});

test('组合状态：跨 2 个不同词连续正确进入 probe', async () => {
  const { scheduler, stateRepository } = await setup();
  await scheduler.recordAttempt(correct('w.fish'));
  await scheduler.recordAttempt(correct('w.ship'));
  await scheduler.recordAttempt(correct('w.fish'));
  const sh = await stateRepository.getGraphemeState('g.sh');
  assertDeepEqual([...sh.wordsPassed], ['w.fish', 'w.ship']);
  assertEqual(sh.consecutiveCorrect, 3);
  assertEqual(sh.status, 'probe');
});

test('每日队列：到期组合追加最多 1 道 T-MATCH', async () => {
  const { scheduler, stateRepository } = await setup();
  const state = await stateRepository.getGraphemeState('g.sh');
  state.dueDate = '2026-11-11';
  state.wordsPassed = ['w.fish'];
  await stateRepository.saveGraphemeState(state);

  const specs = await scheduler.buildDailyQueue();
  const matches = specs.filter((item) => item.typeId === 'T-MATCH');
  assertEqual(matches.length, 1);
  assertEqual(matches[0].focus.id, 'g.sh');
  assertEqual(matches[0].params.options.filter((option) => option.correct).length >= 2, true);
  assertEqual(specs.length <= 8, true);
});

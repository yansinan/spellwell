/**
 * @layer tests
 * @phase P6
 * @doc §1.3 记忆曲线是调度器，不是装饰
 */

import { readFile } from 'node:fs/promises';
import { MemoryAdapter } from '../../src/storage/MemoryAdapter.js';
import { WordRepository } from '../../src/repositories/WordRepository.js';
import { StateRepository, createWordState } from '../../src/repositories/StateRepository.js';
import { AttemptRepository } from '../../src/repositories/AttemptRepository.js';
import { Scheduler } from '../../src/scheduler/Scheduler.js';
import { assertEqual, test } from '../harness.js';

const DAY = new Date(2026, 10, 11, 10, 0, 0);
const words = JSON.parse(await readFile(new URL('../../src/content/words.json', import.meta.url), 'utf8'));
const graphemes = JSON.parse(await readFile(new URL('../../src/content/graphemes.json', import.meta.url), 'utf8'));
const sentences = JSON.parse(await readFile(new URL('../../src/content/sentences.json', import.meta.url), 'utf8'));

async function setup(now = DAY) {
  const adapter = new MemoryAdapter({ initialData: { words: words.items, graphemes: graphemes.items } });
  await adapter.init();
  const stateRepository = new StateRepository(adapter);
  const attemptRepository = new AttemptRepository(adapter);
  const sentenceByWord = Object.fromEntries(sentences.items.map((item) => [item.wordId, item]));
  const scheduler = new Scheduler({
    wordRepository: new WordRepository(adapter),
    stateRepository,
    attemptRepository,
    graphemeMap: Object.fromEntries(graphemes.items.map((item) => [item.id, item])),
    distractorPool: graphemes.items.map((item) => ({ id: item.id, text: item.text })),
    sentences: sentenceByWord,
    seed: 20261111,
    now: () => now,
  });
  return { scheduler, stateRepository, attemptRepository };
}

function probeState(wordId = 'w.fish') {
  const state = createWordState(wordId, DAY);
  state.intervalIndex = 4;
  state.consecutiveCorrect = 3;
  state.lastResult = 'correct';
  state.status = 'probe';
  state.dueDate = '2026-11-11';
  return state;
}

test('probe：有句子的词进入队列时优先 T-CLOZE', async () => {
  const { scheduler, stateRepository } = await setup();
  await stateRepository.saveWordState(probeState());
  const specs = await scheduler.buildDailyQueue({ date: '2026-11-11' });
  const fish = specs.find((spec) => spec.target.id === 'w.fish');
  assertEqual(Boolean(fish), true);
  assertEqual(fish.typeId, 'T-CLOZE');
  assertEqual(typeof fish.params.sentence, 'string');
});

test('probe：答错退回 learning，答对才 mastered', async () => {
  const wrongRun = await setup();
  await wrongRun.stateRepository.saveWordState(probeState());
  const wrong = await wrongRun.scheduler.recordAttempt({
    specId: 'probe', wordId: 'w.fish', wordCorrect: false, focusCorrect: false,
    firstError: { type: 'SUBSTITUTION', unitKind: 'grapheme', unitId: 'g.sh', position: 2, expected: 'sh', actual: 's' },
    timestamp: DAY.getTime(),
  });
  assertEqual(wrong.status, 'learning');
  assertEqual(wrong.intervalIndex, 0);
  assertEqual(wrong.dueDate, '2026-11-12');

  const rightRun = await setup();
  await rightRun.stateRepository.saveWordState(probeState());
  const right = await rightRun.scheduler.recordAttempt({
    specId: 'probe', wordId: 'w.fish', wordCorrect: true, focusCorrect: true,
    firstError: null, timestamp: DAY.getTime(),
  });
  assertEqual(right.status, 'mastered');
  assertEqual(right.dueDate, null);
});

test('probe：30 天满档后连续 3 次正确，60 天后进入抽查', async () => {
  const { scheduler, stateRepository } = await setup();
  const state = createWordState('w.fish', DAY);
  state.intervalIndex = 4;
  state.consecutiveCorrect = 2;
  state.lastResult = 'correct';
  state.dueDate = '2026-11-11';
  await stateRepository.saveWordState(state);

  const next = await scheduler.recordAttempt({
    specId: 'max', wordId: 'w.fish', wordCorrect: true, focusCorrect: true,
    firstError: null, timestamp: DAY.getTime(),
  });
  assertEqual(next.status, 'probe');
  assertEqual(next.dueDate, '2027-01-10');

  const later = await setup(new Date(2027, 0, 10, 10, 0, 0));
  later.scheduler.stateRepository = stateRepository;
  const specs = await later.scheduler.buildDailyQueue({ date: '2027-01-10' });
  const fish = specs.find((spec) => spec.target.id === 'w.fish');
  assertEqual(Boolean(fish), true);
  assertEqual(fish.typeId, 'T-CLOZE');
});

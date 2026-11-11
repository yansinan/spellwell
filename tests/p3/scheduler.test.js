/**
 * @layer tests
 * @phase P3
 * @doc §1.3 记忆曲线是调度器，不是装饰
 */

import { readFile } from 'node:fs/promises';
import { MemoryAdapter } from '../../src/storage/MemoryAdapter.js';
import { WordRepository } from '../../src/repositories/WordRepository.js';
import { StateRepository, createWordState } from '../../src/repositories/StateRepository.js';
import { AttemptRepository } from '../../src/repositories/AttemptRepository.js';
import { Scheduler } from '../../src/scheduler/Scheduler.js';
import { createErrorProfile } from '../../src/scheduler/ErrorProfile.js';
import { P1_AVAILABLE_TYPES } from '../../src/scheduler/QuestionSpecBuilder.js';
import { assertDeepEqual, assertEqual, assertRejects, assertThrows, test } from '../harness.js';

const DAY_ONE = new Date(2026, 10, 11, 10, 0, 0);
const DAY_TWO = new Date(2026, 10, 12, 10, 0, 0);

async function loadJson(name) {
  return JSON.parse(await readFile(new URL(`../../src/content/${name}.json`, import.meta.url), 'utf8'));
}

async function setup({ now = DAY_ONE, size = 6 } = {}) {
  const [words, graphemes] = await Promise.all([loadJson('words'), loadJson('graphemes')]);
  const adapter = new MemoryAdapter({
    initialData: { words: words.items, graphemes: graphemes.items },
  });
  await adapter.init();
  const wordRepository = new WordRepository(adapter);
  const stateRepository = new StateRepository(adapter);
  const attemptRepository = new AttemptRepository(adapter);
  const graphemeMap = Object.fromEntries(graphemes.items.map((item) => [item.id, item]));
  const distractorPool = graphemes.items.map((item) => ({ id: item.id, text: item.text }));
  const scheduler = new Scheduler({
    wordRepository,
    stateRepository,
    attemptRepository,
    graphemeMap,
    distractorPool,
    seed: 20261111,
    size,
    now: () => now,
  });
  return { adapter, scheduler, stateRepository, attemptRepository, graphemeMap };
}

function wrongResult(spec, wordId) {
  return {
    specId: spec.specId,
    wordId,
    wordCorrect: false,
    focusCorrect: false,
    firstError: createErrorProfile({
      type: 'OMISSION',
      unitKind: 'grapheme',
      unitId: 'g.sh',
      position: 2,
      expected: 'sh',
      actual: '',
    }),
    timestamp: DAY_ONE.getTime(),
  };
}

test('Scheduler：新内容生成 5—8 个唯一词的每日队列', async () => {
  const { scheduler } = await setup();
  const specs = await scheduler.buildDailyQueue();
  assertEqual(specs.length, 6);
  assertEqual(new Set(specs.map((spec) => spec.target.id)).size, 6);
  for (const spec of specs) {
    assertEqual(P1_AVAILABLE_TYPES.includes(spec.typeId), true);
    assertEqual(typeof spec.params.difficulty, 'object');
    assertEqual(spec.params.difficulty.granularity, 'grapheme');
  }
});

test('Scheduler：队列大小限制在 5—8', async () => {
  const { scheduler } = await setup();
  assertEqual((await scheduler.buildDailyQueue({ size: 5 })).length, 5);
  assertEqual((await scheduler.buildDailyQueue({ size: 8 })).length, 8);
  await assertRejects(() => scheduler.buildDailyQueue({ size: 4 }), RangeError);
  await assertRejects(() => scheduler.buildDailyQueue({ size: 9 }), RangeError);
  assertThrows(() => new Scheduler({}), 'SCHEDULER_DEPS_INVALID');
});

test('Scheduler：答错降档、错误画像落库、次日强制出现', async () => {
  const dayOne = await setup();
  const specs = await dayOne.scheduler.buildDailyQueue();
  const target = specs[0];
  const state = await dayOne.scheduler.recordAttempt(wrongResult(target, target.target.id));

  assertEqual(state.wordId, target.target.id);
  assertEqual(state.intervalIndex, 0);
  assertEqual(state.lastResult, 'wrong');
  assertEqual(state.status, 'learning');
  assertEqual(state.dueDate, '2026-11-12');
  assertEqual(state.errorProfile.length, 1);
  assertEqual((await dayOne.attemptRepository.recent(1)).length, 1);

  const dayTwo = await setup({ now: DAY_TWO });
  // 用同一 adapter 模拟刷新后读取持久状态。
  dayTwo.scheduler.wordRepository = dayOne.scheduler.wordRepository;
  dayTwo.scheduler.stateRepository = dayOne.stateRepository;
  dayTwo.scheduler.attemptRepository = dayOne.attemptRepository;
  const nextSpecs = await dayTwo.scheduler.buildDailyQueue({ date: '2026-11-12' });
  assertEqual(nextSpecs[0].target.id, target.target.id);
  assertEqual(nextSpecs[0].typeId, 'T-FILL');
});

test('Scheduler：答对升级，错误画像清空，dueDate 按 3 天推进', async () => {
  const { scheduler, stateRepository, attemptRepository } = await setup();
  const specs = await scheduler.buildDailyQueue();
  const target = specs[0];
  const wrong = await scheduler.recordAttempt(wrongResult(target, target.target.id));

  const correct = await scheduler.recordAttempt({
    specId: target.specId,
    wordId: target.target.id,
    wordCorrect: true,
    focusCorrect: true,
    firstError: null,
    timestamp: DAY_TWO.getTime(),
  });
  assertEqual(correct.intervalIndex, 1);
  assertEqual(correct.consecutiveCorrect, 1);
  assertEqual(correct.lastResult, 'correct');
  assertEqual(correct.status, 'learning');
  assertEqual(correct.errorProfile.length, 0);
  assertEqual(correct.dueDate, '2026-11-14');
  assertEqual((await stateRepository.getWordState(target.target.id)).dueDate, '2026-11-14');
  assertEqual((await attemptRepository.recent(2)).length, 2);
});

test('Scheduler：已有 OMISSION 错误时优先选 T-FILL 修复', async () => {
  const { scheduler, stateRepository } = await setup();
  const state = createWordState('w.fish', DAY_ONE);
  state.lastResult = 'wrong';
  state.dueDate = '2026-11-11';
  state.errorProfile = [createErrorProfile({
    type: 'OMISSION',
    unitKind: 'grapheme',
    unitId: 'g.sh',
    position: 2,
    expected: 'sh',
    actual: '',
  })];
  await stateRepository.saveWordState(state);

  const specs = await scheduler.buildDailyQueue();
  const fish = specs.find((spec) => spec.target.id === 'w.fish');
  assertEqual(Boolean(fish), true);
  assertEqual(fish.typeId, 'T-FILL');
});

test('Scheduler：题型的难度向量包含 P3 必需维度', async () => {
  const { scheduler } = await setup();
  const specs = await scheduler.buildDailyQueue();
  for (const spec of specs) {
    const difficulty = spec.params.difficulty;
    assertEqual(typeof difficulty.scaffold, 'string');
    assertEqual(difficulty.granularity, 'grapheme');
    assertEqual(typeof difficulty.slotCount, 'number');
    assertEqual(typeof difficulty.letterCount, 'number');
    assertEqual(typeof difficulty.graphemeTierMax, 'number');
    assertEqual(typeof difficulty.distractorCount, 'number');
    assertEqual(difficulty.confusableCount, 0);
    assertEqual(['tap', 'keyboard'].includes(difficulty.inputMode), true);
  }
  assertDeepEqual(
    specs.map((spec) => P1_AVAILABLE_TYPES.includes(spec.typeId)),
    specs.map(() => true),
  );
});

/**
 * @layer tests
 * @phase P9
 * @doc §2.1 孩子端（学习模块）
 */

import { readFile } from 'node:fs/promises';
import { MemoryAdapter } from '../../src/storage/MemoryAdapter.js';
import { WordRepository } from '../../src/repositories/WordRepository.js';
import { StateRepository } from '../../src/repositories/StateRepository.js';
import { AttemptRepository } from '../../src/repositories/AttemptRepository.js';
import { Scheduler } from '../../src/scheduler/Scheduler.js';
import { assert, assertEqual, test } from '../harness.js';

const words = JSON.parse(await readFile(new URL('../../src/content/words.json', import.meta.url), 'utf8'));
const pepWords = { ...words, items: words.items.filter((word) => (word.textbook ?? 'pep-2026') === 'pep-2026') };
const graphemes = JSON.parse(await readFile(new URL('../../src/content/graphemes.json', import.meta.url), 'utf8'));

async function setup() {
  const adapter = new MemoryAdapter({ initialData: { words: pepWords.items, graphemes: graphemes.items } });
  await adapter.init();
  const scheduler = new Scheduler({
    wordRepository: new WordRepository(adapter),
    stateRepository: new StateRepository(adapter),
    attemptRepository: new AttemptRepository(adapter),
    graphemeMap: Object.fromEntries(graphemes.items.map((item) => [item.id, item])),
    distractorPool: graphemes.items.map((item) => ({ id: item.id, text: item.text })),
    seed: 20261111,
    now: () => new Date(2026, 10, 11, 10),
  });
  return { scheduler, adapter };
}

test('单元选择：只生成所选 unit 的题，队列可到 20', async () => {
  const { scheduler, adapter } = await setup();
  const specs = await scheduler.buildDailyQueue({ size: 20, units: ['g1-s2-u1'], mode: 'review' });
  assertEqual(specs.length, 11);
  for (const spec of specs) {
    const word = await adapter.get('words', spec.target.id);
    assertEqual(word.unitId, 'g1-s2-u1');
  }
});

test('复习/努力：新词题型轮转有不同侧重', async () => {
  const { scheduler } = await setup();
  const review = await scheduler.buildDailyQueue({ size: 20, units: ['g2-s1-u1'], mode: 'review' });
  const effort = await scheduler.buildDailyQueue({ size: 20, units: ['g2-s1-u1'], mode: 'effort' });
  assertEqual(review[0].typeId, 'T-SEQUENCE');
  assertEqual(effort[0].typeId, 'T-FILL');
  assertEqual(review[0].params.plan.phase, 'new');
  assertEqual(review[0].params.plan.typeReason, 'new:build');
  assertEqual(review[0].params.plan.mode, 'review');
  assertEqual(effort[0].params.plan.mode, 'effort');
  assertEqual(effort[0].params.plan.reason, 'new-word');
});

test('retired 内容不进入队列', async () => {
  const { scheduler, adapter } = await setup();
  const word = await adapter.get('words', 'w.book');
  await adapter.put('words', { ...word, reviewStatus: 'retired' });
  const specs = await scheduler.buildDailyQueue({ size: 20, units: ['g1-s2-u1'], mode: 'review' });
  assertEqual(specs.some((spec) => spec.target.id === 'w.book'), false);
});

test('真实权重：有错误历史的词在同层排序更靠前', async () => {
  const { scheduler, adapter } = await setup();
  const now = Date.now();
  for (let index = 0; index < 2; index += 1) {
    await adapter.put('attempts', {
      id: `a.weight.${index}`,
      specId: `spec.weight.${index}`,
      wordId: 'w.ship',
      wordCorrect: false,
      firstError: null,
      timestamp: now + index,
    });
  }
  const specs = await scheduler.buildDailyQueue({ size: 20, units: ['g1-s2-u1'], mode: 'review' });
  assertEqual(specs[0].target.id, 'w.ship');
  assertEqual(specs[1].target.id !== 'w.ship', true);
  assertEqual(specs[0].params.plan.calibration.sampleSize, 2);
  assert(specs[0].params.plan.calibration.wordErrorRate > 0.5);
});

test('未开始状态：调度器把它当作新词，而不是旧复习', async () => {
  const { scheduler, adapter } = await setup();
  const now = new Date().toISOString();
  await adapter.put('wordStates', {
    wordId: 'w.book', status: 'unstarted', intervalIndex: 0, consecutiveCorrect: 0,
    lastResult: null, errorProfile: [], dueDate: null, updatedAt: now,
  });
  const specs = await scheduler.buildDailyQueue({ size: 20, units: ['g1-s1-u1'], mode: 'review' });
  const book = specs.find((spec) => spec.target.id === 'w.book');
  assertEqual(Boolean(book), true);
  assertEqual(book.params.plan.phase, 'new');
  assertEqual(book.typeId, 'T-SEQUENCE');
});

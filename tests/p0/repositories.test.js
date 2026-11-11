/**
 * @layer tests
 * @phase P0
 * @doc §2.3 内容后台
 */

import { AttemptRepository } from '../../src/repositories/AttemptRepository.js';
import { ConfusableRepository } from '../../src/repositories/ConfusableRepository.js';
import { GraphemeRepository } from '../../src/repositories/GraphemeRepository.js';
import { SentenceRepository } from '../../src/repositories/SentenceRepository.js';
import { StateRepository } from '../../src/repositories/StateRepository.js';
import { WordRepository } from '../../src/repositories/WordRepository.js';
import { MemoryAdapter } from '../../src/storage/MemoryAdapter.js';
import {
  assert,
  assertDeepEqual,
  assertEqual,
  assertRejects,
  test,
} from '../harness.js';

async function createFixture() {
  const adapter = new MemoryAdapter({
    initialData: {
      words: [
        { id: 'w.cat', text: 'cat', level: 1, units: [] },
        { id: 'w.fish', text: 'fish', level: 1, units: [] },
        { id: 'w.night', text: 'night', level: 2, units: [] },
      ],
      graphemes: [
        { id: 'g.ch', text: 'ch', tier: 'T1' },
        { id: 'g.sh', text: 'sh', tier: 'T1' },
        { id: 'g.igh', text: 'igh', tier: 'T3' },
      ],
      sentences: [
        { id: 's.fish.01', wordId: 'w.fish', text: 'A fish can swim.' },
        { id: 's.fish.02', wordId: 'w.fish', text: 'The fish is red.' },
        { id: 's.cat.01', wordId: 'w.cat', text: 'The cat naps.' },
      ],
      confusables: [
        { id: 'c.ch-sh', a: 'g.ch', b: 'g.sh' },
        { id: 'c.ck-k', a: 'g.ck', b: 'g.k' },
      ],
    },
  });
  await adapter.init();
  return {
    adapter,
    words: new WordRepository(adapter),
    graphemes: new GraphemeRepository(adapter),
    sentences: new SentenceRepository(adapter),
    confusables: new ConfusableRepository(adapter),
    states: new StateRepository(adapter),
    attempts: new AttemptRepository(adapter),
  };
}

test('WordRepository：按文本/等级查询', async () => {
  const { words } = await createFixture();
  assertEqual((await words.findByText('  FISH ')).id, 'w.fish');
  assertEqual(await words.findByText('nope'), undefined);
  assertDeepEqual((await words.listByLevel(2)).map((word) => word.id), ['w.night']);
  assertEqual((await words.get('w.cat')).text, 'cat');
});

test('GraphemeRepository：按文本/层级查询', async () => {
  const { graphemes } = await createFixture();
  assertEqual((await graphemes.findByText('igh')).id, 'g.igh');
  assertDeepEqual((await graphemes.listByTier('T1')).map((item) => item.id), ['g.ch', 'g.sh']);
});

test('SentenceRepository：按目标词取句子，按 id 稳定排序', async () => {
  const { sentences } = await createFixture();
  assertDeepEqual(
    (await sentences.forWord('w.fish')).map((sentence) => sentence.id),
    ['s.fish.01', 's.fish.02'],
  );
});

test('ConfusableRepository：双向查询与无序对查询', async () => {
  const { confusables } = await createFixture();
  assertDeepEqual(
    (await confusables.forGrapheme('g.sh')).map((item) => item.id),
    ['c.ch-sh'],
  );
  assertEqual((await confusables.findBetween('g.sh', 'g.ch')).id, 'c.ch-sh');
  assertEqual(await confusables.findBetween('g.sh', 'g.igh'), undefined);
});

test('StateRepository：缺失状态返回默认值且不落库', async () => {
  const { adapter, states } = await createFixture();
  const state = await states.getWordState('w.fish');
  assertEqual(state.wordId, 'w.fish');
  assertEqual(state.intervalIndex, 0);
  assertEqual(state.status, 'learning');
  assertEqual(state.lastResult, null);
  assertDeepEqual(state.errorProfile, []);
  assertEqual(await adapter.get('wordStates', 'w.fish'), undefined);
});

test('StateRepository：保存状态并按到期日、wordId 排序，排除已掌握', async () => {
  const { states } = await createFixture();
  const base = await states.getWordState('w.fish');
  await states.saveWordState({ ...base, wordId: 'w.fish', dueDate: '2026-11-11' });
  await states.saveWordState({ ...base, wordId: 'w.cat', dueDate: '2026-11-13' });
  await states.saveWordState({ ...base, wordId: 'w.ship', dueDate: '2026-11-10', status: 'mastered' });

  const due = await states.listDueWords('2026-11-12');
  assertDeepEqual(due.map((state) => state.wordId), ['w.fish']);
  assertDeepEqual(
    (await states.listWordsByStatus('learning')).map((state) => state.wordId).sort(),
    ['w.cat', 'w.fish'],
  );
});

test('StateRepository：组合状态默认值与到期查询', async () => {
  const { states } = await createFixture();
  const state = await states.getGraphemeState('g.sh');
  assertEqual(state.graphemeId, 'g.sh');
  assertDeepEqual(state.wordsPassed, []);
  await states.saveGraphemeState({ ...state, dueDate: '2026-11-10' });
  assertDeepEqual(
    (await states.listDueGraphemes('2026-11-12')).map((item) => item.graphemeId),
    ['g.sh'],
  );
});

test('AttemptRepository：只追加、按词查询、最近查询', async () => {
  const { attempts } = await createFixture();
  const first = await attempts.record({
    specId: 'spec.fish.1',
    wordId: 'w.fish',
    wordCorrect: false,
    focusCorrect: false,
    firstError: {
      type: 'SUBSTITUTION',
      unitKind: 'grapheme',
      unitId: 'g.sh',
      position: 2,
      expected: 'sh',
      actual: 's',
    },
    timestamp: 100,
  });
  const second = await attempts.record({
    specId: 'spec.fish.2',
    wordId: 'w.fish',
    wordCorrect: true,
    focusCorrect: true,
    firstError: null,
    timestamp: 200,
  });
  assertEqual(first.id, 'a.100.0000');
  assertEqual(second.id, 'a.200.0001');

  const byWord = await attempts.listByWord('w.fish');
  assertDeepEqual(byWord.map((item) => item.id), ['a.100.0000', 'a.200.0001']);
  assertDeepEqual((await attempts.recent(1)).map((item) => item.id), ['a.200.0001']);
  assertEqual((await attempts.all()).length, 2);
});

test('AttemptRepository：非法 AttemptResult 拒绝写入', async () => {
  const { attempts } = await createFixture();
  await assertRejects(
    () => attempts.record({ specId: 's', wordId: 'w.fish', wordCorrect: true, timestamp: -1 }),
    'ATTEMPT_RESULT_INVALID',
  );
  assert((await attempts.all()).length === 0);
});

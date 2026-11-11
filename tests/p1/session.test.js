/**
 * @layer tests
 * @phase P1
 * @doc §2.1 孩子端（学习模块）
 */

import { validateRenderModel } from '../../src/core/contracts.js';
import { PracticeSession, PRACTICE_TYPE_ROTATION } from '../../src/ui/PracticeSession.js';
import { assert, assertDeepEqual, assertEqual, assertThrows, test } from '../harness.js';
import {
  FIXED_NOW,
  correctEvents,
  loadP1Bundles,
} from './helpers.js';

const { bundles, graphemesDoc } = await loadP1Bundles();
const distractorPool = graphemesDoc.items.map((grapheme) => ({
  id: grapheme.id,
  text: grapheme.text,
}));

function createSession(seed = 20261111) {
  return new PracticeSession({
    bundles,
    distractorPool,
    seed,
    now: () => FIXED_NOW,
  });
}

test('PracticeSession：3 个词 × 3 个题型，每个词覆盖全部 P1 题型', () => {
  const session = createSession();
  assertEqual(session.size, 9);
  const byWord = new Map();
  const byType = new Map();
  for (const spec of session.specs) {
    byWord.set(spec.target.id, (byWord.get(spec.target.id) ?? 0) + 1);
    byType.set(spec.typeId, (byType.get(spec.typeId) ?? 0) + 1);
    assert(
      PRACTICE_TYPE_ROTATION.includes(spec.typeId),
      `unexpected type ${spec.typeId}`,
    );
  }
  assertDeepEqual([...byWord.values()], [3, 3, 3]);
  assertDeepEqual([...byType.values()], [3, 3, 3]);
  assertDeepEqual([...byType.keys()].sort(), [...PRACTICE_TYPE_ROTATION].sort());
});

test('PracticeSession：同 seed 的 spec 序列可复现，不同 seed 不同', () => {
  const a = createSession(20261111);
  const b = createSession(20261111);
  const c = createSession(20261112);
  assertDeepEqual(a.specs.map((spec) => spec.specId), b.specs.map((spec) => spec.specId));
  assertDeepEqual(a.specs.map((spec) => spec.seed), b.specs.map((spec) => spec.seed));
  assert(
    a.specs.some((spec, index) => spec.seed !== c.specs[index].seed),
    'different session seeds should change at least one spec seed',
  );
});

test('PracticeSession：T-SEQUENCE/T-FILL 带干扰项，T-TYPE 不带候选', () => {
  const session = createSession();
  for (const spec of session.specs) {
    if (spec.typeId === 'T-SEQUENCE') {
      assert(Array.isArray(spec.params.distractorGraphemeIds));
      assert(spec.params.distractorGraphemeIds.length > 0);
    }
    if (spec.typeId === 'T-FILL') {
      assert(Number.isInteger(spec.params.blankUnitIndex));
      assert(spec.params.distractorGraphemeIds.length > 0);
    }
    if (spec.typeId === 'T-TYPE') {
      assertDeepEqual(spec.params, {});
    }
  }
});

test('PracticeSession：9 题全部答对可完整走完，结果只在内存', () => {
  const session = createSession();
  const specIds = [];
  while (!session.isComplete) {
    const { spec, renderModel, bundle } = session.buildCurrent();
    validateRenderModel(renderModel);
    const events = correctEvents({
      typeId: /** @type {any} */ (spec.typeId),
      spec,
      renderModel,
      word: /** @type {any} */ (bundle.word),
    });
    const result = session.submit(events);
    assertEqual(result.wordCorrect, true, `${spec.specId} should be correct`);
    assertEqual(result.timestamp, FIXED_NOW);
    assertEqual(result.wordId, spec.target.id);
    specIds.push(spec.specId);
    session.advance();
  }
  assertEqual(session.results.length, 9);
  assertEqual(new Set(specIds).size, 9);
  assertThrows(() => session.buildCurrent(), 'PRACTICE_COMPLETE');

  session.restart();
  assertEqual(session.currentIndex, 0);
  assertEqual(session.results.length, 0);
  assertEqual(session.isComplete, false);
});

test('PracticeSession：未提交不能前进，重复提交被拒绝', () => {
  const session = createSession();
  assertThrows(() => session.advance(), 'PRACTICE_NOT_SUBMITTED');

  const { spec, renderModel, bundle } = session.buildCurrent();
  const events = correctEvents({
    typeId: /** @type {any} */ (spec.typeId),
    spec,
    renderModel,
    word: /** @type {any} */ (bundle.word),
  });
  session.submit(events);
  assertThrows(() => session.submit(events), 'PRACTICE_ALREADY_SUBMITTED');
  session.advance();
  assertEqual(session.currentIndex, 1);
});

test('PracticeSession：错误尝试产生结构化 firstError，仍可继续', () => {
  const session = createSession();
  const { spec, renderModel, bundle } = session.buildCurrent();
  assertEqual(spec.typeId, 'T-SEQUENCE');
  const events = correctEvents({
    typeId: 'T-SEQUENCE',
    spec,
    renderModel,
    word: /** @type {any} */ (bundle.word),
  }).slice(0, 2);
  const result = session.submit(events);
  assertEqual(result.wordCorrect, false);
  assertEqual(result.firstError.type, 'OMISSION');
  assertEqual(result.firstError.position, 2);
  session.advance();
  assertEqual(session.currentIndex, 1);
});

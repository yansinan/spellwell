/**
 * @layer tests
 * @phase P9
 * @doc §3.4 9 个题型注册表
 */

import { chooseRepairType } from '../../src/scheduler/RepairAlternative.js';
import { assertEqual, test } from '../harness.js';

test('错题强化：同词换一种题型，且优先匹配错误类型', () => {
  for (const original of ['T-SEQUENCE', 'T-FILL', 'T-TYPE', 'T-EDIT', 'T-REORDER', 'T-SEGMENT', 'T-CLOZE', 'T-JUDGE-FIX', 'T-MATCH']) {
    const type = chooseRepairType(original, 'SUBSTITUTION', 42);
    assertEqual(type !== original, true, `${original} -> ${type}`);
  }
  assertEqual(chooseRepairType('T-SEQUENCE', 'OMISSION', 1), 'T-FILL');
  assertEqual(chooseRepairType('T-FILL', 'SUBSTITUTION', 1), 'T-EDIT');
});

test('错题强化：插入到本轮后半部分，不打断当前题', async () => {
  const { PracticeSession } = await import('../../src/ui/PracticeSession.js');
  const { loadP1Bundles, makeSpec } = await import('../p1/helpers.js');
  const { bundles } = await loadP1Bundles();
  const bundle = bundles[0];
  const first = makeSpec({ word: bundle.word, typeId: 'T-SEQUENCE', seed: 1 });
  const second = makeSpec({ word: bundle.word, typeId: 'T-SEQUENCE', seed: 2 });
  const repair = makeSpec({ word: bundle.word, typeId: 'T-FILL', params: { blankUnitIndex: 1, distractorGraphemeIds: [] }, seed: 3 });
  const session = new PracticeSession({ bundles: [bundle], specs: [first, second] });
  const at = session.insertRepair(repair);
  assertEqual(at, 1);
  assertEqual(session.specs.length, 3);
  assertEqual(session.specs[1].typeId, 'T-FILL');
  assertEqual(session.currentIndex, 0);
});

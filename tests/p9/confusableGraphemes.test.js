/**
 * @layer tests
 * @phase P9
 * @doc §3.4 9 个题型注册表
 */

import { CONFUSABLE_GROUPS, confusableGraphemes, confusableTexts } from '../../src/scheduler/ConfusableGraphemes.js';
import { assert, assertEqual, test } from '../harness.js';

test('相似组合：ir/er/ur、ea/ee、oa/ow 双向关联', () => {
  assert(confusableTexts('ir').includes('er'));
  assert(confusableTexts('ir').includes('ur'));
  assert(confusableTexts('er').includes('ir'));
  assert(confusableTexts('ea').includes('ee'));
  assert(confusableTexts('ea').includes('e'));
  assert(confusableTexts('ea').includes('a'));
  assert(confusableTexts('oa').includes('ow'));
  assertEqual(confusableTexts('zzz').length, 0);
});

test('相似组合：从候选池里筛出可用干扰项', () => {
  const pool = [{ id: 'g.ir', text: 'ir' }, { id: 'g.er', text: 'er' }, { id: 'g.ur', text: 'ur' }, { id: 'g.ch', text: 'ch' }];
  const picks = confusableGraphemes('ir', pool).map((item) => item.text);
  assertEqual(picks.length, 2);
  assert(picks.includes('er'));
  assert(picks.includes('ur'));
  assertEqual(CONFUSABLE_GROUPS.length > 10, true);
});

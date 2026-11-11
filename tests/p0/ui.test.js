/**
 * @layer tests
 * @phase P0
 * @doc §6.2 UI 风格参考：多邻国
 */

import { mountApp } from '../../src/ui/App.js';
import { assert, assertEqual, assertIncludes, test } from '../harness.js';

test('P0 状态页：无 DOM 环境也能完成装配与模板渲染', async () => {
  const root = { innerHTML: '', dataset: {} };
  await mountApp(root);

  assertIncludes(root.innerHTML, 'SpellWell');
  assertIncludes(root.innerHTML, 'P0');
  assertIncludes(root.innerHTML, 'T-SEQUENCE');
  assertEqual(root.dataset.phase, 'P0');
  assertEqual((root.innerHTML.match(/class="sw-type"/g) ?? []).length, 9);
  assert(root.innerHTML.includes('sw-slot--focus'));
});

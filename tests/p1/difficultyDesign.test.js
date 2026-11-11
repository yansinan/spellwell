/**
 * @layer tests
 * @phase P1
 * @doc §3.5 难度梯度：grapheme 块选 < 字母级拼写
 */

import { readFile } from 'node:fs/promises';
import { assert, assertMatch, test } from '../harness.js';

const design = await readFile(new URL('../../docs/DESIGN.md', import.meta.url), 'utf8');
const traceability = await readFile(new URL('../../docs/TRACEABILITY.md', import.meta.url), 'utf8');
const adr = await readFile(new URL('../../docs/decisions/0006-difficulty-gradient.md', import.meta.url), 'utf8');

test('难度设计：组合块选显式低于字母级，并被写入需求源', () => {
  assertMatch(design, /### 3\.5 难度梯度/);
  assert(design.includes('`grapheme` < `mixed` < `letter`'));
  assert(design.includes('同一词、同一脚手架、同一候选池'));
  assert(design.includes('难度是一个**多维向量**'));
  assert(design.includes('不能当作等价题型'));
  assertMatch(adr, /grapheme < mixed < letter/);
  assertMatch(traceability, /R-DIFF-01/);
  assertMatch(traceability, /R-DIFF-02/);
});

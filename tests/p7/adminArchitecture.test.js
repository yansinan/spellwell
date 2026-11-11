/**
 * @layer tests
 * @phase P7
 * @doc §2.3 内容后台
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assert, test } from '../harness.js';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testsDir, '..', '..');

test('后台不 import 学习状态仓库，不触碰状态 store', async () => {
  const files = ['src/admin/AdminApp.js', 'src/admin/ContentValidator.js'];
  for (const relative of files) {
    const source = await readFile(path.join(root, relative), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert(!/from\s+['"][^'"]*(StateRepository|AttemptRepository)\.js/.test(source), `${relative} imports state repo`);
    assert(!/\b(?:wordStates|graphemeStates|attempts)\b/.test(code), `${relative} touches learning stores`);
    assert(!/\b(?:localStorage|indexedDB)\s*[.[]/.test(code), `${relative} touches browser persistence`);
  }
});

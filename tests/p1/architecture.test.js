/**
 * @layer tests
 * @phase P1
 * @doc §3.2 三层解耦架构
 *
 * P1 边界守卫：屏幕不判定、不写状态；学习端不出现中文。
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assert, test } from '../harness.js';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testsDir, '..', '..');
const uiFiles = [
  'src/ui/PracticeScreen.js',
  'src/ui/PracticeSession.js',
  'src/ui/bootstrap.js',
];

const sources = new Map();
for (const relative of uiFiles) {
  sources.set(relative, await readFile(path.join(root, relative), 'utf8'));
}

test('P1 UI：PracticeScreen 不直接 import 题型或调用 judge', () => {
  const screen = sources.get('src/ui/PracticeScreen.js');
  assert(!screen.includes('getQuestionType'), 'screen must not select/implement question types');
  assert(!/\.judge\s*\(/.test(screen), 'screen must not call judge directly');
});

test('P1 UI：不写学习状态，不触碰持久化', () => {
  for (const [relative, source] of sources) {
    assert(
      !/from\s+['"][^'"]*(StateRepository|AttemptRepository)\.js/.test(source),
      `${relative} must not import learning-state repositories`,
    );
    assert(
      !/\b(?:localStorage|indexedDB)\s*[.[]/.test(source),
      `${relative} must not touch browser persistence`,
    );
  }
});

test('P1 学习端：PracticeScreen 不出现中文字符串', () => {
  const screen = sources.get('src/ui/PracticeScreen.js');
  const withoutComments = screen
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert(!/[\u4e00-\u9fff]/.test(withoutComments), 'PracticeScreen must stay English-only');
});

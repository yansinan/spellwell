/**
 * @layer tests
 * @phase P7
 * @doc CONTENT_SPEC §6 校验规则 V1—V10
 */

import { readFile } from 'node:fs/promises';
import { buildExport, validateContent } from '../../src/admin/ContentValidator.js';
import { assertEqual, assertIncludes, assertThrows, test } from '../harness.js';

async function load() {
  const loadOne = async (name) => JSON.parse(
    await readFile(new URL(`../../src/content/${name}.json`, import.meta.url), 'utf8'),
  );
  return {
    words: await loadOne('words'),
    graphemes: await loadOne('graphemes'),
    sentences: await loadOne('sentences'),
    confusables: await loadOne('confusables'),
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function reviewed(content) {
  const copy = clone(content);
  for (const store of Object.values(copy)) {
    for (const item of store.items) item.reviewStatus = 'reviewed';
  }
  return copy;
}

test('V1—V9：当前种子内容结构有效', async () => {
  const report = validateContent(await load());
  assertEqual(report.valid, true);
  assertEqual(report.errors.length, 0);
  assertEqual(report.counts.words, 583);
});

test('V10：当前种子全部 unreviewed，生产导出阻断', async () => {
  const content = await load();
  const error = assertThrows(() => buildExport(content), 'CONTENT_EXPORT_UNREVIEWED');
  assertEqual(error.code, 'CONTENT_EXPORT_UNREVIEWED');
  assertEqual(error.details.unreviewed.length, 685);
});

test('V10：全部 reviewed 后导出成功且只含 reviewed', async () => {
  const content = reviewed(await load());
  const snapshot = buildExport(content);
  assertEqual(snapshot.counts.words, 583);
  assertEqual(snapshot.counts.graphemes, 96);
  assertEqual(snapshot.counts.sentences, 4);
  assertEqual(snapshot.counts.confusables, 2);
  assertEqual(snapshot.stores.words.every((item) => item.reviewStatus === 'reviewed'), true);
});

test('V4/V5：切分不闭合、缺组合会定位到条目', async () => {
  const content = await load();
  content.words.items[0].units[0].text = 'x';
  content.words.items[1].units[0].graphemeId = 'g.missing';
  const report = validateContent(content);
  assertEqual(report.valid, false);
  assertEqual(report.errors.some((item) => item.code === 'WORD_UNITS_MISMATCH'), true);
  assertEqual(report.errors.some((item) => item.code === 'GRAPHEME_MISSING'), true);
  assertIncludes(report.errors[0].path, 'words[');
});

test('V2/V6/V8：重复 ID、句子答案错、混淆项重复', async () => {
  const content = await load();
  content.words.items[1].id = content.words.items[0].id;
  content.sentences.items[0].answer = 'ship';
  content.sentences.items[0].blank = 'ship';
  content.confusables.items[1].a = content.confusables.items[0].a;
  content.confusables.items[1].b = content.confusables.items[0].b;
  const report = validateContent(content);
  assertEqual(report.errors.some((item) => item.code === 'CONTENT_ID_DUPLICATE'), true);
  assertEqual(report.errors.some((item) => item.code === 'SENTENCE_BLANK_INVALID'), true);
  assertEqual(report.errors.some((item) => item.code === 'CONFUSABLE_DUPLICATE_PAIR'), true);
});

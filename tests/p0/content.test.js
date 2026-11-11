/**
 * @layer tests
 * @phase P0
 * @doc §1.4 人工标注优先于自动推断
 */

import { readFile } from 'node:fs/promises';
import { assert, assertDeepEqual, assertEqual, test } from '../harness.js';

async function loadContent(name) {
  const url = new URL(`../../src/content/${name}`, import.meta.url);
  return JSON.parse(await readFile(url, 'utf8'));
}

const wordsDoc = await loadContent('words.json');
const graphemesDoc = await loadContent('graphemes.json');
const sentencesDoc = await loadContent('sentences.json');
const confusablesDoc = await loadContent('confusables.json');

const graphemes = new Map(graphemesDoc.items.map((item) => [item.id, item]));
const words = new Map(wordsDoc.items.map((item) => [item.id, item]));
const sentences = new Map(sentencesDoc.items.map((item) => [item.id, item]));
const REVIEW_STATUSES = new Set(['unreviewed', 'reviewed', 'retired']);
const TIERS = new Set(['T1', 'T2', 'T3', 'T4']);
const WORD_ID = /^w\.[a-z]+(?:\.\d+)?$/;
const GRAPHEME_ID = /^g\.[a-z]+$/;
const SENTENCE_ID = /^s\.[a-z]+\.\d{2}$/;
const CONFUSABLE_ID = /^c\.[a-z]+-[a-z]+$/;

test('内容文件：顶层 version=1 且 items 为非空数组', () => {
  for (const [name, doc] of Object.entries({
    words: wordsDoc,
    graphemes: graphemesDoc,
    sentences: sentencesDoc,
    confusables: confusablesDoc,
  })) {
    assertEqual(doc.version, 1, `${name}.version`);
    assert(Array.isArray(doc.items) && doc.items.length > 0, `${name}.items must be non-empty`);
  }
});

test('内容 ID：唯一、前缀正确、reviewStatus 受控', () => {
  for (const [name, doc] of Object.entries({
    words: wordsDoc,
    graphemes: graphemesDoc,
    sentences: sentencesDoc,
    confusables: confusablesDoc,
  })) {
    const ids = new Set();
    for (const item of doc.items) {
      assert(typeof item.id === 'string' && item.id.length > 0, `${name} item missing id`);
      assert(!ids.has(item.id), `duplicate ${name} id: ${item.id}`);
      ids.add(item.id);
      assert(REVIEW_STATUSES.has(item.reviewStatus), `${item.id} has invalid reviewStatus`);
    }
  }
  for (const item of graphemesDoc.items) assert(GRAPHEME_ID.test(item.id), item.id);
  for (const item of wordsDoc.items) assert(WORD_ID.test(item.id), item.id);
  for (const item of sentencesDoc.items) assert(SENTENCE_ID.test(item.id), item.id);
  for (const item of confusablesDoc.items) assert(CONFUSABLE_ID.test(item.id), item.id);
});

test('P0 种子内容不冒充已审核', () => {
  const items = [wordsDoc, graphemesDoc, sentencesDoc, confusablesDoc].flatMap((doc) => doc.items);
  const reviewed = items.filter((item) => item.reviewStatus === 'reviewed');
  assertEqual(reviewed.length, 0, 'seed content must stay unreviewed until P7 human review');
});

test('graphemes：文本与 ID 一致、T1—T4 分层受控', () => {
  for (const item of graphemesDoc.items) {
    assertEqual(item.text, item.id.slice(2), item.id);
    assert(TIERS.has(item.tier), `${item.id} has invalid tier`);
    assert(['letter', 'digraph', 'trigraph', 'vowel-team'].includes(item.kind), `${item.id} kind`);
  }
  const tiers = new Set(graphemesDoc.items.map((item) => item.tier));
  assert(tiers.has('T1') && tiers.has('T2') && tiers.has('T3'));
});

test('words：人工切分拼接必须逐字等于单词文本', () => {
  for (const word of wordsDoc.items) {
    assertEqual(word.text, word.text.toLowerCase(), `${word.id} must be lowercase`);
    assert(/^[a-z]+$/.test(word.text), `${word.id} must be ASCII letters only`);
    assert([1, 2].includes(word.level), `${word.id} level`);
    assert(Array.isArray(word.units) && word.units.length > 0, `${word.id} units`);
    assertEqual(word.units.map((unit) => unit.text).join(''), word.text, `${word.id} segmentation join`);
    for (const unit of word.units) {
      assert(unit.text.length > 0, `${word.id} has empty unit`);
      const grapheme = graphemes.get(unit.graphemeId);
      assert(grapheme, `${word.id} references missing grapheme ${unit.graphemeId}`);
      assertEqual(grapheme.text, unit.text, `${word.id} grapheme text mismatch`);
    }
  }
});

test('words：关键歧义切分被人工锁定（防止自动推断回退）', () => {
  assertDeepEqual(words.get('w.fish').units.map((unit) => unit.text), ['f', 'i', 'sh']);
  assertDeepEqual(words.get('w.night').units.map((unit) => unit.text), ['n', 'igh', 't']);
  assertDeepEqual(words.get('w.duck').units.map((unit) => unit.text), ['d', 'u', 'ck']);
  assertDeepEqual(words.get('w.rain').units.map((unit) => unit.text), ['r', 'ai', 'n']);
  assertDeepEqual(words.get('w.ship').units.map((unit) => unit.text), ['sh', 'i', 'p']);
});

test('words ↔ sentences：引用双向一致', () => {
  for (const word of wordsDoc.items) {
    for (const sentenceId of word.sentenceIds) {
      const sentence = sentences.get(sentenceId);
      assert(sentence, `${word.id} references missing sentence ${sentenceId}`);
      assertEqual(sentence.wordId, word.id);
    }
  }
  for (const sentence of sentencesDoc.items) {
    const word = words.get(sentence.wordId);
    assert(word, `${sentence.id} references missing word`);
    assert(word.sentenceIds.includes(sentence.id), `${sentence.id} missing from ${word.id}.sentenceIds`);
  }
});

test('sentences：挖空恰好一次、答案等于词条、无中文', () => {
  for (const sentence of sentencesDoc.items) {
    const word = words.get(sentence.wordId);
    assert(word, `${sentence.id} word missing`);
    assert(!/[\u4e00-\u9fff]/.test(sentence.text), `${sentence.id} contains Chinese`);
    assertEqual(sentence.blank, sentence.answer, `${sentence.id} blank/answer mismatch`);
    assertEqual(sentence.answer, word.text, `${sentence.id} answer must equal target word`);
    const hits = sentence.text.split(sentence.blank).length - 1;
    assertEqual(hits, 1, `${sentence.id} blank must appear exactly once`);
  }
});

test('confusables：成对、双向引用存在、无序对唯一', () => {
  const seen = new Set();
  for (const item of confusablesDoc.items) {
    const a = graphemes.get(item.a);
    const b = graphemes.get(item.b);
    assert(a && b, `${item.id} references missing grapheme`);
    assert(item.a !== item.b, `${item.id} must reference two graphemes`);
    const key = [item.a, item.b].sort().join('|');
    assert(!seen.has(key), `duplicate confusable pair: ${item.id}`);
    seen.add(key);
    const expectedId = `c.${[a.text, b.text].sort().join('-')}`;
    assertEqual(item.id, expectedId, 'confusable id must be canonical (alphabetical)');
  }
});

test('confusables：wordPairIds 存在，且每对至少覆盖两个组合', () => {
  for (const item of confusablesDoc.items) {
    for (const wordId of item.wordPairIds) {
      const word = words.get(wordId);
      assert(word, `${item.id} references missing word ${wordId}`);
      const unitTexts = word.units.map((unit) => unit.text);
      const hasA = unitTexts.includes(graphemes.get(item.a).text);
      const hasB = unitTexts.includes(graphemes.get(item.b).text);
      assert(hasA || hasB, `${wordId} does not contain either confusable grapheme`);
    }
  }
});

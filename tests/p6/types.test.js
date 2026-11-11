/**
 * @layer tests
 * @phase P6
 * @doc §3.4 9 个题型注册表
 */

import { readFile } from 'node:fs/promises';
import * as TJudgeFix from '../../src/questionTypes/TJudgeFix.js';
import * as TCloze from '../../src/questionTypes/TCloze.js';
import { assertEqual, test } from '../harness.js';

const words = JSON.parse(await readFile(new URL('../../src/content/words.json', import.meta.url), 'utf8'));
const graphemes = JSON.parse(await readFile(new URL('../../src/content/graphemes.json', import.meta.url), 'utf8'));
const word = words.items.find((item) => item.id === 'w.fish');
const bundle = { word, graphemes: Object.fromEntries(graphemes.items.map((item) => [item.id, item])) };
const focus = { kind: 'grapheme', id: 'g.sh' };

function spec(typeId, params = {}) {
  return {
    specId: `spec.test.${typeId}`,
    typeId,
    target: { kind: 'word', id: 'w.fish' },
    focus,
    params,
    resourceHints: { wordIds: ['w.fish'], graphemeIds: ['g.f', 'g.i', 'g.sh'] },
    seed: 123,
  };
}

test('T-JUDGE-FIX：正确判断与“判断错+改对”', () => {
  const claimCorrect = TJudgeFix.build(spec('T-JUDGE-FIX', { claim: 'fish' }), bundle);
  const correct = TJudgeFix.judge({
    spec: spec('T-JUDGE-FIX', { claim: 'fish' }),
    renderModel: claimCorrect,
    events: [{ kind: 'tap-unit', unitId: 'judge:correct' }],
    bundle,
    now: 1,
  });
  assertEqual(correct.wordCorrect, true);

  const claimWrong = TJudgeFix.build(spec('T-JUDGE-FIX', { claim: 'fis' }), bundle);
  const fixed = TJudgeFix.judge({
    spec: spec('T-JUDGE-FIX', { claim: 'fis' }),
    renderModel: claimWrong,
    events: [{ kind: 'tap-unit', unitId: 'judge:wrong' }, { kind: 'edit', text: 'fish' }],
    bundle,
    now: 1,
  });
  assertEqual(fixed.wordCorrect, true);

  const falseAccept = TJudgeFix.judge({
    spec: spec('T-JUDGE-FIX', { claim: 'fis' }),
    renderModel: claimWrong,
    events: [{ kind: 'tap-unit', unitId: 'judge:correct' }],
    bundle,
    now: 1,
  });
  assertEqual(falseAccept.wordCorrect, false);
});

test('T-CLOZE：句子挖空拼写判对/判错', () => {
  const model = TCloze.build(spec('T-CLOZE', { sentence: 'A fish can swim.' }), bundle);
  assertEqual(model.fixedText, 'A ____ can swim.');

  const correct = TCloze.judge({
    spec: spec('T-CLOZE', { sentence: 'A fish can swim.' }),
    renderModel: model,
    events: [{ kind: 'key-text', text: 'fish' }],
    bundle,
    now: 1,
  });
  assertEqual(correct.wordCorrect, true);

  const wrong = TCloze.judge({
    spec: spec('T-CLOZE', { sentence: 'A fish can swim.' }),
    renderModel: model,
    events: [{ kind: 'key-text', text: 'fis' }],
    bundle,
    now: 1,
  });
  assertEqual(wrong.firstError.type, 'OMISSION');
});

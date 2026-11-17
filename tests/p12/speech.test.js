/**
 * @layer tests
 * @phase P12
 * @doc §2.1 孩子端（学习模块）
 */

import { createSpeechService, canSpeakWordBeforeAnswer } from '../../src/ui/speech.js';
import { assertEqual, test } from '../harness.js';

class FakeUtterance {
  constructor(text) {
    this.text = text;
    this.lang = '';
    this.rate = 1;
    this.pitch = 1;
    this.volume = 1;
    this.voice = null;
  }
}

function fakeSynth(voices) {
  return {
    voices,
    spoken: [],
    cancelled: 0,
    getVoices() { return this.voices; },
    speak(utterance) { this.spoken.push(utterance); },
    cancel() { this.cancelled += 1; },
    addEventListener() {},
  };
}

test('朗读：优先英语自然 voice，词和句子使用不同语速', () => {
  const synth = fakeSynth([
    { name: 'English Local', lang: 'en-US', localService: true, voiceURI: 'local' },
    { name: 'Microsoft Aria Online (Natural)', lang: 'en-US', localService: false, voiceURI: 'aria' },
    { name: '中文', lang: 'zh-CN', localService: true, voiceURI: 'zh' },
  ]);
  const service = createSpeechService({ synth, Utterance: FakeUtterance, storage: null });
  assertEqual(service.voice.name, 'English Local');
  assertEqual(service.speakWord('apple'), true);
  assertEqual(service.speakSentence('I eat an apple.'), true);
  assertEqual(service.speakGrapheme('sh'), true);
  assertEqual(synth.cancelled, 0);
  assertEqual(synth.spoken[0].text, 'apple');
  assertEqual(synth.spoken[0].lang, 'en-US');
  assertEqual(synth.spoken[0].rate, 0.86);
  assertEqual(synth.spoken[1].text, 'I eat an apple.');
  assertEqual(synth.spoken[1].rate, 0.94);
  assertEqual(synth.spoken[2].text, 'sh');
  assertEqual(synth.spoken[2].rate, 0.8);
});

test('朗读：不支持时返回 false，不抛错', () => {
  const service = createSpeechService({ synth: null, Utterance: null, storage: null });
  assertEqual(service.supported, false);
  assertEqual(service.speakWord('apple'), false);
  assertEqual(service.speakSentence('I eat an apple.'), false);
});

test('朗读边界：T-TYPE/T-EDIT/T-JUDGE/T-CLOZE 答前不朗读', () => {
  for (const type of ['T-TYPE', 'T-EDIT', 'T-JUDGE-FIX', 'T-CLOZE']) {
    assertEqual(canSpeakWordBeforeAnswer(type), false);
  }
  for (const type of ['T-SEQUENCE', 'T-FILL', 'T-SEGMENT', 'T-MATCH', 'T-REORDER']) {
    assertEqual(canSpeakWordBeforeAnswer(type), true);
  }
});

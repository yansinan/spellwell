/**
 * @layer ui
 * @phase P12
 * @doc §2.1 孩子端（学习模块）
 *
 * 原生 Web Speech API 朗读：优先自然英语 voice，词用稍慢语速，句子保留标点。
 * 不支持时静默降级；不在题型层或调度层使用。
 */

const VOICE_KEY = 'spellwell.speech.voice';
const WORD_RATE = 0.86;
const SENTENCE_RATE = 0.94;
const NATURAL_VOICE = /(natural|neural|aria|jenny|samantha|google us english|microsoft.*(aria|jenny))/i;

function preferredVoice(storage, voices) {
  const wanted = storage?.getItem?.(VOICE_KEY);
  if (wanted) {
    const exact = voices.find((voice) => voice.voiceURI === wanted || voice.name === wanted);
    if (exact) return exact;
  }
  const score = (voice) => {
    const lang = String(voice.lang ?? '').replace('_', '-');
    let value = 0;
    if (lang === 'en-US') value += 5;
    else if (lang === 'en-GB') value += 4;
    else if (lang.startsWith('en')) value += 2;
    if (voice.localService) value += 2;
    if (NATURAL_VOICE.test(String(voice.name ?? ''))) value += 3;
    return value;
  };
  return [...voices].sort((a, b) => score(b) - score(a))[0] ?? null;
}

/**
 * @param {{
 *   synth?: SpeechSynthesis|null,
 *   Utterance?: typeof SpeechSynthesisUtterance|null,
 *   storage?: Storage|null
 * }} [options]
 */
export function createSpeechService({
  synth = globalThis.speechSynthesis ?? null,
  Utterance = globalThis.SpeechSynthesisUtterance ?? null,
  storage = (() => { try { return globalThis.localStorage ?? null; } catch { return null; } })(),
} = {}) {
  const supported = Boolean(synth && Utterance && typeof synth.speak === 'function');
  let voices = [];
  let voice = null;

  const refresh = () => {
    if (!supported) return;
    try {
      voices = (synth.getVoices?.() ?? []).filter((item) => /^en(?:[-_]|$)/i.test(String(item.lang ?? '')));
      voice = preferredVoice(storage, voices);
    } catch {
      voices = [];
      voice = null;
    }
  };

  if (supported) {
    refresh();
    synth.addEventListener?.('voiceschanged', refresh);
    // Safari 首次可能只返回空列表；下一次点击会再 refresh。
    setTimeout(refresh, 600);
  }

  const speak = (text, rate) => {
    if (!supported || typeof text !== 'string' || text.trim().length === 0) return false;
    try {
      synth.cancel();
      const utterance = new Utterance(text);
      utterance.lang = voice?.lang ?? 'en-US';
      utterance.rate = rate;
      utterance.pitch = 1;
      utterance.volume = 1;
      if (voice) utterance.voice = voice;
      synth.speak(utterance);
      return true;
    } catch {
      return false;
    }
  };

  return {
    supported,
    get voice() { return voice; },
    get voices() { return [...voices]; },
    speakWord(text) { refresh(); return speak(text, WORD_RATE); },
    speakSentence(text) { refresh(); return speak(text, SENTENCE_RATE); },
    stop() {
      if (!supported) return;
      try { synth.cancel(); } catch { /* ignore */ }
    },
  };
}

const WORD_BEFORE_ANSWER = new Set([
  'T-SEQUENCE',
  'T-FILL',
  'T-SEGMENT',
  'T-MATCH',
  'T-REORDER',
]);

/**
 * 答前只有目标词已经部分/完整可见的题型才允许朗读，避免 T-TYPE/T-EDIT/T-JUDGE/T-CLOZE 泄题。
 * @param {string} typeId
 */
export function canSpeakWordBeforeAnswer(typeId) {
  return WORD_BEFORE_ANSWER.has(String(typeId));
}

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
    // 本地 voice 优先：在线自然语音在部分网络/区域会静默失败。
    if (voice.localService) value += 10;
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
  let activeUtterance = null;

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

  const makeUtterance = (text, rate, selectedVoice) => {
    const utterance = new Utterance(text);
    utterance.lang = selectedVoice?.lang ?? 'en-US';
    utterance.rate = rate;
    utterance.pitch = 1;
    utterance.volume = 1;
    if (selectedVoice) utterance.voice = selectedVoice;
    return utterance;
  };

  const speak = (text, rate, selectedVoice = voice, allowFallback = true) => {
    if (!supported || typeof text !== 'string' || text.trim().length === 0) return false;
    try {
      // 只取消正在播放的内容；部分浏览器在没有 active speech 时 cancel 会吞掉首个 utterance。
      if (synth.speaking || synth.pending) synth.cancel();
      if (synth.paused) synth.resume();
      const utterance = makeUtterance(text, rate, selectedVoice);
      activeUtterance = utterance;
      utterance.addEventListener?.('end', () => {
        if (activeUtterance === utterance) activeUtterance = null;
      });
      utterance.addEventListener?.('error', (event) => {
        if (event.error === 'canceled' || event.error === 'interrupted') return;
        console.warn('[SpellWell] speech failed', event.error ?? event);
        // 在线 voice 失败时自动退回本地 voice / 默认语音。
        if (allowFallback && selectedVoice && !selectedVoice.localService) {
          const fallback = voices.find((item) => item.localService) ?? null;
          if (fallback) speak(text, rate, fallback, false);
        }
      });
      synth.speak(utterance);
      return true;
    } catch (error) {
      console.warn('[SpellWell] speech unavailable', error);
      return false;
    }
  };

  return {
    supported,
    get voice() { return voice; },
    get voices() { return [...voices]; },
    speakWord(text) { refresh(); return speak(text, WORD_RATE); },
    speakSentence(text) { refresh(); return speak(text, SENTENCE_RATE); },
    speakGrapheme(text) { refresh(); return speak(text, 0.8); },
    stop() {
      if (!supported) return;
      try { synth.cancel(); } catch { /* ignore */ }
      activeUtterance = null;
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

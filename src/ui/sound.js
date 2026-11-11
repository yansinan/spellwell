/**
 * @layer ui
 * @phase P1
 * @doc §6.2 UI 风格参考：多邻国
 *
 * 轻量合成音效：Web Audio，无外部音频资源、无依赖。
 * 设计原则：短、低音量、圆润；不用刺耳高频、不做夸张失败音。
 */

/**
 * @typedef {Object} SoundPlayer
 * @property {() => void} unlock
 * @property {() => boolean} isMuted
 * @property {(muted: boolean) => boolean} setMuted
 * @property {() => boolean} toggleMuted
 * @property {() => void} tap
 * @property {() => void} pickup
 * @property {() => void} drop
 * @property {() => void} cancel
 * @property {() => void} bounce
 * @property {() => void} correct
 * @property {() => void} wrong
 * @property {() => void} complete
 */

/**
 * @param {{AudioContextClass?: typeof AudioContext|null}} [options]
 * @returns {SoundPlayer}
 */
export function createSoundPlayer(options = {}) {
  const AudioContextClass = options.AudioContextClass
    ?? globalThis.AudioContext
    ?? globalThis.webkitAudioContext
    ?? null;

  let context = null;
  let master = null;
  let muted = false;

  function ensureContext() {
    if (!AudioContextClass) return null;
    if (!context) {
      try {
        context = new AudioContextClass();
        master = context.createGain();
        master.gain.value = 0.55;
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -28;
        compressor.knee.value = 24;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.004;
        compressor.release.value = 0.2;
        master.connect(compressor);
        compressor.connect(context.destination);
      } catch {
        context = null;
        master = null;
        return null;
      }
    }
    if (context.state === 'suspended') {
      context.resume().catch(() => {});
    }
    return context;
  }

  /**
   * @param {number} frequency
   * @param {{
   *   offset?: number,
   *   duration?: number,
   *   type?: OscillatorType,
   *   volume?: number,
   *   slideTo?: number
   * }} [envelope]
   */
  function tone(frequency, envelope = {}) {
    if (muted) return;
    const ctx = ensureContext();
    if (!ctx || !master) return;

    const {
      offset = 0,
      duration = 0.12,
      type = 'sine',
      volume = 0.04,
      slideTo = null,
    } = envelope;
    const start = ctx.currentTime + offset;

    try {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      if (slideTo !== null) {
        oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
      }
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    } catch {
      // 音频不可用时静默降级，不影响学习流程。
    }
  }

  return {
    unlock() {
      ensureContext();
    },
    isMuted() {
      return muted;
    },
    setMuted(next) {
      muted = Boolean(next);
      return muted;
    },
    toggleMuted() {
      muted = !muted;
      return muted;
    },
    /** 选中一个块：短、圆、很轻。 */
    tap() {
      tone(620, { duration: 0.055, type: 'triangle', volume: 0.035 });
    },
    /** 开始拖拽：几乎只是触感提示。 */
    pickup() {
      tone(430, { duration: 0.04, type: 'sine', volume: 0.022 });
    },
    /** 落入槽位：温和的“吸附”声。 */
    drop() {
      tone(300, { duration: 0.08, type: 'sine', volume: 0.04, slideTo: 392 });
    },
    /** 取消/撤回一个选择。 */
    cancel() {
      tone(320, { duration: 0.09, type: 'sine', volume: 0.028, slideTo: 235 });
    },
    /** 拖拽未命中槽位，弹回待选区。 */
    bounce() {
      tone(380, { duration: 0.16, type: 'sine', volume: 0.03, slideTo: 255 });
    },
    /** 答对：两个柔和的上行音，不撒花。 */
    correct() {
      tone(523.25, { duration: 0.13, volume: 0.04 });
      tone(659.25, { offset: 0.09, duration: 0.16, volume: 0.034 });
    },
    /** 答错：低沉、短、无尖锐噪声。 */
    wrong() {
      tone(220, { duration: 0.12, volume: 0.028 });
      tone(185, { offset: 0.07, duration: 0.16, volume: 0.025 });
    },
    /** 完成一轮：三个上行音，轻收尾。 */
    complete() {
      tone(523.25, { duration: 0.14, volume: 0.04 });
      tone(659.25, { offset: 0.1, duration: 0.16, volume: 0.038 });
      tone(783.99, { offset: 0.2, duration: 0.22, volume: 0.04 });
    },
  };
}

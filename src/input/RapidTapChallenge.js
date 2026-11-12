/**
 * @layer input
 * @phase P11
 * @doc §2.1 孩子端（学习模块）
 *
 * 可选的节奏连击挑战：默认关闭，结果不得写入 wordStates / graphemeStates / attempts，
 * 也不得进入错误画像。
 */

export class RapidTapChallenge {
  /**
   * @param {{durationMs?: number, now?: () => number}} [options]
   */
  constructor(options = {}) {
    this.durationMs = Number.isFinite(options.durationMs) ? Math.max(1000, options.durationMs) : 30000;
    this.now = typeof options.now === 'function' ? options.now : () => Date.now();
    this.enabled = false;
    this.startedAt = null;
    this.endedAt = null;
    this.words = [];
    this.morphMode = false;
    this.correct = 0;
    this.wrong = 0;
    this.streak = 0;
    this.bestStreak = 0;
  }

  get active() {
    return this.startedAt !== null && this.endedAt === null;
  }

  /**
   * @param {{words?: string[], morphMode?: boolean}} [options]
   * @returns {Record<string, any>}
   */
  start(options = {}) {
    if (this.active) throw new Error('RapidTapChallenge is already running');
    this.startedAt = this.now();
    this.endedAt = null;
    this.words = Array.isArray(options.words) ? [...options.words] : [];
    this.morphMode = options.morphMode === true;
    this.correct = 0;
    this.wrong = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.enabled = true;
    return this.snapshot();
  }

  /**
   * 只更新挑战内存；调用方不得把它写回学习状态。
   * @param {{wordId?: string, correct?: boolean}} input
   * @returns {Record<string, any>}
   */
  tap(input = {}) {
    if (!this.active) throw new Error('RapidTapChallenge is not running');
    if (input.correct) {
      this.correct += 1;
      this.streak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
    } else {
      this.wrong += 1;
      this.streak = 0;
    }
    return this.snapshot();
  }

  /** @returns {Record<string, any>} */
  stop() {
    if (this.active) this.endedAt = this.now();
    this.enabled = false;
    return this.snapshot();
  }

  /** @returns {Record<string, any>} */
  snapshot() {
    const elapsed = this.startedAt === null ? 0 : Math.max(0, (this.endedAt ?? this.now()) - this.startedAt);
    return {
      active: this.active,
      enabled: this.enabled,
      morphMode: this.morphMode,
      words: [...this.words],
      correct: this.correct,
      wrong: this.wrong,
      streak: this.streak,
      bestStreak: this.bestStreak,
      elapsedMs: elapsed,
      remainingMs: Math.max(0, this.durationMs - elapsed),
      persisted: false,
    };
  }
}

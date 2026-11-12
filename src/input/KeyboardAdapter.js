/**
 * @layer input
 * @phase P10
 * @doc §3.2 三层解耦架构
 *
 * QWERTY 适配器：把输入框的文本变化翻译成 key-text，不判定拼写。
 * Enter/IME 的提交策略由 PracticeScreen 决定，避免适配器越层。
 */

function inputFromTarget(target) {
  if (target && typeof target.matches === 'function' && target.matches('input, textarea')) return target;
  if (target && typeof target.querySelector === 'function') {
    return target.querySelector('input, textarea');
  }
  return null;
}

export class KeyboardAdapter {
  /** @param {EventTarget|{addEventListener: Function, removeEventListener: Function}} target */
  constructor(target) {
    if (!target || typeof target.addEventListener !== 'function') {
      throw new TypeError('KeyboardAdapter needs an EventTarget');
    }
    this.target = target;
    this.detach = null;
  }

  /**
   * @param {(event: import('../core/contracts.js').InputEvent) => void} emit
   * @returns {() => void} detach
   */
  attach(emit) {
    if (typeof emit !== 'function') throw new TypeError('KeyboardAdapter needs an emit function');
    if (this.detach) return this.detach;
    const input = inputFromTarget(this.target);
    if (!input) throw new TypeError('KeyboardAdapter target has no input');
    let composing = false;
    const onChange = () => {
      if (composing) return;
      emit({ kind: 'key-text', text: String(input.value ?? '') });
    };
    const onCompositionStart = () => { composing = true; };
    const onCompositionEnd = () => { composing = false; onChange(); };

    input.addEventListener('input', onChange);
    input.addEventListener('compositionstart', onCompositionStart);
    input.addEventListener('compositionend', onCompositionEnd);
    this.detach = () => {
      input.removeEventListener('input', onChange);
      input.removeEventListener('compositionstart', onCompositionStart);
      input.removeEventListener('compositionend', onCompositionEnd);
      this.detach = null;
    };
    return this.detach;
  }
}

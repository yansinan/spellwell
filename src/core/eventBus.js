/**
 * @layer core
 * @phase P0
 * @doc §3.2 三层解耦架构
 *
 * 轻量事件总线：用于“已发生的事实”通知（如 attempt:recorded），
 * 不用于替代返回值，也不允许跨层隐式写状态。
 */

/**
 * @typedef {(payload: unknown) => void} EventListener
 */

/**
 * @param {{ onListenerError?: (error: unknown, event: string) => void }} [options]
 */
export function createEventBus(options = {}) {
  const onListenerError = options.onListenerError ?? ((error, event) => {
    // 事件监听器的错误不能打断其他监听器。
    console.error(`[eventBus] listener failed for "${event}"`, error);
  });

  /** @type {Map<string, Set<EventListener>>} */
  const listeners = new Map();

  /**
   * @param {string} event
   * @param {EventListener} listener
   * @returns {() => void} unsubscribe
   */
  function on(event, listener) {
    if (typeof event !== 'string' || event.length === 0) {
      throw new TypeError('event must be a non-empty string');
    }
    if (typeof listener !== 'function') {
      throw new TypeError('listener must be a function');
    }
    let set = listeners.get(event);
    if (!set) {
      set = new Set();
      listeners.set(event, set);
    }
    set.add(listener);
    return () => off(event, listener);
  }

  /**
   * @param {string} event
   * @param {EventListener} listener
   * @returns {() => void}
   */
  function once(event, listener) {
    const wrapper = (payload) => {
      off(event, wrapper);
      listener(payload);
    };
    wrapper.original = listener;
    return on(event, wrapper);
  }

  /**
   * @param {string} event
   * @param {EventListener} listener
   */
  function off(event, listener) {
    const set = listeners.get(event);
    if (!set) return;
    for (const entry of set) {
      if (entry === listener || entry.original === listener) {
        set.delete(entry);
        break;
      }
    }
    if (set.size === 0) listeners.delete(event);
  }

  /**
   * @param {string} event
   * @param {unknown} [payload]
   * @returns {number} 实际通知的监听器数量
   */
  function emit(event, payload) {
    const set = listeners.get(event);
    if (!set || set.size === 0) return 0;
    for (const listener of [...set]) {
      try {
        listener(payload);
      } catch (error) {
        onListenerError(error, event);
      }
    }
    return set.size;
  }

  /**
   * @param {string} [event] 不传则清空全部
   */
  function clear(event) {
    if (event === undefined) {
      listeners.clear();
      return;
    }
    listeners.delete(event);
  }

  /**
   * @param {string} event
   * @returns {number}
   */
  function listenerCount(event) {
    return listeners.get(event)?.size ?? 0;
  }

  return { on, once, off, emit, clear, listenerCount };
}

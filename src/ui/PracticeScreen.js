/**
 * @layer ui
 * @phase P1
 * @doc §2.1 孩子端（学习模块）
 *
 * P1 学习端：只渲染 RenderModel、收集语义 InputEvent、调用 PracticeSession。
 * 不实现判定算法；不写学习状态；学习界面保持纯英文。
 * T-SEQUENCE 同时支持点选与指针拖拽；已选单位可再次点击取消/修改。
 * 拖拽靠近槽位会吸附；未命中会弹回待选区；反馈音效由 Web Audio 合成。
 */

import { findNearestSlot } from './dragGeometry.js';
import { createSoundPlayer } from './sound.js';

const TYPE_COPY = Object.freeze({
  'T-SEQUENCE': {
    title: 'Build the word',
    hint: 'Tap or drag the sounds in order. Tap again to change.',
  },
  'T-FILL': { title: 'Fill the gap', hint: 'Tap the missing sound.' },
  'T-TYPE': { title: 'Type the word', hint: 'Type all the letters.' },
});

/**
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export class PracticeScreen {
  #root;
  #session;
  #debug;
  #current = null;
  #events = [];
  #locked = false;
  #timers = new Set();
  #drag = null;
  #suppressClick = false;
  #sound = createSoundPlayer();

  /**
   * @param {{
   *   root: HTMLElement,
   *   session: import('./PracticeSession.js').PracticeSession,
   *   debug?: boolean
   * }} input
   */
  constructor({ root, session, debug = false }) {
    if (!root) throw new Error('PracticeScreen needs a root element');
    if (!session) throw new Error('PracticeScreen needs a PracticeSession');
    this.#root = root;
    this.#session = session;
    this.#debug = debug;
  }

  mount() {
    this.#root.dataset.phase = 'P1';
    this.#root.dataset.surface = 'practice';
    this.#root.addEventListener('pointerdown', () => this.#sound.unlock(), { once: true, capture: true });
    this.#root.addEventListener('keydown', () => this.#sound.unlock(), { once: true, capture: true });
    this.#renderCurrent();
  }

  #clearTimers() {
    for (const timer of this.#timers) clearTimeout(timer);
    this.#timers.clear();
  }

  /**
   * @param {() => void} fn
   * @param {number} delay
   */
  #schedule(fn, delay) {
    const timer = setTimeout(() => {
      this.#timers.delete(timer);
      fn();
    }, delay);
    this.#timers.add(timer);
    return timer;
  }

  #renderCurrent() {
    this.#clearTimers();
    this.#clearDrag();
    if (this.#session.isComplete) {
      this.#renderDone();
      return;
    }
    this.#current = this.#session.buildCurrent();
    this.#events = [];
    this.#locked = false;
    this.#root.innerHTML = this.#questionTemplate();
    this.#bindQuestion();
    this.#bindSoundToggle();
  }

  #typeCopy() {
    return TYPE_COPY[this.#current?.spec.typeId] ?? {
      title: 'Spell the word',
      hint: 'Complete the word.',
    };
  }

  #unitText(unitId) {
    return this.#current?.renderModel.units.find((unit) => unit.unitId === unitId)?.text ?? '';
  }

  #eventForSlot(slotIndex) {
    return this.#events.find((event) => event.slotIndex === slotIndex);
  }

  #firstEmptySlot() {
    const count = this.#current?.renderModel.slots.length ?? 0;
    for (let index = 0; index < count; index += 1) {
      if (!this.#eventForSlot(index)) return index;
    }
    return null;
  }

  #allSlotsFilled() {
    const slots = this.#current?.renderModel.slots ?? [];
    return slots.length > 0 && slots.every((slot) => Boolean(this.#eventForSlot(slot.index)));
  }

  #selectedTexts() {
    const slots = this.#current?.renderModel.slots ?? [];
    return slots.map((slot) => {
      const event = this.#eventForSlot(slot.index);
      return event ? this.#unitText(event.unitId) : '';
    });
  }

  #usedUnitIds() {
    return new Set(this.#events.map((event) => event.unitId));
  }

  /**
   * @param {string} progress
   * @returns {string}
   */
  #headerTemplate(progress) {
    const muted = this.#sound.isMuted();
    return `
      <header class="sw-practice__header">
        <span class="sw-brand">SpellWell</span>
        <div class="sw-practice__tools">
          <span class="sw-progress" aria-label="Progress">${progress}</span>
          <button type="button" class="sw-sound" data-action="sound" aria-pressed="${muted}" aria-label="Sound effects">${muted ? 'Muted' : 'Sound'}</button>
        </div>
      </header>
    `;
  }

  #questionTemplate() {
    const { spec, bundle } = this.#current;
    const copy = this.#typeCopy();
    const progress = `${this.#session.currentIndex + 1} / ${this.#session.size}`;
    const word = escapeHtml(bundle.word.text);
    const slots = spec.typeId === 'T-TYPE' ? this.#typeInputTemplate() : this.#slotsTemplate();
    const tiles = spec.typeId === 'T-TYPE' ? '' : this.#tilesTemplate();
    const clear = spec.typeId === 'T-TYPE'
      ? ''
      : `<button type="button" class="sw-text-button" data-action="clear" ${this.#events.length === 0 ? 'disabled' : ''}>Clear</button>`;
    const showCheck = spec.typeId === 'T-TYPE' || spec.typeId === 'T-SEQUENCE';
    const checkDisabled = spec.typeId === 'T-TYPE' || !this.#allSlotsFilled();
    const check = showCheck
      ? `<button type="button" class="sw-check" data-action="check" ${checkDisabled ? 'disabled' : ''}>Check</button>`
      : '';

    return `
      <div class="sw-practice" data-type="${escapeHtml(spec.typeId)}" data-word-id="${escapeHtml(bundle.word.id)}">
        ${this.#headerTemplate(progress)}

        <main class="sw-practice__stage">
          <p class="sw-practice__kind">${copy.title}</p>
          <p class="sw-practice__word" aria-label="Word to spell">${word}</p>
          <p class="sw-practice__hint">${copy.hint}</p>

          ${slots}
          ${tiles}

          <p class="sw-feedback" data-role="feedback" aria-live="polite"></p>

          <div class="sw-actions">
            ${clear}
            ${check}
          </div>

          ${this.#debug ? '<pre class="sw-debug" data-role="debug">DEV · attempt log</pre>' : ''}
        </main>
      </div>
    `;
  }

  #slotsTemplate() {
    const { spec, bundle } = this.#current;
    if (spec.typeId === 'T-FILL') {
      const blankIndex = Number(spec.params.blankUnitIndex);
      const selected = this.#eventForSlot(blankIndex) ? this.#unitText(this.#eventForSlot(blankIndex).unitId) : '';
      return `
        <div class="sw-slots" data-role="slots">
          ${bundle.word.units.map((unit, index) => {
            if (index === blankIndex) {
              return `<button type="button" class="sw-slot sw-slot--blank ${selected ? 'is-filled' : ''}" data-slot-index="${index}" aria-label="Missing sound">${escapeHtml(selected)}</button>`;
            }
            return `<span class="sw-slot sw-slot--fixed">${escapeHtml(unit.text)}</span>`;
          }).join('')}
        </div>
      `;
    }

    const selected = this.#selectedTexts();
    return `
      <div class="sw-slots" data-role="slots">
        ${this.#current.renderModel.slots.map((slot) => {
          const text = selected[slot.index] ?? '';
          const label = text ? `Remove ${text}` : `Slot ${slot.index + 1}`;
          return `<button type="button" class="sw-slot ${text ? 'is-filled' : ''}" data-slot-index="${slot.index}" tabindex="${text ? '0' : '-1'}" aria-label="${escapeHtml(label)}">${escapeHtml(text)}</button>`;
        }).join('')}
      </div>
    `;
  }

  #tilesTemplate() {
    const used = this.#usedUnitIds();
    return `
      <div class="sw-tiles" data-role="tiles">
        ${this.#current.renderModel.units.map((unit) => {
          const isUsed = used.has(unit.unitId);
          return `<button type="button" class="sw-tile ${isUsed ? 'is-used' : ''}" data-unit-id="${escapeHtml(unit.unitId)}" data-text="${escapeHtml(unit.text)}" aria-pressed="${isUsed}">${escapeHtml(unit.text)}</button>`;
        }).join('')}
      </div>
    `;
  }

  #typeInputTemplate() {
    return `
      <div class="sw-type-row">
        <input
          class="sw-type-input"
          data-role="type-input"
          type="text"
          inputmode="text"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          aria-label="Type the word"
          placeholder="type here"
        />
      </div>
    `;
  }

  #bindQuestion() {
    const spec = this.#current.spec;
    for (const button of this.#root.querySelectorAll('[data-unit-id]')) {
      const unitId = /** @type {HTMLElement} */ (button).dataset.unitId ?? '';
      button.addEventListener('click', (event) => {
        // 鼠标/触摸由 pointerup 处理；detail=0 是键盘触发的 click。
        if (spec.typeId === 'T-SEQUENCE') {
          if (this.#suppressClick) return;
          if (/** @type {MouseEvent} */ (event).detail !== 0) return;
        }
        this.#activateTile(unitId);
      });
      if (spec.typeId === 'T-SEQUENCE') this.#bindDrag(/** @type {HTMLElement} */ (button), unitId);
    }

    if (spec.typeId === 'T-SEQUENCE') {
      for (const slot of this.#root.querySelectorAll('[data-slot-index]')) {
        slot.addEventListener('click', () => {
          if (this.#locked) return;
          const index = Number(/** @type {HTMLElement} */ (slot).dataset.slotIndex);
          if (!this.#eventForSlot(index)) return;
          this.#clearSlot(index);
        });
      }
    }

    const clear = this.#root.querySelector('[data-action="clear"]');
    clear?.addEventListener('click', () => {
      if (this.#locked) return;
      this.#clearTimers();
      this.#clearDrag();
      if (this.#events.length > 0) this.#sound.cancel();
      this.#events = [];
      this.#renderCurrent();
    });

    const check = this.#root.querySelector('[data-action="check"]');
    check?.addEventListener('click', () => this.#submit());

    const input = /** @type {HTMLInputElement|null} */ (this.#root.querySelector('[data-role="type-input"]'));
    if (input) {
      input.addEventListener('input', () => {
        const button = /** @type {HTMLButtonElement|null} */ (this.#root.querySelector('[data-action="check"]'));
        if (button) button.disabled = input.value.trim().length === 0;
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          this.#submit();
        }
      });
    }
  }

  #bindSoundToggle() {
    const button = this.#root.querySelector('[data-action="sound"]');
    if (!button) return;
    button.addEventListener('click', () => {
      this.#sound.unlock();
      const muted = this.#sound.toggleMuted();
      button.textContent = muted ? 'Muted' : 'Sound';
      button.setAttribute('aria-pressed', String(muted));
      if (!muted) this.#sound.tap();
    });
  }

  /**
   * @param {HTMLElement} button
   * @param {string} unitId
   */
  #bindDrag(button, unitId) {
    button.addEventListener('pointerdown', (event) => {
      if (this.#locked || this.#drag) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;

      const drag = {
        pointerId: event.pointerId,
        unitId,
        button,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
        ghost: null,
        targetSlot: null,
        targetEl: null,
        move: (moveEvent) => this.#onDragMove(moveEvent),
        up: (upEvent) => this.#onDragEnd(upEvent),
        cancel: (cancelEvent) => this.#onDragCancel(cancelEvent),
      };
      this.#drag = drag;

      // 监听 window 而不是只监听按钮：即使 pointer capture 失效、指针离开按钮，
      // 浮层也能继续跟随，避免“拖到一半按钮不动/逻辑卡住”。
      window.addEventListener('pointermove', drag.move, { passive: false });
      window.addEventListener('pointerup', drag.up);
      window.addEventListener('pointercancel', drag.cancel);
      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        // 老浏览器不支持 capture 时，window 监听仍然兜底。
      }
    });
  }

  #onDragMove(event) {
    const drag = this.#drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 8) return;
    if (!drag.active) {
      drag.active = true;
      drag.button.classList.add('is-dragging');
      drag.ghost = document.createElement('div');
      drag.ghost.className = 'sw-drag-ghost';
      drag.ghost.textContent = drag.button.textContent ?? '';
      document.body.appendChild(drag.ghost);
      this.#sound.pickup();
    }
    event.preventDefault();
    this.#moveDragGhost(event.clientX, event.clientY);
    this.#highlightDropTarget(event.clientX, event.clientY);
  }

  #onDragEnd(event) {
    const drag = this.#drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const wasActive = drag.active;
    const draggedUnitId = drag.unitId;
    const nearest = wasActive ? this.#nearestSlotAt(event.clientX, event.clientY) : null;
    this.#removeDragListeners(drag);
    this.#suppressClick = true;
    setTimeout(() => {
      this.#suppressClick = false;
    }, 50);

    if (wasActive) {
      event.preventDefault();
      if (nearest) {
        this.#clearDrag();
        this.#placeUnit(draggedUnitId, nearest.index, 'drag-unit');
      } else {
        this.#bounceBack(drag);
      }
      return;
    }

    this.#clearDrag();
    this.#activateTile(draggedUnitId);
  }

  #onDragCancel(event) {
    const drag = this.#drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.active) this.#bounceBack(drag);
    else this.#clearDrag();
  }

  /**
   * @param {NonNullable<typeof this.#drag>} drag
   */
  #removeDragListeners(drag) {
    if (!drag) return;
    window.removeEventListener('pointermove', drag.move);
    window.removeEventListener('pointerup', drag.up);
    window.removeEventListener('pointercancel', drag.cancel);
    try {
      drag.button.releasePointerCapture(drag.pointerId);
    } catch {
      // 浏览器可能已经自动释放。
    }
  }

  #moveDragGhost(x, y) {
    if (!this.#drag?.ghost) return;
    this.#drag.ghost.style.left = `${x}px`;
    this.#drag.ghost.style.top = `${y}px`;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {({index: number, element: Element, distance: number}|null)}
   */
  #nearestSlotAt(x, y) {
    const slots = [...this.#root.querySelectorAll('[data-slot-index]')].map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        index: Number(/** @type {HTMLElement} */ (element).dataset.slotIndex),
        element,
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      };
    });
    return findNearestSlot(slots, { x, y }, 64);
  }

  #highlightDropTarget(x, y) {
    const drag = this.#drag;
    if (!drag) return;
    const nearest = this.#nearestSlotAt(x, y);
    const target = nearest?.element ?? null;
    const targetSlot = nearest?.index ?? null;
    if (drag.targetEl === target && drag.targetSlot === targetSlot) return;
    drag.targetEl?.classList.remove('is-drop-target');
    drag.targetEl = target;
    drag.targetSlot = targetSlot;
    target?.classList.add('is-drop-target');
  }

  /**
   * 未命中槽位：把拖拽浮层以 240ms 缓动弹回来源块，原块不移动。
   * @param {NonNullable<typeof this.#drag>} drag
   */
  #bounceBack(drag) {
    if (!drag) return;
    this.#removeDragListeners(drag);
    const { ghost, button } = drag;
    drag.targetEl?.classList.remove('is-drop-target');
    button.classList.remove('is-dragging');
    this.#drag = null;
    this.#sound.bounce();

    if (!ghost) return;
    const targetRect = button.getBoundingClientRect();
    const ghostRect = ghost.getBoundingClientRect();
    const fromLeft = ghost.style.left || `${ghostRect.left + ghostRect.width / 2}px`;
    const fromTop = ghost.style.top || `${ghostRect.top + ghostRect.height / 2}px`;
    const toLeft = `${targetRect.left + targetRect.width / 2}px`;
    const toTop = `${targetRect.top + targetRect.height / 2}px`;

    if (typeof ghost.animate !== 'function') {
      ghost.remove();
      return;
    }

    const animation = ghost.animate([
      {
        left: fromLeft,
        top: fromTop,
        opacity: 0.95,
        transform: 'translate(-50%, -50%) rotate(-2deg) scale(1)',
      },
      {
        left: toLeft,
        top: toTop,
        opacity: 0,
        transform: 'translate(-50%, -50%) rotate(0deg) scale(0.82)',
      },
    ], {
      duration: 240,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    });
    animation.finished.then(() => ghost.remove(), () => ghost.remove());
  }

  #clearDrag() {
    if (!this.#drag) return;
    this.#removeDragListeners(this.#drag);
    this.#drag.ghost?.remove();
    this.#drag.button.classList.remove('is-dragging');
    this.#drag.targetEl?.classList.remove('is-drop-target');
    this.#drag = null;
  }

  /**
   * @param {string} unitId
   * @param {number} slotIndex
   * @param {'tap-unit'|'drag-unit'} kind
   */
  #placeUnit(unitId, slotIndex, kind) {
    if (this.#locked) return;
    const { spec, renderModel } = this.#current;
    if (spec.typeId !== 'T-SEQUENCE') return;
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= renderModel.slots.length) return;

    this.#events = this.#events.filter(
      (event) => event.slotIndex !== slotIndex && event.unitId !== unitId,
    );
    this.#events.push({ kind, unitId, slotIndex });
    if (kind === 'drag-unit') this.#sound.drop();
    this.#afterSelectionChange();
  }

  #activateTile(unitId) {
    if (this.#locked || !unitId) return;
    const { spec } = this.#current;

    if (spec.typeId === 'T-SEQUENCE') {
      const existing = this.#events.find((event) => event.unitId === unitId);
      if (existing) {
        this.#clearSlot(existing.slotIndex);
        return;
      }
      const slotIndex = this.#firstEmptySlot();
      if (slotIndex === null) return;
      this.#sound.tap();
      this.#placeUnit(unitId, slotIndex, 'tap-unit');
      return;
    }

    if (spec.typeId === 'T-FILL') {
      const blankIndex = Number(spec.params.blankUnitIndex);
      this.#sound.tap();
      this.#events = [{ kind: 'tap-unit', unitId, slotIndex: blankIndex }];
      this.#afterSelectionChange();
      this.#schedule(() => this.#submit(), 320);
    }
  }

  #clearSlot(slotIndex) {
    if (this.#locked) return;
    this.#sound.cancel();
    this.#clearTimers();
    this.#events = this.#events.filter((event) => event.slotIndex !== slotIndex);
    this.#afterSelectionChange();
  }

  #afterSelectionChange() {
    this.#clearTimers();
    this.#root.innerHTML = this.#questionTemplate();
    this.#bindQuestion();
    this.#bindSoundToggle();
  }

  #submit() {
    if (this.#locked || this.#session.isComplete) return;
    const { spec } = this.#current;
    let events = this.#events;

    if (spec.typeId === 'T-TYPE') {
      const input = /** @type {HTMLInputElement|null} */ (this.#root.querySelector('[data-role="type-input"]'));
      const text = input?.value ?? '';
      if (text.trim().length === 0) return;
      events = [{ kind: 'key-text', text }];
    } else if (spec.typeId === 'T-FILL' && events.length === 0) {
      return;
    } else if (spec.typeId === 'T-SEQUENCE' && !this.#allSlotsFilled()) {
      return;
    }

    this.#locked = true;
    this.#clearTimers();
    this.#clearDrag();
    const result = this.#session.submit(events);
    this.#updateDebug(result);

    const stage = this.#root.querySelector('.sw-practice__stage');
    const feedback = this.#root.querySelector('[data-role="feedback"]');
    if (result.wordCorrect) this.#sound.correct();
    else this.#sound.wrong();
    stage?.classList.add(result.wordCorrect ? 'is-correct' : 'is-wrong');
    if (feedback) feedback.textContent = result.wordCorrect ? 'Nice.' : 'Next.';

    for (const button of this.#root.querySelectorAll('button, input')) {
      /** @type {HTMLButtonElement|HTMLInputElement} */ (button).disabled = true;
    }

    this.#schedule(() => {
      this.#session.advance();
      this.#renderCurrent();
    }, 900);
  }

  #updateDebug(result) {
    if (!this.#debug) return;
    const debug = this.#root.querySelector('[data-role="debug"]');
    if (!debug) return;
    debug.textContent = JSON.stringify({
      specId: this.#current?.spec.specId,
      typeId: this.#current?.spec.typeId,
      result,
    }, null, 2);
  }

  #renderDone() {
    this.#clearDrag();
    this.#root.innerHTML = `
      <div class="sw-practice sw-practice--done" data-type="done">
        ${this.#headerTemplate(`${this.#session.size} / ${this.#session.size}`)}
        <main class="sw-practice__stage sw-done">
          <p class="sw-eyebrow">SESSION COMPLETE</p>
          <h1 class="sw-done__title">Done.</h1>
          <p class="sw-practice__hint">${this.#session.size} spellings.</p>
          <button type="button" class="sw-check" data-action="again">Again</button>
        </main>
      </div>
    `;
    this.#root.querySelector('[data-action="again"]')?.addEventListener('click', () => {
      this.#session.restart();
      this.#renderCurrent();
    });
    this.#bindSoundToggle();
    this.#sound.complete();
  }
}

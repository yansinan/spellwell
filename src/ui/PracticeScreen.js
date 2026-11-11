/**
 * @layer ui
 * @phase P4
 * @doc §2.1 孩子端（学习模块）
 *
 * P1 学习端：只渲染 RenderModel、收集语义 InputEvent、调用 PracticeSession。
 * 不实现判定算法；不写学习状态；学习界面保持纯英文。
 * T-SEQUENCE 同时支持点选与指针拖拽；已选单位可再次点击取消/修改。
 * 拖拽靠近槽位会吸附；未命中会弹回待选区；反馈音效由 Web Audio 合成。
 */

import { findNearestSlot } from './dragGeometry.js';
import { insertUnit, insertionIndexForPoint, previewInsertUnit } from './sequenceOrder.js';
import { createSoundPlayer } from './sound.js';

const TYPE_COPY = Object.freeze({
  'T-SEQUENCE': {
    title: 'Build the word',
    hint: 'Tap to choose. Drag to reorder. Tap a placed sound to change.',
  },
  'T-FILL': { title: 'Fill the gap', hint: 'Tap the missing sound.' },
  'T-TYPE': { title: 'Type the word', hint: 'Type all the letters.' },
  'T-REORDER': { title: 'Put the sounds in order', hint: 'Tap two sounds to swap them.' },
  'T-EDIT': { title: 'Fix the word', hint: 'Edit the letters, then check.' },
  'T-SEGMENT': { title: 'Mark the sounds', hint: 'Tap the gaps between sounds.' },
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
  #previewGap = null;
  #previewKey = null;
  #onResult;
  #reorderOrder = [];
  #reorderInitial = [];
  #reorderSelected = null;
  #sound = createSoundPlayer();

  /**
   * @param {{
   *   root: HTMLElement,
   *   session: import('./PracticeSession.js').PracticeSession,
   *   debug?: boolean,
   *   onResult?: (result: import('../core/contracts.js').AttemptResult) => Promise<void>|void
   * }} input
   */
  constructor({ root, session, debug = false, onResult = null }) {
    if (!root) throw new Error('PracticeScreen needs a root element');
    if (!session) throw new Error('PracticeScreen needs a PracticeSession');
    if (onResult !== null && typeof onResult !== 'function') throw new Error('onResult must be a function');
    this.#root = root;
    this.#session = session;
    this.#debug = debug;
    this.#onResult = onResult;
  }

  mount() {
    this.#root.dataset.phase = 'P3';
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
    this.#reorderSelected = null;
    this.#reorderOrder = this.#current.renderModel.slots.map((slot) => slot.unitId ?? '');
    this.#reorderInitial = [...this.#reorderOrder];
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
    const isType = spec.typeId === 'T-TYPE';
    const isEdit = spec.typeId === 'T-EDIT';
    const isSegment = spec.typeId === 'T-SEGMENT';
    const slots = isType
      ? this.#typeInputTemplate()
      : isEdit
        ? this.#editInputTemplate()
        : isSegment
          ? this.#segmentTemplate()
          : this.#slotsTemplate();
    const tiles = spec.typeId === 'T-SEQUENCE' || spec.typeId === 'T-FILL'
      ? this.#tilesTemplate()
      : '';
    const clear = isType || isEdit
      ? ''
      : `<button type="button" class="sw-text-button" data-action="clear" ${this.#events.length === 0 ? 'disabled' : ''}>Clear</button>`;
    const showCheck = ['T-TYPE', 'T-EDIT', 'T-SEQUENCE', 'T-REORDER', 'T-SEGMENT'].includes(spec.typeId);
    const checkDisabled = spec.typeId === 'T-TYPE'
      || (spec.typeId === 'T-SEQUENCE' && !this.#allSlotsFilled());
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
    if (spec.typeId === 'T-REORDER') {
      return `
        <div class="sw-slots sw-slots--reorder" data-role="reorder">
          ${this.#reorderOrder.map((unitId, index) => {
            const text = this.#unitText(unitId);
            const selected = this.#reorderSelected === index;
            return `<button type="button" class="sw-slot is-filled ${selected ? 'is-selected' : ''}" data-reorder-index="${index}" aria-pressed="${selected}" aria-label="Swap ${escapeHtml(text)}">${escapeHtml(text)}</button>`;
          }).join('')}
        </div>
      `;
    }
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
          return `<button type="button" class="sw-tile ${isUsed ? 'is-used' : ''}" data-unit-id="${escapeHtml(unit.unitId)}" data-text="${escapeHtml(unit.text)}" aria-pressed="${isUsed}" ${isUsed ? 'disabled aria-disabled="true"' : ''}>${escapeHtml(unit.text)}</button>`;
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

  #editInputTemplate() {
    const value = escapeHtml(this.#current.renderModel.fixedText ?? '');
    return `
      <div class="sw-type-row">
        <input
          class="sw-type-input"
          data-role="edit-input"
          type="text"
          inputmode="text"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          aria-label="Edit the word"
          value="${value}"
        />
      </div>
    `;
  }

  #segmentTemplate() {
    const text = String(this.#current.renderModel.fixedText ?? '');
    const selected = new Set(
      this.#events.filter((event) => event.kind === 'tap-gap').map((event) => event.gapIndex),
    );
    const parts = [];
    for (let index = 0; index < text.length; index += 1) {
      parts.push(`<span class="sw-segment__letter">${escapeHtml(text[index])}</span>`);
      if (index < text.length - 1) {
        const gapIndex = index + 1;
        const on = selected.has(gapIndex);
        parts.push(`<button type="button" class="sw-gap ${on ? 'is-on' : ''}" data-gap-index="${gapIndex}" aria-pressed="${on}" aria-label="Gap ${gapIndex}"></button>`);
      }
    }
    return `<div class="sw-segments" data-role="segments">${parts.join('')}</div>`;
  }

  #bindQuestion() {
    const spec = this.#current.spec;
    for (const button of this.#root.querySelectorAll('[data-unit-id]')) {
      if (/** @type {HTMLButtonElement} */ (button).disabled) continue;
      const unitId = /** @type {HTMLElement} */ (button).dataset.unitId ?? '';
      button.addEventListener('click', (event) => {
        // 鼠标/触摸由 pointerup 处理；detail=0 是键盘触发的 click。
        if (spec.typeId === 'T-SEQUENCE') {
          if (this.#suppressClick) return;
          if (/** @type {MouseEvent} */ (event).detail !== 0) return;
        }
        this.#activateTile(unitId);
      });
      if (spec.typeId === 'T-SEQUENCE') this.#bindDrag(/** @type {HTMLElement} */ (button), unitId, { sourceKind: 'tile' });
    }

    if (spec.typeId === 'T-SEQUENCE') {
      for (const slot of this.#root.querySelectorAll('[data-slot-index]')) {
        const index = Number(/** @type {HTMLElement} */ (slot).dataset.slotIndex);
        const slotEvent = this.#eventForSlot(index);
        slot.addEventListener('click', () => {
          if (this.#locked || this.#suppressClick) return;
          if (!this.#eventForSlot(index)) return;
          this.#clearSlot(index);
        });
        if (slotEvent) {
          this.#bindDrag(/** @type {HTMLElement} */ (slot), slotEvent.unitId, {
            sourceKind: 'slot',
            sourceSlotIndex: index,
          });
        }
      }
    }

    if (spec.typeId === 'T-REORDER') {
      for (const button of this.#root.querySelectorAll('[data-reorder-index]')) {
        button.addEventListener('click', () => {
          this.#onReorderTap(Number(/** @type {HTMLElement} */ (button).dataset.reorderIndex));
        });
      }
    }

    if (spec.typeId === 'T-SEGMENT') {
      for (const gap of this.#root.querySelectorAll('[data-gap-index]')) {
        gap.addEventListener('click', () => {
          this.#toggleGap(Number(/** @type {HTMLElement} */ (gap).dataset.gapIndex));
        });
      }
    }

    const editInput = /** @type {HTMLInputElement|null} */ (this.#root.querySelector('[data-role="edit-input"]'));
    if (editInput) {
      const button = /** @type {HTMLButtonElement|null} */ (this.#root.querySelector('[data-action="check"]'));
      const sync = () => {
        if (button) button.disabled = editInput.value.trim().length === 0;
      };
      editInput.addEventListener('input', sync);
      editInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          this.#submit();
        }
      });
      sync();
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
   * @param {{sourceKind?: 'tile'|'slot', sourceSlotIndex?: number}} [options]
   */
  #bindDrag(button, unitId, options = {}) {
    button.addEventListener('pointerdown', (event) => {
      if (this.#locked || this.#drag) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;

      const drag = {
        pointerId: event.pointerId,
        unitId,
        button,
        sourceKind: options.sourceKind ?? 'tile',
        sourceSlotIndex: options.sourceSlotIndex ?? null,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
        ghost: null,
        insertIndex: null,
        targetSide: null,
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
    const drop = wasActive ? this.#dropAt(event.clientX, event.clientY) : null;
    this.#removeDragListeners(drag);
    this.#suppressClick = true;
    setTimeout(() => {
      this.#suppressClick = false;
    }, 50);

    if (wasActive) {
      event.preventDefault();
      if (!drop) {
        this.#bounceBack(drag);
        return;
      }
      const inserted = this.#insertUnit(draggedUnitId, drop.insertIndex);
      if (!inserted) {
        this.#bounceBack(drag);
        return;
      }
      this.#clearDrag();
      return;
    }

    if (drag.sourceKind === 'slot' && drag.sourceSlotIndex !== null) {
      this.#clearDrag();
      this.#clearSlot(drag.sourceSlotIndex);
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

  #dropAt(x, y) {
    const nearest = this.#nearestSlotAt(x, y);
    if (!nearest) return null;
    const rect = nearest.element.getBoundingClientRect();
    const insertIndex = insertionIndexForPoint(nearest.index, rect, x);
    const side = x >= rect.left + rect.width / 2 ? 'after' : 'before';
    return { element: nearest.element, slotIndex: nearest.index, insertIndex, side };
  }

  #highlightDropTarget(x, y) {
    const drag = this.#drag;
    if (!drag) return;
    const drop = this.#dropAt(x, y);
    const target = drop?.element ?? null;
    if (drag.targetEl === target && drag.insertIndex === (drop?.insertIndex ?? null)) return;
    drag.targetEl?.classList.remove('is-drop-target', 'is-drop-before', 'is-drop-after');
    drag.targetEl = target;
    drag.insertIndex = drop?.insertIndex ?? null;
    drag.targetSide = drop?.side ?? null;
    if (target && drop) target.classList.add('is-drop-target', `is-drop-${drop.side}`);
    if (drop) this.#applyPreview(drag, drop);
    else this.#clearPreview();
  }

  /**
   * 实时预览：把当前槽位内容按预览映射平移，在插入点显示缺口。
   * 只改 transform/opacity，不改 #events，释放后由 #insertUnit 提交。
   * @param {NonNullable<typeof this.#drag>} drag
   * @param {{insertIndex: number}} drop
   */
  #applyPreview(drag, drop) {
    const current = [...this.#events]
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .map((event) => event.unitId);
    const preview = previewInsertUnit(
      current,
      drag.unitId,
      drop.insertIndex,
      this.#current.renderModel.slots.length,
    );
    if (!preview) {
      this.#clearPreview();
      return;
    }

    const key = `${preview.insertAt}|${preview.sourceIndex}|${current.join('|')}`;
    if (this.#previewKey === key) return;

    const container = this.#root.querySelector('.sw-slots');
    if (!container) return;
    container.classList.add('is-previewing');
    const slotEls = [...container.querySelectorAll('[data-slot-index]')];

    for (const element of slotEls) {
      const index = Number(/** @type {HTMLElement} */ (element).dataset.slotIndex);
      const event = this.#eventForSlot(index);
      if (!event || index === preview.sourceIndex) {
        element.style.opacity = '0';
        element.style.transform = '';
        continue;
      }
      const move = preview.moves.find((candidate) => candidate.from === index);
      const target = move?.to ?? index;
      const targetEl = slotEls.find(
        (candidate) => Number(/** @type {HTMLElement} */ (candidate).dataset.slotIndex) === target,
      );
      const dx = targetEl ? targetEl.offsetLeft - element.offsetLeft : 0;
      element.style.opacity = '1';
      element.style.transform = dx === 0 ? '' : `translateX(${dx}px)`;
    }

    const gapTarget = slotEls.find(
      (candidate) => Number(/** @type {HTMLElement} */ (candidate).dataset.slotIndex) === preview.insertAt,
    );
    if (!gapTarget) return;
    let gap = this.#previewGap;
    if (!gap) {
      gap = document.createElement('div');
      gap.className = 'sw-preview-gap';
      gap.setAttribute('aria-hidden', 'true');
      container.appendChild(gap);
      this.#previewGap = gap;
    }
    gap.style.left = `${gapTarget.offsetLeft}px`;
    gap.style.top = `${gapTarget.offsetTop}px`;
    gap.style.width = `${gapTarget.offsetWidth}px`;
    gap.style.height = `${gapTarget.offsetHeight}px`;
    this.#previewKey = key;
  }

  #clearPreview() {
    const container = this.#root.querySelector('.sw-slots');
    container?.classList.remove('is-previewing');
    for (const element of container?.querySelectorAll('[data-slot-index]') ?? []) {
      element.style.transform = '';
      element.style.opacity = '';
    }
    this.#previewGap?.remove();
    this.#previewGap = null;
    this.#previewKey = null;
  }

  /**
   * 未命中槽位：把拖拽浮层以 240ms 缓动弹回来源块，原块不移动。
   * @param {NonNullable<typeof this.#drag>} drag
   */
  #bounceBack(drag) {
    if (!drag) return;
    this.#clearPreview();
    this.#removeDragListeners(drag);
    const { ghost, button } = drag;
    drag.targetEl?.classList.remove('is-drop-target', 'is-drop-before', 'is-drop-after');
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
    this.#clearPreview();
    this.#removeDragListeners(this.#drag);
    this.#drag.ghost?.remove();
    this.#drag.button.classList.remove('is-dragging');
    this.#drag.targetEl?.classList.remove('is-drop-target', 'is-drop-before', 'is-drop-after');
    this.#drag = null;
  }

  #insertUnit(unitId, boundary) {
    if (this.#locked) return false;
    const { spec, renderModel } = this.#current;
    if (spec.typeId !== 'T-SEQUENCE') return false;
    const ordered = [...this.#events]
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .map((event) => event.unitId);
    const next = insertUnit(ordered, unitId, boundary, renderModel.slots.length);
    if (!next) return false;
    this.#events = next.map((id, index) => ({
      kind: 'drag-unit',
      unitId: id,
      slotIndex: index,
    }));
    this.#sound.drop();
    this.#afterSelectionChange();
    return true;
  }

  #onReorderTap(index) {
    if (this.#locked) return;
    if (this.#reorderSelected === null) {
      this.#reorderSelected = index;
      this.#sound.tap();
      this.#afterSelectionChange();
      return;
    }
    if (this.#reorderSelected === index) {
      this.#reorderSelected = null;
      this.#sound.cancel();
      this.#afterSelectionChange();
      return;
    }
    const from = this.#reorderSelected;
    const to = index;
    [this.#reorderOrder[from], this.#reorderOrder[to]] = [this.#reorderOrder[to], this.#reorderOrder[from]];
    this.#events.push({ kind: 'reorder', fromIndex: from, toIndex: to });
    this.#reorderSelected = null;
    this.#sound.tap();
    this.#afterSelectionChange();
  }

  #toggleGap(gapIndex) {
    if (this.#locked) return;
    const at = this.#events.findIndex(
      (event) => event.kind === 'tap-gap' && event.gapIndex === gapIndex,
    );
    if (at >= 0) this.#events.splice(at, 1);
    else this.#events.push({ kind: 'tap-gap', gapIndex });
    this.#sound.tap();
    this.#afterSelectionChange();
  }

  #activateTile(unitId) {
    if (this.#locked || !unitId) return;
    if (this.#events.some((event) => event.unitId === unitId)) return;
    const { spec } = this.#current;

    if (spec.typeId === 'T-SEQUENCE') {
      if (this.#events.length >= this.#current.renderModel.slots.length) return;
      this.#sound.tap();
      this.#events.push({
        kind: 'tap-unit',
        unitId,
        slotIndex: this.#events.length,
      });
      this.#afterSelectionChange();
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
    const ordered = this.#events
      .filter((event) => event.slotIndex !== slotIndex)
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .map((event) => event.unitId);
    this.#events = ordered.map((id, index) => ({
      kind: 'tap-unit',
      unitId: id,
      slotIndex: index,
    }));
    this.#afterSelectionChange();
  }

  #afterSelectionChange() {
    this.#clearTimers();
    this.#root.innerHTML = this.#questionTemplate();
    this.#bindQuestion();
    this.#bindSoundToggle();
  }

  async #submit() {
    if (this.#locked || this.#session.isComplete) return;
    const { spec } = this.#current;
    let events = this.#events;

    if (spec.typeId === 'T-TYPE') {
      const input = /** @type {HTMLInputElement|null} */ (this.#root.querySelector('[data-role="type-input"]'));
      const text = input?.value ?? '';
      if (text.trim().length === 0) return;
      events = [{ kind: 'key-text', text }];
    } else if (spec.typeId === 'T-EDIT') {
      const input = /** @type {HTMLInputElement|null} */ (this.#root.querySelector('[data-role="edit-input"]'));
      const text = input?.value ?? '';
      if (text.trim().length === 0) return;
      events = [{ kind: 'edit', text }];
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
    if (this.#onResult) {
      try {
        await this.#onResult(result);
      } catch (error) {
        console.error('[SpellWell] failed to record attempt', error);
      }
    }

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

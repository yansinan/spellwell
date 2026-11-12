/**
 * @layer tests
 * @phase P10
 * @doc §3.2 三层解耦架构
 */

import { KeyboardAdapter } from '../../src/input/KeyboardAdapter.js';
import { PointerAdapter } from '../../src/input/PointerAdapter.js';
import { validateInputEvent } from '../../src/core/contracts.js';
import { assertDeepEqual, assertEqual, test } from '../harness.js';

class FakeTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  dispatch(type, event) { for (const fn of this.listeners.get(type) ?? []) fn(event); }
}

class FakeNode {
  constructor(attrs = {}, parentElement = null) { this.attrs = attrs; this.parentElement = parentElement; }
  getAttribute(name) { return Object.hasOwn(this.attrs, name) ? this.attrs[name] : null; }
}

function pointerEvent(node, x = 0, y = 0) {
  return { button: 0, pointerId: 1, clientX: x, clientY: y, target: node };
}

test('PointerAdapter：点选/拖放/间隙都输出合法 InputEvent', () => {
  const target = new FakeTarget();
  const button = new FakeNode({ 'data-unit-id': 'unit:sh' });
  const slot = new FakeNode({ 'data-slot-index': '2' }, button);
  const gap = new FakeNode({ 'data-gap-index': '3' });
  const events = [];
  const adapter = new PointerAdapter(target);
  const detach = adapter.attach((event) => events.push(event));

  target.dispatch('pointerdown', pointerEvent(button, 10, 10));
  target.dispatch('pointerup', pointerEvent(button, 11, 11));
  target.dispatch('pointerdown', pointerEvent(button, 10, 10));
  target.dispatch('pointerup', pointerEvent(slot, 40, 40));
  target.dispatch('pointerdown', pointerEvent(gap, 10, 10));
  target.dispatch('pointerup', pointerEvent(gap, 11, 11));

  assertDeepEqual(events.map((event) => event.kind), ['tap-unit', 'drag-unit', 'tap-gap']);
  assertEqual(events[1].slotIndex, 2);
  for (const event of events) assertEqual(validateInputEvent(event), true);
  detach();
  target.dispatch('pointerdown', pointerEvent(button));
  target.dispatch('pointerup', pointerEvent(button));
  assertEqual(events.length, 3);
});

test('KeyboardAdapter：输入/IME 只输出 key-text', () => {
  const input = new FakeTarget();
  input.value = 'bird';
  const target = { addEventListener: input.addEventListener.bind(input), removeEventListener: input.removeEventListener.bind(input), querySelector: () => input };
  const events = [];
  const adapter = new KeyboardAdapter(target);
  const detach = adapter.attach((event) => events.push(event));
  input.dispatch('input', {});
  input.dispatch('compositionstart', {});
  input.value = 'birdx';
  input.dispatch('input', {});
  input.dispatch('compositionend', {});
  assertDeepEqual(events, [
    { kind: 'key-text', text: 'bird' },
    { kind: 'key-text', text: 'birdx' },
  ]);
  for (const event of events) assertEqual(validateInputEvent(event), true);
  detach();
});

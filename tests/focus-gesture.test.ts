import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeFocusGesture } from '../src/focus-gesture';
function pointer(canvas: EventTarget, type: string, x = 100, y = 100, id = 1) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y });
  canvas.dispatchEvent(event);
}
function tap(canvas: EventTarget, x = 100, y = 100) {
  pointer(canvas, 'pointerdown', x, y); pointer(canvas, 'pointerup', x, y);
}
function doubleClick(canvas: EventTarget, button = 0) {
  const event = new Event('dblclick', { cancelable: true });
  Object.assign(event, { button, clientX: 100, clientY: 100 }); canvas.dispatchEvent(event);
}
afterEach(() => vi.restoreAllMocks());
describe('mouse and touch model focus', () => {
  it('accepts left double click and double tap, suppressing duplicate browser mouse events', () => {
    let now = 0; vi.spyOn(performance, 'now').mockImplementation(() => now);
    const canvas = new EventTarget(), focus = vi.fn();
    const dispose = initializeFocusGesture(canvas as HTMLElement, focus);
    doubleClick(canvas, 2); expect(focus).not.toHaveBeenCalled();
    doubleClick(canvas); expect(focus).toHaveBeenCalledExactlyOnceWith(100, 100);
    focus.mockClear(); tap(canvas); expect(focus).not.toHaveBeenCalled();
    now = 200; tap(canvas); expect(focus).toHaveBeenCalledExactlyOnceWith(100, 100);
    doubleClick(canvas); expect(focus).toHaveBeenCalledTimes(1);
    now = 1000; doubleClick(canvas); expect(focus).toHaveBeenCalledTimes(2);
    dispose(); tap(canvas); tap(canvas); doubleClick(canvas); expect(focus).toHaveBeenCalledTimes(2);
  });
  it.each(['drag', 'pinch', 'cancel', 'long press', 'distant', 'slow'])('does not focus after %s', gesture => {
    let now = 0; vi.spyOn(performance, 'now').mockImplementation(() => now);
    const canvas = new EventTarget(), focus = vi.fn(); initializeFocusGesture(canvas as HTMLElement, focus);
    tap(canvas); now = 100;
    if (gesture === 'distant') tap(canvas, 200, 200);
    else if (gesture === 'slow') { now = 500; tap(canvas); }
    else {
      pointer(canvas, 'pointerdown');
      if (gesture === 'drag') { pointer(canvas, 'pointermove', 120, 120); pointer(canvas, 'pointermove', 100, 100); }
      if (gesture === 'pinch') { pointer(canvas, 'pointerdown', 150, 150, 2); pointer(canvas, 'pointerup', 150, 150, 2); }
      if (gesture === 'cancel') pointer(canvas, 'pointercancel');
      if (gesture === 'long press') now = 600;
      pointer(canvas, 'pointerup');
    }
    expect(focus).not.toHaveBeenCalled();
  });
});

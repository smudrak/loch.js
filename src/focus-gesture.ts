/** Double click or a pair of short, nearby single-finger taps. */
export function initializeFocusGesture(canvas: HTMLElement, focus: (x: number, y: number) => void) {
  const abort = new AbortController(), options = { signal: abort.signal };
  const touches = new Set<number>();
  let active: { id: number; x: number; y: number; time: number } | undefined;
  let previous: { x: number; y: number; time: number } | undefined;
  let touchFocus: { x: number; y: number; time: number } | undefined;
  const nearby = (a: { x: number; y: number }, b: { x: number; y: number }, distance: number) => Math.hypot(a.x - b.x, a.y - b.y) <= distance;
  canvas.addEventListener('dblclick', event => {
    if (event.button !== 0) return;
    // Some browsers also synthesize dblclick after touch pointer events.
    if (touchFocus && performance.now() - touchFocus.time < 700
      && nearby(touchFocus, { x: event.clientX, y: event.clientY }, 24)) return;
    event.preventDefault(); focus(event.clientX, event.clientY);
  }, options);
  canvas.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    touches.add(event.pointerId);
    if (touches.size === 1) active = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now() };
    else { active = undefined; previous = undefined; }
  }, options);
  canvas.addEventListener('pointermove', event => {
    if (active?.id === event.pointerId && !nearby(active, { x: event.clientX, y: event.clientY }, 8)) {
      active = undefined; previous = undefined;
    }
  }, options);
  canvas.addEventListener('pointercancel', event => {
    if (!touches.delete(event.pointerId)) return;
    active = undefined; previous = undefined;
  }, options);
  canvas.addEventListener('pointerup', event => {
    if (!touches.delete(event.pointerId)) return;
    const tap = active; active = undefined;
    if (!tap || tap.id !== event.pointerId || touches.size) return;
    const now = performance.now(), point = { x: event.clientX, y: event.clientY, time: now };
    if (now - tap.time > 350 || !nearby(tap, point, 8)) { previous = undefined; return; }
    if (previous && now - previous.time <= 350 && nearby(previous, point, 24)) {
      previous = undefined; touchFocus = point;
      event.preventDefault(); focus(point.x, point.y);
    } else previous = point;
  }, options);
  return () => abort.abort();
}

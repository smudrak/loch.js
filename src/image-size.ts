export type AnimationQuality = 'low' | 'medium' | 'high';
export type AnimationSettings = { fps: number; quality: AnimationQuality };
export type ImageSize = { width: number; height: number };
export const MAX_IMAGE_PIXELS = 128 * 1024 * 1024;
export function validImageSize(size: ImageSize, maxDimension: number) {
  return Number.isInteger(size.width) && Number.isInteger(size.height) && size.width > 0 && size.height > 0
    && size.width <= maxDimension && size.height <= maxDimension && size.width * size.height <= MAX_IMAGE_PIXELS;
}
export function initializeImageSizeDialog(button: HTMLButtonElement, currentSize: () => ImageSize, maxDimension: number,
  animationButton?: HTMLButtonElement, screenWhiteBackground: () => boolean = () => false, animationInfo: () => { views: number; duration: number } = () => ({ views: 0, duration: 15 })) {
  const dialog = document.querySelector<HTMLDialogElement>('#image-size-dialog')!;
  const form = dialog.querySelector('form')!;
  const title = document.querySelector<HTMLElement>('#image-size-title')!;
  const width = document.querySelector<HTMLInputElement>('#image-width')!;
  const height = document.querySelector<HTMLInputElement>('#image-height')!;
  const aspect = document.querySelector<HTMLInputElement>('#image-aspect')!;
  const scale = document.querySelector<HTMLInputElement>('#image-overlay-scale')!;
  const white = document.querySelector<HTMLInputElement>('#image-white-background')!;
  const save = document.querySelector<HTMLButtonElement>('#image-save-confirm')!;
  const cancel = document.querySelector<HTMLButtonElement>('#image-save-cancel')!;
  const description = document.querySelector<HTMLElement>('#animation-description')!;
  const animationOptions = document.querySelector<HTMLElement>('#animation-options')!;
  const fps = document.querySelector<HTMLInputElement>('#animation-fps')!;
  const quality = document.querySelector<HTMLSelectElement>('#animation-quality')!;
  const progressPanel = document.querySelector<HTMLElement>('#animation-export-progress')!;
  const progress = document.querySelector<HTMLProgressElement>('#animation-progress')!;
  const progressText = document.querySelector<HTMLElement>('#animation-progress-text')!;
  let ratio = 1, busy = false, animation = false, abort = new AbortController();
  const size = () => ({ width: width.valueAsNumber, height: height.valueAsNumber });
  const round = (value: number) => animation ? Math.max(2, Math.round(value / 2) * 2) : Math.max(1, Math.round(value));
  for (const input of [width, height]) input.max = String(maxDimension);
  const describe = () => { const info = animationInfo(); description.textContent = `${info.views ? `${info.views} views · ${info.duration} seconds` : '360° rotation · 15 seconds'} · ${fps.value} fps`; };
  const open = (video: boolean) => {
    animation = video; abort = new AbortController();
    const current = video ? { width: 1920, height: 1080 } : currentSize();
    width.value = String(round(current.width)); height.value = String(round(current.height));
    for (const input of [width, height]) { input.min = video ? '2' : '1'; input.step = video ? '2' : '1'; }
    ratio = width.valueAsNumber / height.valueAsNumber;
    title.textContent = video ? 'Save animation' : 'Save image'; description.hidden = animationOptions.hidden = !video; progressPanel.hidden = true;
    white.closest('label')!.hidden = video; fps.value = '30'; quality.value = 'high';
    describe();
    progress.value = 0; progressText.textContent = ''; aspect.checked = !video;
    white.checked = screenWhiteBackground(); scale.value = '100'; width.setCustomValidity(''); dialog.showModal(); width.focus(); width.select();
  };
  button.addEventListener('click', () => open(false));
  animationButton?.addEventListener('click', () => open(true));
  width.addEventListener('input', () => {
    width.setCustomValidity('');
    if (aspect.checked) height.value = String(round(width.valueAsNumber / ratio));
  });
  height.addEventListener('input', () => {
    width.setCustomValidity('');
    if (aspect.checked) width.value = String(round(height.valueAsNumber * ratio));
  });
  fps.addEventListener('input', describe);
  aspect.addEventListener('change', () => { if (aspect.checked) ratio = width.valueAsNumber / height.valueAsNumber; });
  save.addEventListener('click', event => {
    const dimensions = size();
    const valid = validImageSize(dimensions, maxDimension) && (!animation || dimensions.width % 2 === 0 && dimensions.height % 2 === 0);
    width.setCustomValidity(valid ? '' : `Use ${animation ? 'even' : 'whole'}-pixel dimensions up to ${maxDimension} per side and 128 megapixels total.`);
    if (!form.reportValidity()) { event.stopImmediatePropagation(); return; }
    busy = true; save.textContent = 'Saving…'; cancel.disabled = !animation;
    width.disabled = height.disabled = aspect.disabled = scale.disabled = white.disabled = fps.disabled = quality.disabled = true;
    if (animation) { progressPanel.hidden = false; progressText.textContent = 'Preparing MP4 encoder…'; }
  });
  form.addEventListener('submit', event => { event.preventDefault(); if (!busy) save.click(); });
  const stop = () => {
    if (busy && animation) { abort.abort(); cancel.disabled = true; progressText.textContent = 'Cancelling…'; }
    else if (!busy) dialog.close();
  };
  cancel.addEventListener('click', stop);
  dialog.addEventListener('cancel', event => { if (busy) { event.preventDefault(); if (animation) stop(); } });
  return { dialog, save, size, animation: () => animation, signal: () => abort.signal,
    overlayScale: () => scale.valueAsNumber / 100, whiteBackground: () => animation ? screenWhiteBackground() : white.checked,
    animationSettings: (): AnimationSettings => ({ fps: fps.valueAsNumber, quality: quality.value as AnimationQuality }),
    progress(completed: number, total: number) {
      progress.max = total; progress.value = completed;
      progressText.textContent = completed === total ? 'Finalizing MP4…' : `Rendering frame ${completed} of ${total} (${Math.round(completed / total * 100)}%)`;
    }, finish() {
      busy = false; save.textContent = 'Save…'; cancel.disabled = false;
      width.disabled = height.disabled = aspect.disabled = scale.disabled = white.disabled = fps.disabled = quality.disabled = false; save.disabled = false; dialog.close();
    } };
}

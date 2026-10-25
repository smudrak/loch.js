export type ImageSize = { width: number; height: number };
export const MAX_IMAGE_PIXELS = 32 * 1024 * 1024;
export function validImageSize(size: ImageSize, maxDimension: number) {
  return Number.isInteger(size.width) && Number.isInteger(size.height) && size.width > 0 && size.height > 0
    && size.width <= maxDimension && size.height <= maxDimension && size.width * size.height <= MAX_IMAGE_PIXELS;
}
export function initializeImageSizeDialog(button: HTMLButtonElement, currentSize: () => ImageSize, maxDimension: number) {
  const dialog = document.querySelector<HTMLDialogElement>('#image-size-dialog')!;
  const form = dialog.querySelector('form')!;
  const width = document.querySelector<HTMLInputElement>('#image-width')!;
  const height = document.querySelector<HTMLInputElement>('#image-height')!;
  const aspect = document.querySelector<HTMLInputElement>('#image-aspect')!;
  const save = document.querySelector<HTMLButtonElement>('#image-save-confirm')!;
  const cancel = document.querySelector<HTMLButtonElement>('#image-save-cancel')!;
  let ratio = 1, busy = false;
  const size = () => ({ width: width.valueAsNumber, height: height.valueAsNumber });
  for (const input of [width, height]) input.max = String(maxDimension);
  button.addEventListener('click', () => {
    const current = currentSize(); ratio = current.width / current.height;
    width.value = String(current.width); height.value = String(current.height); aspect.checked = true;
    width.setCustomValidity(''); dialog.showModal(); width.focus(); width.select();
  });
  width.addEventListener('input', () => {
    width.setCustomValidity('');
    if (aspect.checked) height.value = String(Math.max(1, Math.round(width.valueAsNumber / ratio)));
  });
  height.addEventListener('input', () => {
    width.setCustomValidity('');
    if (aspect.checked) width.value = String(Math.max(1, Math.round(height.valueAsNumber * ratio)));
  });
  aspect.addEventListener('change', () => { if (aspect.checked) ratio = width.valueAsNumber / height.valueAsNumber; });
  save.addEventListener('click', event => {
    width.setCustomValidity(validImageSize(size(), maxDimension) ? '' : `Use whole-pixel dimensions up to ${maxDimension} per side and 32 megapixels total.`);
    if (!form.reportValidity()) { event.stopImmediatePropagation(); return; }
    busy = true; save.textContent = 'Saving…'; cancel.disabled = true; width.disabled = height.disabled = aspect.disabled = true;
  });
  form.addEventListener('submit', event => { event.preventDefault(); if (!busy) save.click(); });
  cancel.addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  return { dialog, save, size, finish() {
    busy = false; save.textContent = 'Save…'; cancel.disabled = false; width.disabled = height.disabled = aspect.disabled = false; save.disabled = false; dialog.close();
  } };
}

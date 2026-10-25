export function imageFilename(name: string) {
  const stem = name.replace(/\.(lox|3d|plt)$/i, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim().replace(/[. ]+$/, '');
  return `${stem || 'loch'}.png`;
}

/** Freeze computed styles so exported indicators match the current theme and viewport. */
function imageElement(element: Element): Element {
  const copy = element.cloneNode(false) as Element;
  const computed = getComputedStyle(element);
  copy.setAttribute('style', Array.from(computed, name => `${name}:${computed.getPropertyValue(name)};`).join(''));
  for (const child of Array.from(element.childNodes)) copy.append(child instanceof Element ? imageElement(child) : child.cloneNode(true));
  return copy;
}

function indicatorImage(overlays: HTMLElement[], width: number, height: number): Promise<HTMLImageElement> | undefined {
  const visible = overlays.filter(element => !element.hidden && getComputedStyle(element).display !== 'none');
  if (!visible.length) return;
  const root = document.createElement('div');
  root.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  root.style.cssText = `position:relative;width:${width}px;height:${height}px;`;
  for (const overlay of visible) root.append(imageElement(overlay));
  const html = new XMLSerializer().serializeToString(root);
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${html}</foreignObject></svg>`;
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not render image indicators'));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
  });
}

/** Call immediately after rendering: WebGL's default drawing buffer is transient. */
export async function captureImage(view: HTMLCanvasElement, labels: HTMLCanvasElement, overlays: HTMLElement[]): Promise<Blob> {
  const canvas = document.createElement('canvas'); canvas.width = view.width; canvas.height = view.height;
  try {
    if (!canvas.width || !canvas.height || !view.clientWidth || !view.clientHeight) throw new Error('The view is empty');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create image canvas');
    // Copy the scene and labels synchronously, before any async work or animation frame.
    context.drawImage(view, 0, 0);
    if (!labels.hidden && labels.width && labels.height) context.drawImage(labels, 0, 0, canvas.width, canvas.height);
    const indicators = indicatorImage(overlays, view.clientWidth, view.clientHeight);
    if (indicators) context.drawImage(await indicators, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not encode PNG image')), 'image/png'));
  } finally { canvas.width = 0; canvas.height = 0; }
}

type ImageFile = { createWritable(): Promise<{ write(blob: Blob): Promise<void>; close(): Promise<void>; abort(): Promise<void> }> };
type SaveWindow = Window & { showSaveFilePicker?: (options: {
  suggestedName: string; types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<ImageFile> };

function downloadImage(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename; link.hidden = true; document.body.append(link);
  try { link.click(); }
  finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 60_000); }
}

export function initializeSaveImage(button: HTMLButtonElement, capture: () => Promise<Blob>, name: () => string,
  onError: (error: unknown) => void) {
  let busy = false;
  button.addEventListener('click', () => {
    if (busy || button.disabled) return;
    busy = true; button.disabled = true;
    const filename = imageFilename(name());
    void (async () => {
      try {
        // Request the picker synchronously, while click activation is still valid.
        const destination = (window as SaveWindow).showSaveFilePicker?.({ suggestedName: filename,
          types: [{ description: 'PNG image', accept: { 'image/png': ['.png'] } }] });
        const [blob, file] = await Promise.all([Promise.resolve().then(capture), destination]);
        if (file) {
          const writable = await file.createWritable();
          try { await writable.write(blob); await writable.close(); }
          catch (error) { await writable.abort().catch(() => {}); throw error; }
        } else downloadImage(blob, filename);
      } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) onError(error); }
      finally { busy = false; }
    })();
  });
  return { get busy() { return busy; } };
}

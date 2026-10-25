import { Vector3 } from 'three';
import type { ViewCamera } from './camera';
import { AUTOROTATE_PERIOD_SECONDS } from './autorotate';
import { imageCamera } from './render-image';
import type { ImageSize } from './image-size';

export const ANIMATION_FPS = 30;
export const ANIMATION_FRAMES = AUTOROTATE_PERIOD_SECONDS * ANIMATION_FPS;

/** Sample a full Z-up orbit without repeating the first frame at the end. */
export function animationCamera(camera: ViewCamera, target: Vector3, size: ImageSize, frame: number, direction: 1 | -1) {
  const copy = imageCamera(camera, size);
  const offset = camera.position.clone().sub(target).applyAxisAngle(new Vector3(0, 0, 1), -direction * frame / ANIMATION_FRAMES * 2 * Math.PI);
  copy.position.copy(target).add(offset); copy.lookAt(target); copy.updateMatrixWorld(); return copy;
}

export async function encodeAnimation(size: ImageSize, render: (frame: number) => Promise<HTMLCanvasElement>,
  signal: AbortSignal, progress: (completed: number, total: number) => void): Promise<Blob> {
  signal.throwIfAborted();
  if (typeof VideoEncoder === 'undefined') throw new Error('MP4 encoding is unavailable in this browser. Open loch.js in a current Chrome or Edge browser.');
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, Quality, getFirstEncodableVideoCodec } = await import('mediabunny');
  const quality = new Quality({ bitrate: Math.min(20_000_000, Math.max(2_000_000, size.width * size.height * ANIMATION_FPS * .1)) });
  const codec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { ...size, quality, frameRate: ANIMATION_FPS });
  signal.throwIfAborted();
  if (!codec) throw new Error(`MP4 encoding at ${size.width} × ${size.height} is unavailable. Try a smaller resolution or a current Chrome/Edge browser.`);
  const canvas = document.createElement('canvas'); canvas.width = size.width; canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create animation canvas');
  const target = new BufferTarget(), output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
  const source = new CanvasSource(canvas, { codec, quality, keyFrameInterval: 2 });
  output.addVideoTrack(source, { frameRate: ANIMATION_FPS });
  try {
    await output.start();
    progress(0, ANIMATION_FRAMES);
    for (let frame = 0; frame < ANIMATION_FRAMES; frame++) {
      signal.throwIfAborted();
      const image = await render(frame);
      try {
        signal.throwIfAborted();
        context.drawImage(image, 0, 0);
        await source.add(frame / ANIMATION_FPS, 1 / ANIMATION_FPS);
      } finally { image.width = 0; image.height = 0; }
      progress(frame + 1, ANIMATION_FRAMES);
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    signal.throwIfAborted(); source.close(); await output.finalize(); signal.throwIfAborted();
    if (!target.buffer) throw new Error('MP4 encoding produced no data');
    return new Blob([target.buffer], { type: 'video/mp4' });
  } finally {
    if (output.state !== 'finalized' && output.state !== 'canceled') await output.cancel();
    canvas.width = 0; canvas.height = 0;
  }
}

import { MathUtils, Matrix4, OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import type { ViewCamera } from './camera';
import type { LxaCamera, LxaView } from './presentation';
export type PresentationPose = LxaCamera & { walker: boolean; sceneIndex: number };
type Segment = { start: number; duration: number; from: number; to: number; rotation: boolean };
const radians = MathUtils.degToRad;
const lerp = MathUtils.lerp;
const polar = (distance: number, bearing: number, tilt: number) => new Vector3(Math.sin(radians(bearing)) * Math.cos(radians(tilt)), Math.cos(radians(bearing)) * Math.cos(radians(tilt)), Math.sin(radians(tilt))).multiplyScalar(distance);
const position = (view: LxaCamera) => new Vector3(...view.center).add(polar(view.distance, view.facing + 180, view.tilt));
export function transitionProgress(t: number, from: boolean, to: boolean) {
  return (t ** 3 - 2 * t * t + t) * Number(from) + (-2 * t ** 3 + 3 * t * t) + (t ** 3 - t * t) * Number(to);
}
export class PresentationTimeline {
  readonly segments: Segment[] = [];
  readonly viewTimes: number[];
  readonly duration: number;
  constructor(readonly views: LxaView[], readonly loop: boolean, readonly sceneChanges = false) {
    this.viewTimes = views.map(() => 0); let time = 0;
    if (views.length === 1) this.segments.push({ start: 0, duration: 15, from: 0, to: 0, rotation: true });
    else for (let from = 0; from < (loop ? views.length : views.length - 1); from++) {
      const to = (from + 1) % views.length, view = views[from];
      this.viewTimes[from] = time;
      const rotation = Math.abs(view.rotations) * view.rotationDuration;
      if (rotation) { this.segments.push({ start: time, duration: rotation, from, to: from, rotation: true }); time += rotation; }
      this.segments.push({ start: time, duration: views[to].duration, from, to, rotation: false }); time += views[to].duration;
      if (to !== 0) this.viewTimes[to] = time;
    }
    this.duration = views.length === 1 ? 15 : time;
  }
  frames(fps: number) {
    if (!Number.isInteger(fps) || fps < 1 || fps > 120) throw new Error('Invalid animation FPS');
    if (this.views.length === 1) return { count: 15 * fps, time: (frame: number) => frame / fps };
    let count = 1;
    const parts = this.segments.map((segment, index) => {
      const steps = Math.max(segment.rotation ? 0 : 1, Math.round(segment.duration * fps));
      const length = steps - (this.loop && index === this.segments.length - 1 ? 1 : 0);
      const part = { first: count, length, steps, segment }; count += length; return part;
    });
    if (!Number.isSafeInteger(count) || count < 1) throw new Error('Invalid animation duration');
    return { count, time(frame: number) {
      if (frame === 0) return 0;
      const part = parts.find(item => frame >= item.first && frame < item.first + item.length)!;
      return part.segment.start + part.segment.duration * (frame - part.first + 1) / part.steps;
    } };
  }
  sample(seconds: number): PresentationPose {
    if (!this.views.length) throw new Error('Animation has no views');
    if (!this.loop && seconds >= this.duration) {
      const last = this.views.length - 1;
      return { ...this.views[last], center: [...this.views[last].center], walker: this.views[last].walker, sceneIndex: last };
    }
    const time = this.loop ? ((seconds % this.duration) + this.duration) % this.duration : Math.max(0, seconds);
    const segment = this.segments.find(part => time < part.start + part.duration) ?? this.segments[this.segments.length - 1];
    const from = this.views[segment.from], to = this.views[segment.to];
    let t = Math.max(0, Math.min(1, (time - segment.start) / segment.duration));
    if (segment.rotation) {
      const angle = this.views.length === 1 ? t * 360 : transitionProgress(t, false, false) * 360 * from.rotations;
      return { ...from, center: [...from.center], facing: from.facing + angle, walker: from.walker, sceneIndex: segment.from };
    }
    t = transitionProgress(t, from.transition, to.transition);
    let delta = to.facing - from.facing;
    delta = ((delta + 180) % 360 + 360) % 360 - 180;
    if (delta === -180 && to.facing - from.facing > 0) delta = 180;
    const pose: PresentationPose = { facing: from.facing + delta * t, tilt: lerp(from.tilt, to.tilt, t),
      center: from.center.map((value, axis) => lerp(value, to.center[axis], t)) as [number, number, number],
      distance: lerp(from.distance, to.distance, t), focus: lerp(from.focus, to.focus, t), perspective: t <= .5 ? from.perspective : to.perspective,
      walker: to.walker, sceneIndex: segment.from };
    if (to.walker) pose.center = position(from).lerp(position(to), t).sub(polar(pose.distance, pose.facing + 180, pose.tilt)).toArray();
    return pose;
  }
}
export function presentationCamera(view: LxaCamera, origin: Vector3, aspect: number, clip: ViewCamera): ViewCamera {
  const focus = Math.max(20, Math.min(2000, view.focus)), halfHeight = view.distance * 12 / focus;
  const near = Math.min(clip.near, .1, view.distance * .01);
  const camera = view.perspective ? new PerspectiveCamera(2 * MathUtils.radToDeg(Math.atan(12 / focus)), aspect, near, clip.far)
    : new OrthographicCamera(-halfHeight * aspect, halfHeight * aspect, halfHeight, -halfHeight, near, clip.far);
  camera.up.set(0, 0, 1); camera.position.copy(position(view)).sub(origin);
  const bearing = radians(view.facing), tilt = radians(view.tilt);
  const right = new Vector3(Math.cos(bearing), -Math.sin(bearing), 0);
  const up = new Vector3(Math.sin(tilt) * Math.sin(bearing), Math.sin(tilt) * Math.cos(bearing), Math.cos(tilt));
  const backward = new Vector3(-Math.cos(tilt) * Math.sin(bearing), -Math.cos(tilt) * Math.cos(bearing), Math.sin(tilt));
  camera.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(right, up, backward)); camera.updateMatrixWorld(); return camera;
}
export function capturePresentationCamera(camera: ViewCamera, target: Vector3, origin: Vector3): LxaCamera {
  camera.updateMatrixWorld();
  const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0), direction = camera.getWorldDirection(new Vector3());
  const distance = Math.max(.0001, camera.position.distanceTo(target));
  const focus = camera instanceof PerspectiveCamera ? 12 / Math.tan(radians(camera.getEffectiveFOV()) / 2) : 12 * distance / ((camera.top - camera.bottom) / (2 * camera.zoom));
  return { facing: (MathUtils.radToDeg(Math.atan2(-right.y, right.x)) + 360) % 360, tilt: -MathUtils.radToDeg(Math.asin(MathUtils.clamp(direction.z, -1, 1))),
    center: target.clone().add(origin).toArray(), distance, focus: Math.max(20, Math.min(2000, focus)), perspective: camera instanceof PerspectiveCamera };
}

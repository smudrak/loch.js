import { describe, expect, it } from 'vitest';
import { BufferGeometry, Color, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, Points, PointsMaterial, Scene } from 'three';
import { applyImagePrintTheme } from '../src/image-print-theme';

describe('white-background export colours', () => {
  it.each([false, true])('keeps cave colours, darkens print annotations and restores shared materials (default centreline %s)', defaultCentreline => {
    const scene = new Scene(), background = new Color('#09131c'); scene.background = background;
    const centreline = new Group(), points = new PointsMaterial({ color: 0xffffff });
    const lines = new LineBasicMaterial({ color: 0xffffff, vertexColors: true });
    const walls = new MeshBasicMaterial({ color: 0x44aabb });
    scene.add(centreline, new Mesh(new BufferGeometry(), walls));
    centreline.add(new Points(new BufferGeometry(), points), new LineSegments(new BufferGeometry(), lines), new LineSegments(new BufferGeometry(), lines));
    const restore = applyImagePrintTheme(scene, centreline, defaultCentreline);
    expect((scene.background as Color).getHex()).toBe(0xffffff);
    expect(points.color.getHex()).toBe(0x162531); expect(lines.color.getHex()).toBe(defaultCentreline ? 0x162531 : 0xffffff);
    expect(walls.color.getHex()).toBe(0x44aabb); expect(lines.vertexColors).toBe(true);
    restore();
    expect(scene.background).toBe(background); expect(points.color.getHex()).toBe(0xffffff); expect(lines.color.getHex()).toBe(0xffffff);
    expect(walls.color.getHex()).toBe(0x44aabb);
  });
});

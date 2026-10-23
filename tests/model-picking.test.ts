import { describe, expect, it } from 'vitest';
import { DoubleSide, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, OrthographicCamera,
  PerspectiveCamera, PlaneGeometry, BufferGeometry, Vector2, Vector3 } from 'three';
import { pickModelPoint, pickingLineThreshold } from '../src/model-picking';

function fixture(orthographic = false) {
  const camera = orthographic ? new OrthographicCamera(-5, 5, 5, -5, .1, 100) : new PerspectiveCamera(60, 1, .1, 100);
  camera.position.z = 10; camera.updateMatrixWorld();
  const scene = { walls: new Group(), centreline: new Group(), surface: new Group() };
  return { camera, scene };
}
function plane(z: number, transparent = false) {
  const mesh = new Mesh(new PlaneGeometry(6, 6), new MeshBasicMaterial({ side: DoubleSide, transparent, opacity: transparent ? .5 : 1 }));
  mesh.position.z = z;
  return mesh;
}
function line(surface: boolean) {
  const mesh = new LineSegments(new BufferGeometry().setFromPoints([new Vector3(-2, 0, 0), new Vector3(2, 0, 0)]), new LineBasicMaterial());
  mesh.userData.surface = surface;
  return mesh;
}

describe('model focus picking', () => {
  it.each([false, true])('picks cave walls through transparent and opaque terrain (orthographic %s)', orthographic => {
    const { camera, scene } = fixture(orthographic);
    scene.walls.add(plane(0)); const surface = plane(5, true); scene.surface.add(surface);
    expect(pickModelPoint(camera, new Vector2(), scene, .1)?.z).toBeCloseTo(0);
    surface.material.opacity = 1; surface.material.transparent = false;
    expect(pickModelPoint(camera, new Vector2(), scene, .1)?.z).toBeCloseTo(0);
    scene.walls.visible = false;
    expect(pickModelPoint(camera, new Vector2(), scene, .1)?.z).toBeCloseTo(5);
    scene.surface.visible = false;
    expect(pickModelPoint(camera, new Vector2(), scene, .1)).toBeUndefined();
  });

  it('returns the closest cave triangle and ignores hidden meshes and helper objects', () => {
    const { camera, scene } = fixture();
    const hidden = plane(7); hidden.visible = false;
    scene.walls.add(plane(0), plane(2), hidden);
    expect(pickModelPoint(camera, new Vector2(), scene, .1)?.z).toBeCloseTo(2);
    expect(pickModelPoint(camera, new Vector2(1, 1), scene, .1)).toBeUndefined();
  });

  it('picks full wall triangles hidden by Automatic detail without changing mesh visibility', () => {
    const { camera, scene } = fixture();
    const mesh = plane(0); mesh.visible = false; scene.walls.add(mesh); scene.surface.add(plane(5));
    expect(pickModelPoint(camera, new Vector2(), { ...scene, fullDetailWalls: [mesh] }, .1)?.z).toBeCloseTo(0);
    expect(mesh.visible).toBe(false);
    scene.walls.visible = false;
    expect(pickModelPoint(camera, new Vector2(), { ...scene, fullDetailWalls: [mesh] }, .1)?.z).toBeCloseTo(5);
  });

  it('allows centreline-only caves to be picked through terrain, respecting hidden line groups', () => {
    const { camera, scene } = fixture();
    const cave = line(false); scene.centreline.add(cave); scene.surface.add(plane(5, true));
    expect(pickModelPoint(camera, new Vector2(), scene, .1)?.z).toBeCloseTo(0);
    cave.visible = false;
    expect(pickModelPoint(camera, new Vector2(), scene, .1)?.z).toBeCloseTo(5);
    cave.visible = true; cave.userData.surface = true;
    expect(pickModelPoint(camera, new Vector2(), scene, .1)?.z).toBeCloseTo(5);
    scene.surface.visible = false;
    expect(pickModelPoint(camera, new Vector2(), scene, .1)?.z).toBeCloseTo(0);
  });

  it.each([false, true])('uses a five-pixel centreline tolerance independent of zoom (orthographic %s)', orthographic => {
    const { camera, scene } = fixture(orthographic);
    scene.centreline.add(line(false));
    for (const zoom of [1, 4]) {
      camera.zoom = zoom; camera.updateProjectionMatrix();
      const threshold = pickingLineThreshold(camera, new Vector3(), 600);
      expect(pickModelPoint(camera, new Vector2(0, 8 / 600), scene, threshold)).toBeDefined();
      expect(pickModelPoint(camera, new Vector2(0, 12 / 600), scene, threshold)).toBeUndefined();
    }
  });
});

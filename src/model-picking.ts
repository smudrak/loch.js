import { LineSegments, Mesh, OrthographicCamera, Raycaster, Vector2, Vector3, type Camera, type Intersection, type Object3D } from 'three';

export type PickScene = { walls: Object3D; centreline: Object3D; surface: Object3D; fullDetailWalls?: Mesh[] };

/** Cave geometry takes priority over terrain, regardless of terrain transparency. */
export function pickModelPoint(camera: Camera, pointer: Vector2, scene: PickScene, lineThreshold: number): Vector3 | undefined {
  camera.updateMatrixWorld();
  const ray = new Raycaster(); ray.setFromCamera(pointer, camera);
  ray.params.Line.threshold = lineThreshold;
  const result: { nearest?: Intersection } = {};
  const pickedPoint = () => result.nearest?.point.clone();
  const hits: Intersection[] = [];
  const intersect = (object: Mesh | LineSegments) => {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (!materials.some(material => material.visible && material.opacity > 0)) return;
    object.updateWorldMatrix(true, false);
    hits.length = 0;
    object.raycast(ray, hits);
    for (const hit of hits) if (!result.nearest || hit.distance < result.nearest.distance) { result.nearest = hit; ray.far = hit.distance; }
  };
  const visit = (object: Object3D, accept: (object: Object3D) => boolean) => {
    if (!object.visible) return;
    if ((object instanceof Mesh || object instanceof LineSegments) && accept(object)) intersect(object);
    for (const child of object.children) visit(child, accept);
  };
  if (scene.walls.visible) {
    if (scene.fullDetailWalls) {
      // Automatic detail hides the source meshes while displaying sampled points.
      for (const mesh of scene.fullDetailWalls) intersect(mesh);
    } else visit(scene.walls, object => object instanceof Mesh);
  }
  if (!result.nearest) visit(scene.centreline, object => object instanceof LineSegments && !object.userData.surface);
  if (result.nearest) return result.nearest.point.clone();
  visit(scene.surface, object => object instanceof Mesh);
  if (!result.nearest) visit(scene.centreline, object => object instanceof LineSegments && object.userData.surface);
  return pickedPoint();
}

/** Convert a small screen tolerance to model units for centreline-only models. */
export function pickingLineThreshold(camera: Camera, target: Vector3, height: number) {
  if (camera instanceof OrthographicCamera) return (camera.top - camera.bottom) / camera.zoom * 5 / height;
  const point = target.clone().project(camera);
  const a = new Vector3(0, 0, point.z).unproject(camera), b = new Vector3(0, 10 / height, point.z).unproject(camera);
  return a.distanceTo(b);
}

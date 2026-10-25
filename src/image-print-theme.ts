import { Color, LineBasicMaterial, PointsMaterial, type Group, type Material, type Object3D, type Scene } from 'three';

/** Change only export colours; restore shared live-scene materials afterwards. */
export function applyImagePrintTheme(scene: Scene, centreline: Group, defaultCentreline: boolean) {
  const background = scene.background;
  const colors = new Map<LineBasicMaterial | PointsMaterial, Color>();
  scene.background = new Color(0xffffff);
  centreline.traverse((object: Object3D & { material?: Material | Material[] }) => {
    for (const material of object.material ? Array.isArray(object.material) ? object.material : [object.material] : []) {
      if ((material instanceof PointsMaterial || defaultCentreline && material instanceof LineBasicMaterial) && !colors.has(material)) {
        colors.set(material, material.color.clone()); material.color.setHex(0x162531);
      }
    }
  });
  return () => {
    scene.background = background;
    for (const [material, color] of colors) material.color.copy(color);
  };
}

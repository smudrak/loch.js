/** Only existing loch.js controls are interpreted; other XML attributes stay untouched. */
const checks: Record<string, string> = {
  'scene-vis-centerline': 'lines', 'scene-vis-walls': 'walls', 'scene-vis-surface': 'surface', 'scene-vis-bbox': 'bounding-box', 'scene-vis-indicators': 'indicators',
  'scene-vis-centerline-cave': 'centreline-underground', 'scene-vis-centerline-surface': 'centreline-surface', 'scene-vis-centerline-splay': 'centreline-splay',
  'scene-vis-centerline-duplicate': 'centreline-duplicate', 'scene-vis-centerline-station': 'station-all', 'scene-vis-centerline-entrance': 'station-entrance',
  'scene-vis-centerline-fix': 'station-fixed', 'scene-surface-transparency': 'surface-transparency', 'scene-surface-texture': 'surface-image-overlay',
};
export const presentationControlIds = [...Object.values(checks), 'surface-opacity', 'station-label', 'centreline-color'];
const truth = (value: string) => value === 'true' || value === '1';
export function captureSceneSettings(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, id] of Object.entries(checks)) result[key] = String(document.querySelector<HTMLInputElement>(`#${id}`)!.checked);
  result['scene-surface-opacity'] = String(Number(document.querySelector<HTMLInputElement>('#surface-opacity')!.value) / 100);
  const label = document.querySelector<HTMLSelectElement>('#station-label')!.value;
  result['scene-vis-labels'] = String(label !== 'none');
  result['scene-label-comment'] = String(label === 'comments'); result['scene-label-altitude'] = String(label === 'altitude');
  result['scene-label-name'] = String(['number', 'short', 'full'].includes(label)); result['scene-label-survey'] = String(['short', 'full'].includes(label));
  result['scene-color-mode'] = '1';
  result['scene-color-apply-centerline'] = String(document.querySelector<HTMLSelectElement>('#centreline-color')!.value === 'altitude');
  return result;
}
function setControl(id: string, value: string | boolean) {
  const element = document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
  const changed = typeof value === 'boolean' ? (element as HTMLInputElement).checked !== value : element.value !== value;
  if (!changed) return;
  if (typeof value === 'boolean') (element as HTMLInputElement).checked = value; else element.value = value;
  element.dispatchEvent(new Event(id === 'surface-opacity' ? 'input' : 'change', { bubbles: true }));
}
export function applySceneSettings(settings: Record<string, string>) {
  for (const [key, id] of Object.entries(checks)) if (settings[key] !== undefined) setControl(id, truth(settings[key]));
  const opacity = Number(settings['scene-surface-opacity']);
  if (settings['scene-surface-opacity'] !== undefined && Number.isFinite(opacity)) setControl('surface-opacity', String(Math.max(0, Math.min(1, opacity)) * 100));
  if (settings['scene-color-apply-centerline'] !== undefined || settings['scene-color-mode'] !== undefined) {
    const mode = settings['scene-color-mode'];
    if (mode === undefined || mode === '0' || mode === '1') setControl('centreline-color', settings['scene-color-apply-centerline'] !== undefined && !truth(settings['scene-color-apply-centerline']) || mode === '0' ? 'default' : 'altitude');
  }
  const modes = ['comment', 'name', 'altitude'].filter(mode => truth(settings[`scene-label-${mode}`] ?? 'false'));
  if (settings['scene-vis-labels'] !== undefined && !truth(settings['scene-vis-labels'])) setControl('station-label', 'none');
  else if (modes.length === 1 && (!truth(settings['scene-label-survey'] ?? '') || modes[0] === 'name')) {
    const label = modes[0] === 'comment' ? 'comments' : modes[0] === 'altitude' ? 'altitude' : truth(settings['scene-label-survey'] ?? '') ? 'full' : 'number';
    setControl('station-label', label);
  } else if (modes.length === 0 && settings['scene-label-name'] !== undefined && !truth(settings['scene-label-survey'] ?? '')) setControl('station-label', 'none');
}
export function snapshotPresentationControls() {
  const values = presentationControlIds.map(id => {
    const element = document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
    return [id, element instanceof HTMLInputElement && element.type === 'checkbox' ? element.checked : element.value] as const;
  });
  return () => { for (const [id, value] of values) setControl(id, value); };
}

// @ts-nocheck
/**
 * Render layers.
 *
 * WORLD       — opaque environment + character.
 * VFX         — every transparent ability mesh and particle system.
 * DISTORTION  — UV-offset proxies, kept off the main camera.
 * CONTACT     — character-only contact shadow flag.
 */
export const LAYER = Object.freeze({
  WORLD: 0,
  VFX: 1,
  DISTORTION: 2,
  CONTACT: 3,
});

export function setLayerRecursive(object, layer) {
  object.traverse((node) => node.layers.set(layer));
  return object;
}

export function enableMainCameraLayers(camera) {
  if (!camera?.layers) return camera;
  camera.layers.enable(LAYER.WORLD);
  camera.layers.enable(LAYER.VFX);
  camera.layers.enable(LAYER.CONTACT);
  return camera;
}

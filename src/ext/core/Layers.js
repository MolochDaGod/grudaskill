// @ts-nocheck
/**
 * Render layers.
 *
 * WORLD       — opaque environment + character. Written to the depth prepass,
 *               receives shadows, is what soft particles fade against.
 * VFX         — every transparent ability mesh and particle system.
 * DISTORTION  — invisible-to-the-main-pass proxies that write screen-space UV
 *               offsets for heat shimmer / water refraction.
 * CONTACT     — additional layer flag on the character only, so the contact
 *               shadow pass captures it without also capturing grass or VFX.
 *
 * Camera default sees only WORLD (0). The lab camera must also enable VFX (1)
 * or every original GitHub ability, ground decal and buff is spawned and then
 * silently never drawn.
 */
export const LAYER = Object.freeze({
  WORLD: 0,
  VFX: 1,
  DISTORTION: 2,
  CONTACT: 3
});

/** Put an object and all of its descendants on a single layer. */
export function setLayerRecursive(object, layer) {
  object.traverse((node) => node.layers.set(layer));
  return object;
}

/**
 * Enable WORLD + VFX on a camera. Distortion stays off the main pass — those
 * meshes are UV-offset proxies and look like garbage if they composite.
 */
export function enableMainCameraLayers(camera) {
  if (!camera?.layers) return camera;
  camera.layers.enable(LAYER.WORLD);
  camera.layers.enable(LAYER.VFX);
  camera.layers.enable(LAYER.CONTACT);
  return camera;
}

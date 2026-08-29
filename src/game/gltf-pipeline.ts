/**
 * Runtime loader only. Convert offline:
 *   node scripts/gltf-convert.mjs fbx2gltf in.fbx out.glb
 *   node scripts/gltf-convert.mjs glb2glb  in.glb out.glb
 *   node scripts/gltf-convert.mjs glb2gltf in.glb out.gltf
 * Never FBXLoader in the game. Draco/meshopt decode files already compressed.
 */
import { LoadingManager, Cache } from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

export const DRACO_DECODER_PATH = "/draco/";

let manager: LoadingManager | null = null;
let draco: DRACOLoader | null = null;
let gltf: GLTFLoader | null = null;

export function getGltfManager(): LoadingManager {
  if (!manager) manager = new LoadingManager();
  return manager;
}

export function getSharedDracoLoader(): DRACOLoader {
  if (!draco) {
    Cache.enabled = true;
    draco = new DRACOLoader(getGltfManager());
    const path =
      typeof document !== "undefined" ? new URL("/draco/", document.baseURI).href : "/draco/";
    draco.setDecoderPath(path);
    draco.setWorkerLimit(1);
  }
  return draco;
}

export function makeGltfLoader(): GLTFLoader {
  if (!gltf) {
    gltf = new GLTFLoader(getGltfManager());
    gltf.setDRACOLoader(getSharedDracoLoader());
    gltf.setMeshoptDecoder(MeshoptDecoder);
  }
  return gltf;
}

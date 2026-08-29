import * as THREE from "three";
import { clone as cloneRigged } from "three/addons/utils/SkeletonUtils.js";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";

export const TRAINING_DUMMY_URL = "/models/dummies/training-dummy.glb";
export const FROG_PET_URL = "/models/dummies/frog-pet.glb";

export type DummyRig = {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  small: THREE.AnimationAction | null;
  big: THREE.AnimationAction | null;
};

const TARGET_H = 1.85;

function fit(root: THREE.Object3D, h: number) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const sy = Math.max(size.y, 0.001);
  root.scale.multiplyScalar(h / sy);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y -= box2.min.y;
}

function hardenMats(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    const mats = (Array.isArray(m.material) ? m.material : [m.material]) as THREE.Material[];
    for (const mat of mats) {
      mat.side = THREE.FrontSide;
      const std = mat as THREE.MeshStandardMaterial;
      if (std.map) std.map.colorSpace = THREE.SRGBColorSpace;
      if ("specularMap" in std && !std.map) {
        const old = mat as THREE.MeshPhongMaterial;
        m.material = new THREE.MeshStandardMaterial({
          map: old.map ?? null,
          color: old.color ?? 0xc4b49a,
          roughness: 0.72,
          metalness: 0.08,
        });
      }
    }
  });
}

export function parseDummyGltf(gltf: GLTF): { proto: THREE.Object3D; clips: THREE.AnimationClip[] } {
  hardenMats(gltf.scene);
  return { proto: gltf.scene, clips: gltf.animations };
}

export function makeDummyRig(proto: THREE.Object3D, clips: THREE.AnimationClip[]): DummyRig {
  const root = cloneRigged(proto);
  fit(root, TARGET_H);
  const mixer = new THREE.AnimationMixer(root);
  const smallSrc = clips.find((c) => /small/i.test(c.name)) ?? clips[1] ?? clips[0];
  const bigSrc = clips.find((c) => /big/i.test(c.name)) ?? clips[0];
  const arm = (clip: THREE.AnimationClip | undefined) => {
    if (!clip) return null;
    const a = mixer.clipAction(clip);
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.enabled = true;
    a.setEffectiveWeight(0);
    return a;
  };
  const small = arm(smallSrc);
  const big = arm(bigSrc);
  mixer.addEventListener("finished", (e) => {
    const act = e.action as THREE.AnimationAction | undefined;
    act?.fadeOut(0.25);
  });
  return { root, mixer, small, big };
}

export function playDummyHit(rig: DummyRig, heavy: boolean) {
  const a = heavy ? rig.big ?? rig.small : rig.small ?? rig.big;
  if (!a) return;
  a.reset();
  a.setEffectiveWeight(1);
  a.paused = false;
  a.fadeIn(0.04);
  a.play();
}

export function tickDummyRig(rig: DummyRig, dt: number) {
  rig.mixer.update(dt);
}

export function makeFrogPet(proto: THREE.Object3D): THREE.Object3D {
  const root = cloneRigged(proto);
  fit(root, 0.55);
  hardenMats(root);
  return root;
}

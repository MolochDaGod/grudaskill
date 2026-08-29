import * as THREE from "three";
import type { School } from "./skills";
import { viaR2 } from "./cdn";
import type { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { parseCachedGlb } from "./grudge6";

/** D1 / R2 ids GRDG-3DFX-PROD-MAGICROCK1..5 → play-kit keys. */
export const MAGIC_ROCK_IDS = [
  "GRDG-3DFX-PROD-MAGICROCK1",
  "GRDG-3DFX-PROD-MAGICROCK2",
  "GRDG-3DFX-PROD-MAGICROCK3",
  "GRDG-3DFX-PROD-MAGICROCK4",
  "GRDG-3DFX-PROD-MAGICROCK5",
] as const;

export const MAGIC_ROCK_URLS = [1, 2, 3, 4, 5].map((n) => viaR2(`models/vfx/rocks/magic-rock-${n}.glb`));

type RockLook = {
  school: School;
  color: string;
  emissive: string;
  glow: number;
  metal: number;
  rough: number;
};

/** 1 fire · 2 frost · 3 nature · 4 lightning · 5 shadow */
export const ROCK_LOOK: RockLook[] = [
  { school: "fire", color: "#c45a28", emissive: "#ff6a2a", glow: 1.15, metal: 0.18, rough: 0.42 },
  { school: "frost", color: "#7aa8c4", emissive: "#7ee8ff", glow: 0.95, metal: 0.45, rough: 0.18 },
  { school: "nature", color: "#4f7a38", emissive: "#86efac", glow: 0.7, metal: 0.08, rough: 0.62 },
  { school: "lightning", color: "#c9b86a", emissive: "#f5e27a", glow: 1.35, metal: 0.55, rough: 0.22 },
  { school: "shadow", color: "#3a2a55", emissive: "#a78bfa", glow: 0.9, metal: 0.28, rough: 0.38 },
];

export function rockIndexForSchool(school: School): number {
  const i = ROCK_LOOK.findIndex((r) => r.school === school);
  if (i >= 0) return i;
  if (school === "holy" || school === "arcane") return 4;
  if (school === "physical") return 2;
  return 0;
}

function tipAlongZ(src: THREE.Object3D, length: number): THREE.Group {
  const inner = new THREE.Group();
  inner.add(src);
  src.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(src);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  src.position.sub(center);
  // Bind pose is Y-up, tip toward -Y (pointing down). Map -Y → +Z (flight).
  inner.rotation.x = -Math.PI / 2;
  inner.rotation.z = Math.PI;
  const wrap = new THREE.Group();
  wrap.add(inner);
  inner.updateMatrixWorld(true);
  const z = Math.max(new THREE.Box3().setFromObject(wrap).getSize(size).z, 0.001);
  wrap.scale.setScalar(length / z);
  wrap.userData.forward = true;
  wrap.userData.rock = true;
  return wrap;
}

function tintRock(root: THREE.Object3D, look: RockLook) {
  const color = new THREE.Color(look.color);
  const emit = new THREE.Color(look.emissive);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const list = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.Material[];
    mesh.material = list.map((mat) => {
      const next = mat.clone();
      if ("color" in next && next.color instanceof THREE.Color) next.color.lerp(color, 0.55);
      if ("emissive" in next && next.emissive instanceof THREE.Color) {
        next.emissive.copy(emit);
        (next as THREE.MeshStandardMaterial).emissiveIntensity = look.glow;
      }
      if ("metalness" in next) (next as THREE.MeshStandardMaterial).metalness = look.metal;
      if ("roughness" in next) (next as THREE.MeshStandardMaterial).roughness = look.rough;
      next.toneMapped = true;
      return next;
    });
  });
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.42, 1),
    new THREE.MeshBasicMaterial({
      color: emit,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  shell.scale.setScalar(1.15);
  shell.userData.glow = true;
  root.add(shell);
}

export async function loadMagicRocks(loader: GLTFLoader): Promise<THREE.Group[]> {
  const out: THREE.Group[] = [];
  for (let i = 0; i < MAGIC_ROCK_URLS.length; i++) {
    try {
      const gltf = await parseCachedGlb(loader, MAGIC_ROCK_URLS[i]!);
      const wrap = tipAlongZ(gltf.scene.clone(true), 0.95);
      tintRock(wrap, ROCK_LOOK[i]!);
      wrap.name = MAGIC_ROCK_IDS[i]!;
      out[i] = wrap;
    } catch {
      const look = ROCK_LOOK[i]!;
      const stub = new THREE.Group();
      stub.add(
        new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.28, 0),
          new THREE.MeshStandardMaterial({
            color: look.color,
            emissive: look.emissive,
            emissiveIntensity: look.glow,
            roughness: look.rough,
            metalness: look.metal,
          }),
        ),
      );
      stub.userData.forward = true;
      stub.userData.rock = true;
      out[i] = stub;
    }
  }
  return out;
}

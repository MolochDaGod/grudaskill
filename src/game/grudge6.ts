import * as THREE from "three";
import type { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { ProjectileAsset } from "./skills";
import { ASSETS_URL, viaR2 } from "./cdn";
import { enqueueShot, makeAnimQueue, releaseShot, takeShot, type AnimQueue } from "./anim-queue";

export const GRUDGE6_RACES = [
  { id: "human", name: "Human", prefix: "WK_" },
  { id: "elf", name: "Elf", prefix: "ELF_" },
  { id: "orc", name: "Orc", prefix: "ORC_" },
  { id: "undead", name: "Undead", prefix: "UD_" },
  { id: "barbarian", name: "Barbarian", prefix: "BRB_" },
  { id: "dwarf", name: "Dwarf", prefix: "DWF_" },
] as const;

export type Grudge6Id = (typeof GRUDGE6_RACES)[number]["id"];

export function raceGlbUrl(id: string): string {
  return `${ASSETS_URL}/asset-packs/toon-rts-characters/glb/characters/${id}.glb`;
}

const ANIM_BASE = `${ASSETS_URL}/models/grudge6/anims`;
export const BIP001_LOCO = ["idle", "idle2", "idle_look", "walk", "run"] as const;
export const BIP001_SHOTS = ["attack", "cast", "slash", "shoot", "bow", "staff", "spear", "gun", "fire", "magic"] as const;

function prefixFor(raceId?: string): string {
  return GRUDGE6_RACES.find((r) => r.id === raceId)?.prefix ?? "WK_";
}

function strip(name: string): string {
  return name.replace(/^(WK_|BRB_|ORC_|ELF_|UD_|DWF_)/i, "");
}

const ARMOR: { re: RegExp }[] = [
  { re: /^(?:Units_)?Body_([A-Z])$/i },
  { re: /^(?:Units_)?Arms_([A-Z])$/i },
  { re: /^(?:Units_)?Legs_([A-Z])$/i },
  { re: /^(?:Units_)?(?:Head|Haed)_([A-Z])$/i },
  { re: /^(?:Units_)?Shoulderpads_([A-Z])$/i },
];

function weaponRe(asset: ProjectileAsset): RegExp {
  if (asset === "arrow") return /^(?:Units_|weapon_|Weapon_)?[Bb]ow/i;
  if (asset === "spear") return /^(?:Units_|weapon_|Weapon_)?[Ss]pear/i;
  if (asset === "bullet") return /(?:pistol|gun|flint|rifle)/i;
  if (asset === "fire" || asset === "ice" || asset === "bolt") {
    return /^(?:Units_|weapon_|Weapon_)?[Ss]taff_A$/i;
  }
  return /^(?:Units_|weapon_|Weapon_)?[Ss]word(?:_A)?$/i;
}

export function dressToon(
  root: THREE.Object3D,
  asset: ProjectileAsset,
  _raceId?: string,
  armor = "A",
) {
  void prefixFor(_raceId);
  const letter = (armor || "A").toUpperCase();
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.visible = false;
      meshes.push(m);
    }
  });
  const show = (re: RegExp, want: string) => {
    for (const m of meshes) {
      const s = strip(m.name);
      const mt = s.match(re);
      if (!mt) continue;
      const got = (mt[1] || "A").toUpperCase();
      if (got === want || !mt[1]) m.visible = true;
    }
  };
  for (const a of ARMOR) show(a.re, letter);
  const w = weaponRe(asset);
  let armed = false;
  for (const m of meshes) {
    if (w.test(strip(m.name))) {
      m.visible = true;
      armed = true;
    }
  }
  if (!armed) {
    const fallback = /^(?:Units_|weapon_|Weapon_)?[Ss]word/i;
    for (const m of meshes) {
      if (fallback.test(strip(m.name))) m.visible = true;
    }
  }
  if (asset === "arrow") {
    for (const m of meshes) {
      if (/quiver/i.test(strip(m.name))) m.visible = true;
    }
  }
}

/** Visible equipped weapon mesh (uuid-stable until the next dress). */
export function findEquippedWeapon(root: THREE.Object3D, asset: ProjectileAsset): THREE.Mesh | null {
  const w = weaponRe(asset);
  let found: THREE.Mesh | null = null;
  let fallback: THREE.Mesh | null = null;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible) return;
    const s = strip(m.name);
    if (w.test(s)) found = m;
    else if (/weapon_|_weapon_|sword|spear|bow|staff|pistol|gun|flint/i.test(s) && !/quiver|shield/i.test(s)) {
      fallback = m;
    }
  });
  return found ?? fallback;
}

const _wbox = new THREE.Box3();
const _wcenter = new THREE.Vector3();
const _wfwd = new THREE.Vector3();

/** Barrel / blade tip of an equipped mesh, in world space, along `forward`. */
export function weaponMuzzleWorld(
  mesh: THREE.Object3D | null | undefined,
  forward: THREE.Vector3,
  out: THREE.Vector3,
): THREE.Vector3 | null {
  if (!mesh || !mesh.visible) return null;
  mesh.updateWorldMatrix(true, false);
  _wbox.setFromObject(mesh);
  if (_wbox.isEmpty()) return null;
  _wbox.getCenter(_wcenter);
  const tag = `${mesh.name} ${mesh.parent?.name ?? ""}`.toLowerCase();
  const bow = /bow|crossbow/.test(tag);
  if (bow) {
    out.copy(_wcenter);
    if (out.y < 0.4) out.y = Math.max(0.95, _wcenter.y);
    return out;
  }
  _wfwd.copy(forward);
  if (_wfwd.lengthSq() < 1e-8) _wfwd.set(0, 0, 1);
  else _wfwd.normalize();
  const hx = (_wbox.max.x - _wbox.min.x) * 0.5;
  const hy = (_wbox.max.y - _wbox.min.y) * 0.5;
  const hz = (_wbox.max.z - _wbox.min.z) * 0.5;
  const ext = Math.abs(_wfwd.x) * hx + Math.abs(_wfwd.y) * hy + Math.abs(_wfwd.z) * hz;
  out.copy(_wcenter).addScaledVector(_wfwd, Math.max(0.08, ext));
  if (out.y < 0.35) out.y = Math.max(0.9, _wcenter.y);
  return out;
}

export function findNamed(root: THREE.Object3D, names: string | string[]): THREE.Object3D | null {
  const list = Array.isArray(names) ? names : [names];
  for (const n of list) {
    const o = root.getObjectByName(n);
    if (o) return o;
  }
  return null;
}

function isStubMap(map: THREE.Texture | null | undefined): boolean {
  if (!map) return true;
  const img = (map.image || (map.source as { data?: unknown } | undefined)?.data) as {
    naturalWidth?: number;
    width?: number;
    height?: number;
    data?: { length: number };
  } | null;
  if (!img) return false;
  const w = img.naturalWidth || img.width || 0;
  const h = img.height || 0;
  if (w > 0 && h > 0) return w <= 2 || h <= 2;
  if (img.data && typeof img.data.length === "number") return img.data.length <= 16;
  return false;
}

function isStructuralMeshName(name: string): boolean {
  const n = String(name || "").toLowerCase();
  if (/_weapon_|weapon_|_shield|shield_/.test(n)) return false;
  if (/_xtra_|quiver|wood$|_bag$|bag$/.test(n)) return false;
  if (/units_(body|head|arms?|legs?|shoulderpads?)_/.test(n)) return true;
  if (/^[a-z]{2,4}_(body|head|arms?|legs?|shoulderpads?)_/.test(n)) return true;
  return false;
}

function measureBoneStructuralBBox(root: THREE.Object3D): THREE.Box3 | null {
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const s = o as THREE.SkinnedMesh;
    if (s.isSkinnedMesh && s.skeleton) s.skeleton.update();
  });
  const groups = [
    ["Bip001 Head", "Bip001_Head", "Head"],
    ["Bip001 HeadNub", "Bip001_HeadNub"],
    ["Bip001 Pelvis", "Bip001_Pelvis"],
    ["Bip001 Spine", "Bip001_Spine"],
    ["Bip001 L Foot", "Bip001_L_Foot"],
    ["Bip001 R Foot", "Bip001_R_Foot"],
    ["Bip001 L Toe0", "Bip001_L_Toe0"],
    ["Bip001 R Toe0", "Bip001_R_Toe0"],
    ["Bip001 L Hand", "Bip001_L_Hand"],
    ["Bip001 R Hand", "Bip001_R_Hand"],
  ];
  const box = new THREE.Box3();
  const p = new THREE.Vector3();
  let n = 0;
  for (const names of groups) {
    const bone = findNamed(root, names);
    if (!bone) continue;
    bone.getWorldPosition(p);
    if (!Number.isFinite(p.x + p.y + p.z)) continue;
    if (n === 0) {
      box.min.copy(p);
      box.max.copy(p);
    } else box.expandByPoint(p);
    n++;
  }
  if (n < 2) return null;
  const h = Math.max(box.max.y - box.min.y, 1e-4);
  const pad = Math.max(h * 0.1, h * 0.02);
  box.min.y -= pad * 0.55;
  box.max.y += pad * 0.45;
  return box;
}

function measureStructuralBBox(root: THREE.Object3D): THREE.Box3 {
  const bone = measureBoneStructuralBBox(root);
  if (bone && bone.max.y - bone.min.y > 0.05) return bone;
  const box = new THREE.Box3();
  let any = false;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (m.visible === false) return;
    if (!isStructuralMeshName(m.name)) return;
    const mb = new THREE.Box3().setFromObject(m);
    if (!Number.isFinite(mb.min.y)) return;
    if (!any) {
      box.copy(mb);
      any = true;
    } else box.union(mb);
  });
  return any ? box : new THREE.Box3().setFromObject(root);
}

/** PLAY contract: uniform root SI from bone bbox. Never setFromObject on stacked paperdoll. */
export function fitRootUniformSi(root: THREE.Object3D, targetH = 1.8) {
  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
  root.scale.setScalar(1);
  root.updateMatrixWorld(true);
  let box = measureStructuralBBox(root);
  let h = Math.max(box.max.y - box.min.y, 1e-4);
  if (h > 40) {
    root.scale.setScalar(0.01);
    root.updateMatrixWorld(true);
    box = measureStructuralBBox(root);
    h = Math.max(box.max.y - box.min.y, 1e-4);
  }
  root.scale.setScalar(root.scale.x * (targetH / h));
  root.updateMatrixWorld(true);
  box = measureStructuralBBox(root);
  root.position.y -= box.min.y;
  const cx = (box.min.x + box.max.x) * 0.5;
  const cz = (box.min.z + box.max.z) * 0.5;
  root.position.x -= cx;
  root.position.z -= cz;
  root.updateMatrixWorld(true);
}

export function safeSkeletonUpdate(root: THREE.Object3D) {
  root.traverse((o) => {
    const s = o as THREE.SkinnedMesh;
    if (!s.isSkinnedMesh || !s.skeleton) return;
    s.skeleton.update();
    s.frustumCulled = false;
    s.castShadow = true;
    s.receiveShadow = true;
  });
}

/** PLAY materials: keep Toon RTS embeds. sRGB, flipY=false, no atlas force. */
export function normalizeEmbeddedMaps(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial;
      if (!mat) continue;
      if (mat.map && !isStubMap(mat.map)) {
        mat.map.colorSpace = THREE.SRGBColorSpace;
        mat.map.flipY = false;
        mat.map.wrapS = mat.map.wrapT = THREE.ClampToEdgeWrapping;
        mat.map.anisotropy = 8;
        mat.map.needsUpdate = true;
        if (mat.color) mat.color.setHex(0xffffff);
        if ("metalness" in mat) mat.metalness = Math.min(mat.metalness ?? 0, 0.15);
        if ("roughness" in mat && (mat.roughness == null || mat.roughness < 0.2)) mat.roughness = 0.75;
        mat.needsUpdate = true;
      } else if (mat.map && isStubMap(mat.map)) {
        mat.map = null;
        mat.needsUpdate = true;
      }
    }
  });
  root.userData.grudge6MaterialMode = "embedded";
  root.userData.grudge6Play = true;
  root.userData.importPipeline = "toon-rts-glb";
}

function sanitizeClip(clip: THREE.AnimationClip, name: string): THREE.AnimationClip {
  const tracks = clip.tracks.filter((t) => {
    const n = t.name.split(".")[0] ?? "";
    if (n === "RootNode" && t.name.includes("position")) return false;
    if (n === "Bip001 Footsteps") return false;
    return true;
  });
  return new THREE.AnimationClip(name, clip.duration, tracks);
}

let packCache: Promise<Record<string, THREE.AnimationClip>> | null = null;
const glbBytes = new Map<string, Promise<ArrayBuffer>>();

export function fetchGlbBytes(url: string): Promise<ArrayBuffer> {
  let hit = glbBytes.get(url);
  if (!hit) {
    hit = (async () => {
      let res = await fetch(url, { mode: "cors" });
      if (res.status === 403 || res.status === 0) {
        const proxied = viaR2(url);
        if (proxied !== url) res = await fetch(proxied);
      }
      if (!res.ok) throw new Error(`glb ${res.status} ${url}`);
      return res.arrayBuffer();
    })().catch((err) => {
      glbBytes.delete(url);
      throw err;
    });
    glbBytes.set(url, hit);
  }
  return hit;
}

export async function parseCachedGlb(loader: GLTFLoader, url: string) {
  try {
    return await loader.loadAsync(url);
  } catch (err) {
    const proxied = viaR2(url);
    if (proxied !== url) return loader.loadAsync(proxied);
    throw err;
  }
}

function disposeParsedScene(root: THREE.Object3D) {
  disposeGpuTree(root);
}

const _seen = new Set<unknown>();

/** Drop GPU buffers for a discarded graph. Safe on swapped toons / dummy kits. */
export function disposeGpuTree(root: THREE.Object3D) {
  _seen.clear();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      if (mesh.geometry && !_seen.has(mesh.geometry)) {
        _seen.add(mesh.geometry);
        mesh.geometry.dispose();
      }
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if (!mat || _seen.has(mat)) continue;
        _seen.add(mat);
        const maps = [
          "map",
          "normalMap",
          "roughnessMap",
          "metalnessMap",
          "emissiveMap",
          "aoMap",
          "alphaMap",
          "bumpMap",
          "displacementMap",
        ] as const;
        for (const k of maps) {
          const tex = (mat as THREE.MeshStandardMaterial)[k];
          if (tex && !_seen.has(tex)) {
            _seen.add(tex);
            tex.dispose();
          }
        }
        mat.dispose();
      }
    }
    const skinned = o as THREE.SkinnedMesh;
    if (skinned.isSkinnedMesh) skinned.skeleton?.dispose();
  });
  _seen.clear();
}

export function loadBip001Packs(loader: GLTFLoader): Promise<Record<string, THREE.AnimationClip>> {
  if (packCache) return packCache;
  const names = [...BIP001_LOCO, ...BIP001_SHOTS];
  packCache = Promise.all(
    names.map(async (name) => {
      try {
        const gltf = await parseCachedGlb(loader, `${ANIM_BASE}/${name}.glb`);
        const src = gltf.animations[0];
        if (!src) return null;
        const clip = sanitizeClip(src, name);
        disposeParsedScene(gltf.scene);
        return [name, clip] as const;
      } catch {
        return null;
      }
    }),
  ).then((pairs) => Object.fromEntries(pairs.filter((p) => p != null)));
  return packCache;
}

export type ToonRig = {
  root: THREE.Group;
  rHand: THREE.Object3D | null;
  weapon: THREE.Mesh | null;
  raceId: string;
  armor: string;
  mixer: THREE.AnimationMixer | null;
  actions: Record<string, THREE.AnimationAction>;
  overlay: string | null;
  queue: AnimQueue;
  idleName: string;
  intensity: number;
};

const BONE_PAIRS: [string[], string[]][] = [
  [["Bip001 Pelvis", "Bip001_Pelvis"], ["Bip001 Spine", "Bip001_Spine"]],
  [["Bip001 Spine", "Bip001_Spine"], ["Bip001 Head", "Bip001_Head"]],
  [["Bip001 L UpperArm", "Bip001_L_UpperArm"], ["Bip001 L Hand", "Bip001_L_Hand"]],
  [["Bip001 R UpperArm", "Bip001_R_UpperArm"], ["Bip001 R Hand", "Bip001_R_Hand"]],
  [["Bip001 L Thigh", "Bip001_L_Thigh"], ["Bip001 L Foot", "Bip001_L_Foot"]],
  [["Bip001 R Thigh", "Bip001_R_Thigh"], ["Bip001 R Foot", "Bip001_R_Foot"]],
];

const _ba = new THREE.Vector3();
const _bb = new THREE.Vector3();

/** Fill FireBoost-style bone capsules from the live Bip001 pose. */
export function writeToonBoneSegments(
  root: THREE.Object3D,
  boneA: THREE.Vector4[],
  boneB: THREE.Vector4[],
): number {
  root.updateMatrixWorld(true);
  let n = 0;
  for (const [aNames, bNames] of BONE_PAIRS) {
    if (n >= boneA.length) break;
    const a = findNamed(root, aNames);
    const b = findNamed(root, bNames);
    if (!a || !b) continue;
    a.getWorldPosition(_ba);
    b.getWorldPosition(_bb);
    if (!Number.isFinite(_ba.x + _bb.x)) continue;
    const slotA = boneA[n];
    const slotB = boneB[n];
    if (!slotA || !slotB) break;
    const halfW = _ba.y > 1.25 ? 0.09 : 0.12;
    slotA.set(_ba.x, _ba.y, _ba.z, halfW);
    slotB.set(_bb.x, _bb.y, _bb.z, 0);
    n += 1;
  }
  return n;
}

const IDLE_NAMES = ["idle", "idle2", "idle_look"] as const;

function isIdleName(name: string) {
  return name === "idle" || name === "idle2" || name === "idle_look" || name === "walk" || name === "run";
}

export function restIdle(rig: ToonRig) {
  const names = IDLE_NAMES.filter((n) => rig.actions[n]);
  if (!names.length) return;
  const pick = names[Math.floor(Math.random() * names.length)]!;
  for (const n of names) {
    const a = rig.actions[n];
    if (!a) continue;
    a.enabled = true;
    if (!a.isRunning()) a.play();
    a.setEffectiveWeight(n === pick ? 1 : 0);
  }
  rig.idleName = pick;
}

export function bindMixer(rig: ToonRig, clips: Record<string, THREE.AnimationClip>) {
  if (rig.mixer) rig.mixer.stopAllAction();
  const target = rig.root.children[0] ?? rig.root;
  const mixer = new THREE.AnimationMixer(target);
  const actions: Record<string, THREE.AnimationAction> = {};
  for (const [name, clip] of Object.entries(clips)) {
    const action = mixer.clipAction(clip);
    if (isIdleName(name)) {
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.enabled = true;
      action.setEffectiveWeight(name === "idle" ? 1 : 0);
      action.play();
    } else {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = false;
      action.enabled = false;
      action.setEffectiveWeight(0);
    }
    actions[name] = action;
  }
  mixer.addEventListener("finished", (ev) => {
    const act = ev.action as THREE.AnimationAction | undefined;
    if (!act || !rig.overlay) return;
    if (rig.actions[rig.overlay] !== act) return;
    act.fadeOut(0.18);
    releaseShot(rig.queue, rig.overlay);
    rig.overlay = null;
    restIdle(rig);
  });
  rig.mixer = mixer;
  rig.actions = actions;
  rig.idleName = "idle";
}

export function tickMixer(
  rig: ToonRig,
  dt: number,
  speed: number,
  overlay: string | null,
  hold = false,
) {
  if (!rig.mixer) return;
  if (!rig.queue) rig.queue = makeAnimQueue();
  if (overlay) enqueueShot(rig.queue, overlay);
  const start = takeShot(rig.queue);
  const idle = rig.actions[rig.idleName] ?? rig.actions.idle;
  const walk = rig.actions.walk;
  const run = rig.actions.run;
  const runT = 6.2;
  const walkT = 0.45;
  let wIdle = 1;
  let wWalk = 0;
  let wRun = 0;
  if (speed > runT) {
    wRun = 1;
    wIdle = 0;
  } else if (speed > walkT) {
    const k = (speed - walkT) / (runT - walkT);
    wWalk = k;
    wIdle = 1 - k;
  }
  const intensity = THREE.MathUtils.clamp(rig.intensity || 1, 0.45, 1.6);
  if (start) {
    const shot = rig.actions[start] ?? rig.actions.attack ?? rig.actions.cast;
    if (shot) {
      shot.enabled = true;
      shot.reset();
      shot.setEffectiveWeight(THREE.MathUtils.clamp(0.75 * intensity, 0.45, 1));
      shot.setEffectiveTimeScale(intensity);
      shot.paused = false;
      shot.play();
      if (hold) {
        shot.time = Math.min(0.12, shot.getClip().duration * 0.18);
        shot.paused = true;
      }
      rig.overlay = start;
    } else {
      releaseShot(rig.queue, start);
    }
  }
  const busy = !!rig.overlay;
  idle?.setEffectiveWeight(busy ? wIdle * 0.15 : wIdle);
  walk?.setEffectiveWeight(busy ? wWalk * 0.15 : wWalk);
  run?.setEffectiveWeight(busy ? wRun * 0.15 : wRun);
  if (walk && wWalk > 0 && !walk.isRunning()) walk.play();
  if (run && wRun > 0 && !run.isRunning()) run.play();
  if (idle && wIdle > 0 && !idle.isRunning()) idle.play();
  if (!busy && speed <= walkT) {
    for (const n of IDLE_NAMES) {
      const a = rig.actions[n];
      if (!a || n === (rig.idleName || "idle")) continue;
      a.setEffectiveWeight(0);
    }
  }
  rig.mixer.update(dt);
}

export function preparePlayKit(
  scene: THREE.Object3D,
  opts: {
    raceId: string;
    asset: ProjectileAsset;
    armor?: string;
    clips?: Record<string, THREE.AnimationClip>;
    targetH?: number;
  },
): ToonRig {
  safeSkeletonUpdate(scene);
  normalizeEmbeddedMaps(scene);
  dressToon(scene, opts.asset, opts.raceId, opts.armor ?? "A");
  const root = new THREE.Group();
  root.add(scene);
  fitRootUniformSi(root, opts.targetH ?? 1.8);
  root.rotation.set(0, 0, 0);
  const rig: ToonRig = {
    root,
    rHand: findNamed(scene, ["R_hand_container", "Bip001 R Hand", "Bip001_R_Hand"]),
    weapon: findEquippedWeapon(root, opts.asset),
    raceId: opts.raceId,
    armor: opts.armor ?? "A",
    mixer: null,
    actions: {},
    overlay: null,
    queue: makeAnimQueue(),
    idleName: "idle",
    intensity: 1,
  };
  if (opts.clips) bindMixer(rig, opts.clips);
  return rig;
}

/** @deprecated procedural posing — PLAY uses tickMixer / Bip001 packs */
export function animateToon(_rig: ToonRig, dt: number) {
  if (_rig.mixer) _rig.mixer.update(dt);
}

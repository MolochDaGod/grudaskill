import * as THREE from "three";
import type { ProjectileAsset, School, SkillDef } from "./skills";

export type SlashStyle = "hiato" | "hiken" | "frost" | "shadow" | "gale" | "heavy";

export const SLASH_PALETTE: Record<SlashStyle, { core: string; flame: string }> = {
  hiato: { core: "#fff7e0", flame: "#ffd36a" },
  hiken: { core: "#ffe9b8", flame: "#ff4d18" },
  frost: { core: "#f3ffff", flame: "#5ad8ff" },
  shadow: { core: "#f3e8ff", flame: "#7c3aed" },
  gale: { core: "#f0fff6", flame: "#4ade80" },
  heavy: { core: "#f8fafc", flame: "#94a3b8" },
};

export function slashStyleFor(skill: SkillDef): SlashStyle {
  if (skill.school === "fire") return "hiken";
  if (skill.school === "frost") return "frost";
  if (skill.school === "shadow" || skill.school === "arcane") return "shadow";
  if (skill.school === "nature") return "gale";
  if (skill.asset === "spear" && skill.force >= 24) return "heavy";
  if (skill.impact >= 2.2) return "heavy";
  return "hiato";
}

/** Rapier cuboid half-extents (x=width, y=height, z=thickness) for a slash volume. */
export function slashHalfExtents(skill: SkillDef): { x: number; y: number; z: number } {
  const style = slashStyleFor(skill);
  const w = 0.85 + skill.length * 0.45;
  const h = style === "heavy" ? 0.95 : 0.62 + skill.size * 0.8;
  const z = style === "heavy" ? 0.14 : 0.07 + skill.size * 0.12;
  return { x: w, y: h, z };
}

export function isFlyingSlash(skill: SkillDef): boolean {
  if (skill.kind === "slash") return true;
  if (skill.kind === "weapon" && skill.asset !== "arrow") return true;
  if (skill.kind === "cone" && skill.school === "physical") return true;
  return false;
}

export function weaponSwingProfile(asset: ProjectileAsset): {
  delay: number;
  invert: number;
  flatten: number;
} {
  if (asset === "spear") return { delay: 0.1, invert: 0.25, flatten: 0.72 };
  if (asset === "fire" || asset === "ice" || asset === "bolt") return { delay: 0.18, invert: 0.55, flatten: 0.4 };
  return { delay: 0.14, invert: 0.42, flatten: 0.55 };
}

const vert = /* glsl */ `
varying vec2 vUv;
uniform float uArc;
uniform float uWidth;
uniform float uHeight;
void main() {
  vUv = uv;
  float a = (uv.x - 0.5) * uArc;
  vec3 p = position;
  p.x = sin(a) * uWidth;
  p.z = (1.0 - cos(a)) * uWidth * 0.42;
  p.y = (uv.y - 0.5) * uHeight;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const frag = /* glsl */ `
varying vec2 vUv;
uniform vec3 uCore;
uniform vec3 uFlame;
uniform float uLife;
uniform float uTime;
void main() {
  float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
  float rim = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
  float pulse = 0.55 + 0.45 * sin(uTime * 22.0 + vUv.x * 14.0);
  float core = pow(rim * edge, 0.65) * pulse;
  vec3 col = mix(uFlame, uCore, core);
  float alpha = edge * rim * uLife * (0.55 + 0.45 * pulse);
  gl_FragColor = vec4(col, alpha);
}
`;

function makeMat(core: string, flame: string): THREE.ShaderMaterial {
  const c = new THREE.Color(core);
  const f = new THREE.Color(flame);
  return new THREE.ShaderMaterial({
    uniforms: {
      uCore: { value: new THREE.Vector3(c.r, c.g, c.b) },
      uFlame: { value: new THREE.Vector3(f.r, f.g, f.b) },
      uLife: { value: 1 },
      uTime: { value: 0 },
      uArc: { value: 1.7 },
      uWidth: { value: 1.2 },
      uHeight: { value: 1.05 },
    },
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export type FlyingSlash = {
  active: boolean;
  mesh: THREE.Group;
  coreMat: THREE.ShaderMaterial;
  flameMat: THREE.ShaderMaterial;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  quat: THREE.Quaternion;
  life: number;
  age: number;
  speed: number;
  pierce: number;
  ignore: Set<number>;
  skill: SkillDef;
  half: { x: number; y: number; z: number };
  body: unknown;
};

function makeBladeMesh(skill: SkillDef): { group: THREE.Group; coreMat: THREE.ShaderMaterial; flameMat: THREE.ShaderMaterial } {
  const style = slashStyleFor(skill);
  const pal = SLASH_PALETTE[style];
  const half = slashHalfExtents(skill);
  const group = new THREE.Group();
  const plane = new THREE.PlaneGeometry(1, 1, 20, 6);
  const flameMat = makeMat(pal.core, pal.flame);
  flameMat.uniforms.uWidth!.value = half.x * 1.15;
  flameMat.uniforms.uHeight!.value = half.y * 2.15;
  flameMat.uniforms.uArc!.value = style === "heavy" ? 1.15 : 1.75;
  const flame = new THREE.Mesh(plane, flameMat);
  const coreMat = makeMat("#ffffff", pal.core);
  coreMat.uniforms.uWidth!.value = half.x * 0.92;
  coreMat.uniforms.uHeight!.value = half.y * 1.15;
  coreMat.uniforms.uArc!.value = flameMat.uniforms.uArc!.value;
  const core = new THREE.Mesh(plane.clone(), coreMat);
  core.position.z = 0.02;
  group.add(flame);
  group.add(core);
  group.visible = false;
  group.frustumCulled = false;
  return { group, coreMat, flameMat };
}

export function createSlashPool(n: number, scene: THREE.Scene): FlyingSlash[] {
  const dummy = {
    id: "slash",
    name: "Slash",
    kind: "slash" as const,
    asset: "spear" as const,
    color: "#ffe08a",
    length: 1.6,
    trail: 0.4,
    speed: 22,
    impact: 1.4,
    force: 18,
    size: 0.28,
    explosion: "kinetic" as const,
    path: "straight" as const,
    radius: 3,
    cone: 70,
    pierce: 4,
    count: 1,
    school: "physical" as School,
    book: "warrior",
    desc: "",
  };
  const pool: FlyingSlash[] = [];
  for (let i = 0; i < n; i++) {
    const made = makeBladeMesh(dummy);
    scene.add(made.group);
    pool.push({
      active: false,
      mesh: made.group,
      coreMat: made.coreMat,
      flameMat: made.flameMat,
      pos: new THREE.Vector3(),
      dir: new THREE.Vector3(0, 0, 1),
      quat: new THREE.Quaternion(),
      life: 0,
      age: 0,
      speed: 22,
      pierce: 4,
      ignore: new Set(),
      skill: dummy,
      half: slashHalfExtents(dummy),
      body: null,
    });
  }
  return pool;
}

const _up = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();

export function orientSlash(s: FlyingSlash) {
  _z.copy(s.dir).normalize();
  _x.crossVectors(_up, _z);
  if (_x.lengthSq() < 1e-6) _x.set(1, 0, 0);
  _x.normalize();
  _y.crossVectors(_z, _x).normalize();
  _m.makeBasis(_x, _y, _z);
  _q.setFromRotationMatrix(_m);
  s.quat.copy(_q);
  s.mesh.quaternion.copy(_q);
  s.mesh.position.copy(s.pos);
}

export function restyleSlash(s: FlyingSlash, skill: SkillDef) {
  const pal = SLASH_PALETTE[slashStyleFor(skill)];
  const half = slashHalfExtents(skill);
  s.half = half;
  const apply = (mat: THREE.ShaderMaterial, core: string, flame: string, w: number, h: number) => {
    const c = new THREE.Color(core);
    const f = new THREE.Color(flame);
    mat.uniforms.uCore!.value.set(c.r, c.g, c.b);
    mat.uniforms.uFlame!.value.set(f.r, f.g, f.b);
    mat.uniforms.uWidth!.value = w;
    mat.uniforms.uHeight!.value = h;
  };
  apply(s.flameMat, pal.core, pal.flame, half.x * 1.15, half.y * 2.15);
  apply(s.coreMat, "#ffffff", pal.core, half.x * 0.92, half.y * 1.15);
}

/**
 * Inverse of the swing that launched it, linearized forward.
 * Down-chop → flying slash keeps that pitch (slightly inverted so it stays
 * readable), always in front of the fighter, height from the blade.
 */
export function slashLaunch(
  handNow: THREE.Vector3,
  handPrev: THREE.Vector3,
  aim: THREE.Vector3,
  origin: THREE.Vector3,
  profile: { invert: number; flatten: number },
): { pos: THREE.Vector3; dir: THREE.Vector3 } {
  const swing = new THREE.Vector3().subVectors(handNow, handPrev);
  const aimDir = new THREE.Vector3().subVectors(aim, origin);
  aimDir.y = 0;
  if (aimDir.lengthSq() < 1e-6) aimDir.set(0, 0, 1);
  aimDir.normalize();

  const dir = new THREE.Vector3();
  if (swing.lengthSq() < 1e-5) {
    dir.copy(aimDir);
  } else {
    dir.copy(swing).normalize();
    if (dir.dot(aimDir) < 0) dir.negate();
    dir.lerp(aimDir, profile.flatten);
    dir.y = THREE.MathUtils.clamp(-swing.y * profile.invert * 6, -0.42, 0.48);
    if (dir.lengthSq() < 1e-6) dir.copy(aimDir);
    dir.normalize();
  }

  const pos = handNow.clone();
  const high = THREE.MathUtils.clamp(handNow.y, 0.42, 1.85);
  pos.y = THREE.MathUtils.lerp(high, 1.05 + dir.y * 0.6, 0.35);
  pos.addScaledVector(dir, 0.55);
  return { pos, dir };
}

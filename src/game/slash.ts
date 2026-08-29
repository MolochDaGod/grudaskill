import * as THREE from "three";
import type { ProjectileAsset, School, SkillDef } from "./skills";

export type SlashStyle = "hiato" | "hiken" | "frost" | "shadow" | "gale" | "heavy" | "bolt" | "holy";

export const SLASH_PALETTE: Record<SlashStyle, { core: string; flame: string }> = {
  hiato: { core: "#e8f6c8", flame: "#3a4a20" },
  hiken: { core: "#ff6a28", flame: "#140804" },
  frost: { core: "#9ee8ff", flame: "#061018" },
  shadow: { core: "#c9a6ff", flame: "#0a0614" },
  gale: { core: "#b8ffcc", flame: "#06140c" },
  heavy: { core: "#e4ddd0", flame: "#161410" },
  bolt: { core: "#fff4a8", flame: "#0c1020" },
  holy: { core: "#ffe9a0", flame: "#1a1408" },
};

export const SLASH_MODE: Record<SlashStyle, number> = {
  hiato: 0,
  hiken: 1,
  frost: 2,
  shadow: 3,
  gale: 4,
  heavy: 5,
  bolt: 6,
  holy: 7,
};

export function slashStyleFor(skill: SkillDef): SlashStyle {
  if (skill.school === "fire") return "hiken";
  if (skill.school === "frost") return "frost";
  if (skill.school === "shadow" || skill.school === "arcane") return "shadow";
  if (skill.school === "nature") return "gale";
  if (skill.school === "lightning") return "bolt";
  if (skill.school === "holy") return "holy";
  if (skill.asset === "spear" && skill.force >= 24) return "heavy";
  if (skill.impact >= 2.2) return "heavy";
  return "hiato";
}

/** Razor-thin vertical crescent — the air that left the blade. */
export function slashHalfExtents(skill: SkillDef): { x: number; y: number; z: number } {
  const w = 0.95 + skill.length * 0.55;
  const h = 0.72 + skill.size * 0.85;
  return { x: w, y: h, z: 0.055 + skill.size * 0.04 };
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
  return { delay: 0.1, invert: 0.28, flatten: 0.68 };
}

export function meleeReach(skill: SkillDef): number {
  return 1.55 + skill.length * 0.45;
}

const gloomVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
uniform float uArc;
uniform float uWidth;
uniform float uHeight;
void main() {
  vUv = uv;
  float a = (uv.x - 0.5) * uArc;
  vec3 p = position;
  p.x = sin(a) * uWidth;
  p.z = (1.0 - cos(a)) * uWidth * 0.22;
  p.y = (uv.y - 0.5) * uHeight;
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const gloomFrag = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
uniform vec3 uCore;
uniform vec3 uFlame;
uniform float uLife;
uniform float uTime;
uniform float uMode;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0,0.0));
  float c = hash(i + vec2(0.0,1.0));
  float d = hash(i + vec2(1.0,1.0));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
}
float fbm(vec2 p){
  float v = 0.0; float a = 0.5;
  for(int i=0;i<5;i++){ v += a * noise(p); p = p * 2.11 + 13.7; a *= 0.5; }
  return v;
}
void main() {
  float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
  float rim = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
  float n = fbm(vWorld.xz * 2.4 + vec2(uTime * 1.8, uTime * -0.9));
  float streak = fbm(vec2(vUv.x * 3.0, vUv.y * 18.0 - uTime * 8.0));
  float blade = pow(edge * rim, 0.55);
  float scream = smoothstep(0.35, 0.95, streak);
  vec3 col = mix(uFlame, uCore, blade);
  col = mix(col, uCore * 1.4, scream * 0.55);
  float alpha = blade * uLife * (0.55 + 0.45 * scream);
  if (uMode > 0.5 && uMode < 1.5) {
    col = mix(uFlame, uCore, scream);
    alpha *= 0.85 + 0.3 * scream;
  } else if (uMode > 1.5 && uMode < 2.5) {
    float band = abs(fract(vUv.x * 9.0 + n) - 0.5);
    col = mix(uFlame, uCore, 1.0 - smoothstep(0.0, 0.18, band));
  } else if (uMode > 2.5 && uMode < 3.5) {
    alpha *= step(0.38, n);
  } else if (uMode > 5.5 && uMode < 6.5) {
    float jag = step(0.5, fract(vUv.x * 22.0 + uTime * 14.0));
    col = mix(uFlame, uCore, jag);
    alpha *= 0.5 + jag * 0.6;
  }
  gl_FragColor = vec4(col, alpha);
}
`;

function makeGloomMat(core: string, flame: string): THREE.ShaderMaterial {
  const c = new THREE.Color(core);
  const f = new THREE.Color(flame);
  return new THREE.ShaderMaterial({
    uniforms: {
      uCore: { value: new THREE.Vector3(c.r, c.g, c.b) },
      uFlame: { value: new THREE.Vector3(f.r, f.g, f.b) },
      uLife: { value: 1 },
      uTime: { value: 0 },
      uArc: { value: 2.15 },
      uWidth: { value: 1.2 },
      uHeight: { value: 0.85 },
      uMode: { value: 0 },
    },
    vertexShader: gloomVert,
    fragmentShader: gloomFrag,
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
  clash: Set<string>;
  skill: SkillDef;
  half: { x: number; y: number; z: number };
  body: unknown;
  slot: number;
};

function makeBladeMesh(skill: SkillDef): {
  group: THREE.Group;
  coreMat: THREE.ShaderMaterial;
  flameMat: THREE.ShaderMaterial;
} {
  const pal = SLASH_PALETTE[slashStyleFor(skill)];
  const half = slashHalfExtents(skill);
  const group = new THREE.Group();
  const plane = new THREE.PlaneGeometry(1, 1, 28, 8);
  const flameMat = makeGloomMat(pal.core, pal.flame);
  flameMat.uniforms.uWidth!.value = half.x * 1.15;
  flameMat.uniforms.uHeight!.value = half.y * 1.9;
  const flame = new THREE.Mesh(plane, flameMat);
  const coreMat = makeGloomMat("#ffffff", pal.core);
  coreMat.uniforms.uWidth!.value = half.x * 0.72;
  coreMat.uniforms.uHeight!.value = half.y * 1.15;
  const core = new THREE.Mesh(plane.clone(), coreMat);
  core.position.z = 0.02;
  group.add(flame, core);
  group.visible = false;
  group.frustumCulled = false;
  return { group, coreMat, flameMat };
}

export function createSlashPool(n: number, scene: THREE.Scene): FlyingSlash[] {
  const dummy: SkillDef = {
    id: "slash",
    name: "Slash",
    kind: "slash",
    asset: "spear",
    color: "#e8f6c8",
    length: 1.6,
    trail: 0.4,
    speed: 28,
    impact: 1.4,
    force: 18,
    size: 0.28,
    explosion: "kinetic",
    path: "straight",
    radius: 3,
    cone: 70,
    pierce: 3,
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
      speed: 28,
      pierce: 3,
      ignore: new Set(),
      clash: new Set(),
      skill: dummy,
      half: slashHalfExtents(dummy),
      body: null,
      slot: i,
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
  _z.copy(s.dir);
  if (_z.lengthSq() < 1e-6) _z.set(0, 0, 1);
  _z.normalize();
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

export function tickSlash(s: FlyingSlash, dt: number) {
  const scream = 1 + 0.05 * Math.sin(s.age * 36);
  s.mesh.scale.set(scream, 1, 1);
  s.flameMat.uniforms.uTime!.value = s.age;
  s.coreMat.uniforms.uTime!.value = s.age;
  const life = Math.max(0, Math.min(1, s.life));
  s.flameMat.uniforms.uLife!.value = life;
  s.coreMat.uniforms.uLife!.value = life;
  void dt;
}

export function restyleSlash(s: FlyingSlash, skill: SkillDef) {
  const style = slashStyleFor(skill);
  const pal = SLASH_PALETTE[style];
  const half = slashHalfExtents(skill);
  s.half = half;
  const mode = SLASH_MODE[style];
  const apply = (mat: THREE.ShaderMaterial, core: string, flame: string, w: number, h: number) => {
    const c = new THREE.Color(core);
    const f = new THREE.Color(flame);
    mat.uniforms.uCore!.value.set(c.r, c.g, c.b);
    mat.uniforms.uFlame!.value.set(f.r, f.g, f.b);
    mat.uniforms.uWidth!.value = w;
    mat.uniforms.uHeight!.value = h;
    mat.uniforms.uMode!.value = mode;
    mat.uniforms.uArc!.value = style === "heavy" ? 1.45 : 2.15;
  };
  apply(s.flameMat, pal.core, pal.flame, half.x * 1.2, half.y * 1.9);
  apply(s.coreMat, "#ffffff", pal.core, half.x * 0.72, half.y * 1.1);
}

/** Inverse of the swing, linearized — the cut leaves the steel. */
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
    dir.y = THREE.MathUtils.clamp(-swing.y * profile.invert * 5, -0.22, 0.28);
    if (dir.lengthSq() < 1e-6) dir.copy(aimDir);
    dir.normalize();
  }

  const pos = handNow.clone();
  pos.y = THREE.MathUtils.clamp(handNow.y, 0.75, 1.7);
  pos.addScaledVector(dir, 0.42);
  return { pos, dir };
}

export function offsetSlashDir(dir: THREE.Vector3, yaw: number): THREE.Vector3 {
  const out = dir.clone();
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const x = out.x * c - out.z * s;
  const z = out.x * s + out.z * c;
  out.x = x;
  out.z = z;
  return out.normalize();
}

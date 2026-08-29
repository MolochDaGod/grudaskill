import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { WeatherId } from "./weather";

/** One InstancedMesh of tufts (merged blades) — Three.js cannot nest instances. */
const MAX_PLAYERS = 6;
const TUFT_COUNT = 280;
const TUFT_BLADES = 3;
const PATCH_RADIUS = 8.5;
const BLADE_H = 0.24;
const BLADE_W = 0.022;

const VERT = /* glsl */ `
uniform float time;
uniform vec3 playerPositions[6];
uniform int numPlayerPositions;
uniform float playerInteractionRadius;
uniform float playerInteractionStrength;
uniform float windAmp;
varying float vH;
varying vec3 vWorld;
varying vec3 vInstColor;

void main() {
#ifdef USE_INSTANCING_COLOR
  vInstColor = instanceColor;
#else
  vInstColor = vec3(0.22, 0.48, 0.16);
#endif
  vH = clamp(position.y / 0.36, 0.0, 1.0);
#ifdef USE_INSTANCING
  vec4 world = instanceMatrix * vec4(position, 1.0);
#else
  vec4 world = modelMatrix * vec4(position, 1.0);
#endif

  for (int i = 0; i < 6; i++) {
    if (i >= numPlayerPositions) break;
    vec2 d = world.xz - playerPositions[i].xz;
    float dist = length(d);
    if (dist > 0.001 && dist < playerInteractionRadius) {
      float inf = pow(1.0 - dist / playerInteractionRadius, 1.4) * vH;
      world.xz += normalize(d) * inf * playerInteractionStrength;
    }
  }

  float t = time * 0.85;
  vec2 wind = vec2(cos(t * 0.13), sin(t * 0.1));
  float n = sin(world.x * 0.85 + t) * 0.55 + sin(world.z * 1.1 + t * 1.4) * 0.45;
  world.xz += wind * n * vH * windAmp;

  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAG = /* glsl */ `
uniform vec3 sunDirection;
varying float vH;
varying vec3 vWorld;
varying vec3 vInstColor;
void main() {
  vec3 tip = vInstColor * 1.35 + vec3(0.08, 0.12, 0.02);
  vec3 col = mix(vInstColor * 0.72, tip, vH);
  float lit = 0.55 + 0.45 * max(0.0, normalize(sunDirection).y);
  col *= lit;
  gl_FragColor = vec4(col, 1.0);
}
`;

function makeTuft() {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < TUFT_BLADES; i++) {
    const g = new THREE.PlaneGeometry(BLADE_W, BLADE_H * (0.75 + (i % 3) * 0.12), 1, 3);
    g.translate(0, BLADE_H / 2, 0);
    const a = (i / TUFT_BLADES) * Math.PI * 2 + (i % 2) * 0.18;
    const r = 0.035 + (i % 3) * 0.016;
    g.rotateY(a);
    g.translate(Math.cos(a) * r, (i % 2) * 0.015, Math.sin(a) * r);
    parts.push(g);
  }
  const tuft = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  if (!tuft) return new THREE.PlaneGeometry(BLADE_W, BLADE_H);
  tuft.computeBoundingSphere();
  return tuft;
}

export class GrassField {
  readonly mesh: THREE.InstancedMesh;
  private material: THREE.ShaderMaterial;
  private slots: THREE.Vector3[];
  private time = 0;

  constructor(scene: THREE.Object3D) {
    this.slots = Array.from({ length: MAX_PLAYERS }, () => new THREE.Vector3(1e6, 1e6, 1e6));
    this.material = new THREE.ShaderMaterial({
      name: "GrassTuft",
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        time: { value: 0 },
        playerPositions: { value: this.slots },
        numPlayerPositions: { value: 1 },
        playerInteractionRadius: { value: 1.7 },
        playerInteractionStrength: { value: 0.62 },
        windAmp: { value: 0.14 },
        sunDirection: { value: new THREE.Vector3(0.45, 0.82, 0.35) },
      },
      side: THREE.DoubleSide,
      depthWrite: true,
      fog: false,
    });
    this.mesh = new THREE.InstancedMesh(makeTuft(), this.material, TUFT_COUNT);
    this.mesh.frustumCulled = true;
    this.mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < TUFT_COUNT; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * PATCH_RADIUS;
      dummy.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      const s = 0.8 + Math.random() * 0.45;
      dummy.scale.set(s, 0.75 + Math.random() * 0.5, s);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
      color.setHSL(0.27 + Math.random() * 0.08, 0.52 + Math.random() * 0.2, 0.26 + Math.random() * 0.12);
      this.mesh.setColorAt(i, color);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.computeBoundingSphere();
    this.mesh.name = "lab-grass";
    scene.add(this.mesh);
  }

  update(
    dt: number,
    player: THREE.Vector3,
    others: THREE.Vector3[],
    sunDir: THREE.Vector3,
    weather: WeatherId,
  ) {
    this.time += dt;
    const u = this.material.uniforms;
    u.time!.value = this.time;
    (u.sunDirection!.value as THREE.Vector3).copy(sunDir).normalize();
    this.slots[0]!.set(player.x, 0.9, player.z);
    let n = 1;
    for (let i = 0; i < others.length && n < MAX_PLAYERS; i++) {
      this.slots[n]!.set(others[i]!.x, 0.9, others[i]!.z);
      n++;
    }
    for (let i = n; i < MAX_PLAYERS; i++) this.slots[i]!.set(1e6, 1e6, 1e6);
    u.numPlayerPositions!.value = n;
    u.windAmp!.value = weather === "storm" ? 0.32 : weather === "rain" ? 0.2 : 0.14;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

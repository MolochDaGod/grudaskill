import * as THREE from "three";
import type { WeatherId } from "./weather";

const MAX_PLAYERS = 6;
const BLADE_COUNT = 48000;
const GRASS_RADIUS = 20;
const GRASS_HEIGHT = 0.85;
const GRASS_WIDTH = 0.12;

const VERT = /* glsl */ `
uniform vec3 grassSize;
uniform float time;
uniform vec3 playerPositions[6];
uniform int numPlayerPositions;
uniform float playerInteractionRadius;
uniform float playerInteractionStrength;
uniform float windAmp;
uniform vec3 sunDirection;
varying float vGrassHeight;
varying vec3 vWorldPosition;
varying vec3 vGrassColor;

float hash(float n) { return fract(sin(n) * 43758.5453); }
float hash2(vec2 p) { return hash(p.x + p.y * 57.0); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash2(i);
  float b = hash2(i + vec2(1.0, 0.0));
  float c = hash2(i + vec2(0.0, 1.0));
  float d = hash2(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
mat3 rotateY(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
}

void main() {
  vec3 localPos = position;
  float id = float(gl_InstanceID);
  float heightVariation = mix(0.65, 1.35, hash(id * 3.0));
  localPos.y *= heightVariation;
  vGrassHeight = clamp(localPos.y / max(grassSize.y, 0.01), 0.0, 1.0);
  float bladeTaper = mix(0.35, 1.0, 1.0 - vGrassHeight * vGrassHeight);
  float widthVariation = mix(0.75, 1.45, hash(id * 5.0));
  localPos.x *= bladeTaper * widthVariation;

  float leanAngle = (hash(id) - 0.5) * 0.28 + 0.12;
  float leanFactor = pow(1.0 - vGrassHeight, 1.2);
  localPos.x += leanFactor * grassSize.y * tan(leanAngle);

  float angle = (hash(id * 7.0) - 0.5) * 3.14159;
  localPos = rotateY(angle) * localPos;

  vec4 worldPos = instanceMatrix * vec4(localPos, 1.0);

  vec3 totalPush = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    if (i >= numPlayerPositions) break;
    vec3 pp = playerPositions[i];
    vec2 delta = worldPos.xz - pp.xz;
    float d = length(delta);
    if (d > playerInteractionRadius || d < 0.001) continue;
    float inf = pow(1.0 - smoothstep(0.0, playerInteractionRadius, d), 1.5);
    inf *= 1.0 - smoothstep(0.2, 1.4, abs(pp.y - 0.9));
    totalPush.xz += normalize(delta) * inf * playerInteractionStrength * vGrassHeight * grassSize.y;
  }
  worldPos.xyz += totalPush;

  float t = time * 0.6;
  float driftAngle = sin(t * 0.07) * 1.2;
  vec2 baseWind = vec2(cos(driftAngle), sin(driftAngle));
  float largeScaleNoise = noise(worldPos.xz * 0.05 + t * 0.05);
  float smallScaleNoise = noise(worldPos.xz * 1.2 + t * 0.6);
  float windNoise = mix(largeScaleNoise, smallScaleNoise, 0.3);
  vec2 burstCenter = vec2(sin(t * 0.3) * 16.0, cos(t * 0.25) * 16.0);
  float burst = smoothstep(10.0, 0.0, distance(worldPos.xz, burstCenter));
  windNoise += burst * 0.85;
  float bladeFactor = hash(id) * 0.5 + 0.75;
  float bladeAngleOffset = (hash(id * 13.0) - 0.5) * 0.5;
  vec2 windDir = normalize(baseWind + vec2(cos(bladeAngleOffset), sin(bladeAngleOffset)) * 0.25);
  float swayFactor = 0.25 + 0.75 * vGrassHeight;
  worldPos.xz += windDir * windNoise * swayFactor * bladeFactor * windAmp * grassSize.y;

  vWorldPosition = worldPos.xyz;

  float bladeSeed = id * 12.9898;
  float baseNoise = hash2(vec2(bladeSeed, 0.0));
  float tipNoise = hash2(vec2(bladeSeed, 1.0));
  vec3 b1 = vec3(0.18, 0.38, 0.10) + (baseNoise - 0.5) * 0.08;
  vec3 b2 = vec3(0.24, 0.44, 0.14) + (baseNoise - 0.5) * 0.08;
  vec3 t1 = vec3(0.32, 0.52, 0.12) + (tipNoise - 0.5) * 0.08;
  vec3 t2 = vec3(0.40, 0.58, 0.16) + (tipNoise - 0.5) * 0.08;
  float blend = clamp(pow(vGrassHeight, 1.35) + noise(worldPos.xz * 1.3 + bladeSeed) * 0.05, 0.0, 1.0);
  vec3 grassColor = mix(
    mix(b1, b2, noise(worldPos.xz * 0.3 + bladeSeed)),
    mix(t1, t2, noise(worldPos.xz * 0.35 + bladeSeed)),
    blend
  );
  float sunFactor = max(0.0, dot(vec3(0.0, 1.0, 0.0), normalize(sunDirection)));
  grassColor *= (0.72 + 0.28 * sunFactor);
  vGrassColor = grassColor;

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const FRAG = /* glsl */ `
#include <common>
uniform vec3 sunDirection;
uniform vec3 sunColor;
uniform float sunIntensity;
uniform vec3 ambientLight;
varying float vGrassHeight;
varying vec3 vWorldPosition;
varying vec3 vGrassColor;

float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash2(i);
  float b = hash2(i + vec2(1.0, 0.0));
  float c = hash2(i + vec2(0.0, 1.0));
  float d = hash2(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

void main() {
  vec3 N = vec3(0.0, 1.0, 0.0);
  vec3 V = normalize(cameraPosition - vWorldPosition);
  vec3 L = normalize(sunDirection);
  float NdotL = max(dot(N, L), 0.0);
  float diffuse = NdotL * sunIntensity * 0.28;
  float SSS = pow(max(dot(N, -L), 0.0), 2.0) * 0.55;
  float rim = pow(1.0 - abs(dot(V, N)), 2.0) * 0.28;
  vec3 lightTerm = ambientLight * 0.85 + sunColor * (diffuse + SSS * 0.35 + rim * 0.2);
  vec3 litColor = vGrassColor * lightTerm;
  float heightShift = vGrassHeight * 0.1;
  litColor.r = clamp(litColor.r + heightShift, 0.0, 1.0);
  litColor.g = clamp(litColor.g + heightShift * 0.5, 0.0, 1.0);
  float jitter = mix(noise(vWorldPosition.xz * 0.5), noise(vWorldPosition.xz * 0.25 + vec2(12.3, 45.6)), 0.5);
  litColor *= mix(0.88, 1.12, jitter);
  float dist = length(vWorldPosition.xz - cameraPosition.xz);
  float fade = 1.0 - smoothstep(16.0, 24.0, dist);
  if (fade < 0.04) discard;
  litColor *= mix(0.82, 1.0, fade);
  gl_FragColor = vec4(litColor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function makeBlade() {
  const geo = new THREE.PlaneGeometry(GRASS_WIDTH, GRASS_HEIGHT, 1, 3);
  const pos = geo.attributes.position!;
  const vertsPerRow = 2;
  const rowCount = 4;
  for (let row = 0; row < rowCount; row++) {
    const heightPercent = row / 3;
    const widthScale = 1.0 - heightPercent * heightPercent * 0.8;
    for (let col = 0; col < vertsPerRow; col++) {
      const i = (row * vertsPerRow + col) * 3;
      pos.array[i]! *= widthScale;
    }
  }
  pos.needsUpdate = true;
  geo.translate(0, GRASS_HEIGHT / 2, 0);
  return geo;
}

export class GrassField {
  readonly mesh: THREE.InstancedMesh;
  private material: THREE.ShaderMaterial;
  private slots: THREE.Vector3[];
  private time = 0;

  constructor(scene: THREE.Scene) {
    this.slots = Array.from({ length: MAX_PLAYERS }, () => new THREE.Vector3(1e6, 1e6, 1e6));
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        time: { value: 0 },
        grassSize: { value: new THREE.Vector3(GRASS_WIDTH, GRASS_HEIGHT, 0) },
        playerPositions: { value: this.slots },
        numPlayerPositions: { value: 1 },
        playerInteractionRadius: { value: 2.6 },
        playerInteractionStrength: { value: 0.85 },
        windAmp: { value: 0.55 },
        sunDirection: { value: new THREE.Vector3(0.45, 0.82, 0.35).normalize() },
        sunColor: { value: new THREE.Color(1, 0.96, 0.82) },
        sunIntensity: { value: 1.1 },
        ambientLight: { value: new THREE.Color(0.42, 0.48, 0.38) },
      },
      side: THREE.DoubleSide,
      depthWrite: true,
      depthTest: true,
    });
    const geo = makeBlade();
    this.mesh = new THREE.InstancedMesh(geo, this.material, BLADE_COUNT);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = false;
    this.mesh.castShadow = false;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < BLADE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * GRASS_RADIUS;
      dummy.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.computeBoundingSphere();
    if (this.mesh.boundingSphere) this.mesh.boundingSphere.radius = GRASS_RADIUS + 2;
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
    this.slots[0]!.set(player.x, 0.9, player.z);
    let n = 1;
    for (let i = 0; i < others.length && n < MAX_PLAYERS; i++) {
      const p = others[i]!;
      this.slots[n]!.set(p.x, 0.9, p.z);
      n++;
    }
    for (let i = n; i < MAX_PLAYERS; i++) this.slots[i]!.set(1e6, 1e6, 1e6);
    u.numPlayerPositions!.value = n;
    u.sunDirection!.value.copy(sunDir).normalize();
    u.windAmp!.value = weather === "storm" ? 1.35 : weather === "rain" ? 0.95 : weather === "dusk" ? 0.4 : 0.55;
    const pale = weather === "snow" ? 0.55 : weather === "overcast" ? 0.75 : 1;
    (u.sunIntensity!.value as number) = (weather === "storm" ? 0.45 : weather === "dusk" ? 0.7 : 1.1) * pale;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

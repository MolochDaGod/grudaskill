import * as THREE from "three";

export type DayPeriod = "Night" | "Sunrise" | "Midday" | "Sunset";

export function hourToSun(hour: number) {
  const h = ((hour % 24) + 24) % 24;
  const sunrise = 6;
  const sunset = 20;
  const maxEl = 52;
  const isDay = h >= sunrise && h <= sunset;
  let normalized: number;
  let elevation: number;
  let azimuth: number;
  let period: DayPeriod;
  if (isDay) {
    normalized = (h - sunrise) / (sunset - sunrise);
    elevation = Math.cos(Math.PI * (normalized - 0.5)) * maxEl - 2;
    azimuth = 140 + 80 * normalized;
    period = normalized <= 0.22 ? "Sunrise" : normalized >= 0.78 ? "Sunset" : "Midday";
  } else {
    const nightHour = h >= sunset ? h : h + 24;
    normalized = (nightHour - sunset) / (24 - sunset + sunrise);
    elevation = -(8 + 18 * Math.sin(normalized * Math.PI));
    azimuth = 220 + 80 * normalized;
    period = "Night";
  }
  return { hour: h, elevation, azimuth, period, isDay, normalized };
}

export function formatClock(hour: number) {
  const h = ((hour % 24) + 24) % 24;
  const hi = Math.floor(h);
  const m = Math.floor((h - hi) * 60);
  const ampm = hi >= 12 ? "PM" : "AM";
  const d = hi % 12 || 12;
  return `${d}:${m.toString().padStart(2, "0")} ${ampm}`;
}

const CLOUD_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPosition;
void main() {
  vUv = uv;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const CLOUD_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uCloudColor;
uniform float uCoverage;
uniform vec3 uSunDir;
varying vec2 vUv;
varying vec3 vWorldPosition;

vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

const mat2 RM = mat2(0.80, 0.60, -0.60, 0.80);

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * snoise(p);
    p = RM * p * 2.03;
    a *= 0.5;
  }
  return v;
}

float ridged(vec2 p) {
  float v = 0.0;
  float a = 0.55;
  for (int i = 0; i < 4; i++) {
    v += a * (1.0 - abs(snoise(p)));
    p = RM * p * 2.09;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 wind = vec2(uTime * 0.021, uTime * 0.008);
  vec2 p = vWorldPosition.xz * 0.009 + wind;
  vec2 q = vec2(fbm(p), fbm(p + vec2(5.2, 1.3)));
  vec2 r = vec2(
    fbm(p + 3.6 * q + vec2(1.7, 9.2) + wind * 0.35),
    fbm(p + 3.6 * q + vec2(8.3, 2.8))
  );
  float shape = fbm(p + 3.8 * r);
  float fluff = ridged(p * 1.45 + r * 2.1 + wind * 0.18);
  float n = clamp(shape * 0.52 + fluff * 0.48, 0.0, 1.0);
  float lo = mix(0.62, 0.12, clamp(uCoverage, 0.0, 1.0));
  float dens = pow(smoothstep(lo, lo + 0.26, n), mix(1.55, 0.72, uCoverage));
  float edge = (1.0 - pow(abs(vUv.x - 0.5) * 2.0, 2.4)) * (1.0 - pow(abs(vUv.y - 0.5) * 2.0, 2.4));
  vec2 sunXZ = normalize(uSunDir.xz + vec2(0.001));
  vec2 fromC = normalize(vWorldPosition.xz + vec2(0.001));
  float sunLit = 0.5 + 0.5 * clamp(dot(fromC, sunXZ), 0.0, 1.0);
  vec3 shade = mix(uCloudColor * 0.42, uCloudColor, dens * (0.55 + 0.45 * sunLit));
  shade += uCloudColor * (1.0 - dens) * 0.22 * sunLit;
  float a = dens * edge * mix(0.4, 0.88, uCoverage);
  if (a < 0.02) discard;
  gl_FragColor = vec4(shade, a);
}
`;

const STAR_VERT = /* glsl */ `
attribute float size;
attribute vec3 color;
attribute float phase;
attribute float freq;
varying vec3 vColor;
uniform float time;
uniform float visibility;
void main() {
  vColor = color;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float twinkle = sin(time * freq + phase) * 0.2 + 0.8;
  gl_PointSize = size * twinkle * visibility;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const STAR_FRAG = /* glsl */ `
varying vec3 vColor;
uniform float visibility;
void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  float d = length(c) * 2.0;
  float core = (1.0 - smoothstep(0.0, 0.22, d)) * 0.9;
  float glow = (1.0 - smoothstep(0.2, 0.6, d)) * 0.18;
  float a = (core + glow) * visibility;
  if (a < 0.02) discard;
  gl_FragColor = vec4(mix(vec3(1.0), vColor, 0.65), a);
}
`;

function flareTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.12, "rgba(255,248,220,0.85)");
  g.addColorStop(0.35, "rgba(255,210,120,0.28)");
  g.addColorStop(1, "rgba(255,200,80,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class SkyCycle {
  hour = 12;
  timeScale = 0;
  period: DayPeriod = "Midday";
  readonly clouds: THREE.Mesh;
  readonly stars: THREE.Points;
  readonly glow: THREE.Sprite;
  private cloudMat: THREE.ShaderMaterial;
  private starMat: THREE.ShaderMaterial;
  private glowMat: THREE.SpriteMaterial;

  constructor(scene: THREE.Scene) {
    this.cloudMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uCloudColor: { value: new THREE.Color(1, 1, 1) },
        uCoverage: { value: 0.28 },
        uSunDir: { value: new THREE.Vector3(0.45, 0.82, 0.35) },
      },
      vertexShader: CLOUD_VERT,
      fragmentShader: CLOUD_FRAG,
    });
    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 1, 1), this.cloudMat);
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.position.y = 72;
    this.clouds.scale.setScalar(220);
    this.clouds.frustumCulled = false;
    this.clouds.renderOrder = -1;
    this.clouds.visible = false;

    const count = 1800;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    const freq = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random() * 0.5 + 0.5;
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 380;
      pos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      pos[i * 3 + 1] = Math.abs(Math.cos(phi)) * r;
      pos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
      const t = Math.random();
      if (t < 0.15) col.set([0.75, 0.82, 1], i * 3);
      else if (t < 0.3) col.set([1, 0.94, 0.78], i * 3);
      else col.set([1, 1, 1], i * 3);
      size[i] = t < 0.04 ? 4.5 : t < 0.2 ? 2.6 : 1.4;
      phase[i] = Math.random() * Math.PI * 2;
      freq[i] = 0.8 + Math.random() * 2.2;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(size, 1));
    geo.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
    geo.setAttribute("freq", new THREE.BufferAttribute(freq, 1));
    this.starMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, visibility: { value: 0 } },
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.stars = new THREE.Points(geo, this.starMat);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -2;
    this.stars.name = "lab-stars";
    scene.add(this.stars);

    this.glowMat = new THREE.SpriteMaterial({
      map: flareTexture(),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    this.glow = new THREE.Sprite(this.glowMat);
    this.glow.scale.setScalar(28);
    this.glow.frustumCulled = false;
    this.glow.name = "lab-glow";
    scene.add(this.glow);
  }

  setHour(hour: number) {
    this.hour = ((hour % 24) + 24) % 24;
  }

  update(
    dt: number,
    origin: THREE.Vector3,
    sunDir: THREE.Vector3,
    coverage: number,
    cloudTint: THREE.Color,
  ) {
    if (this.timeScale > 0) this.hour = (this.hour + (this.timeScale * dt) / 3600) % 24;
    const info = hourToSun(this.hour);
    this.period = info.period;
    this.cloudMat.uniforms.uTime!.value += dt;
    this.cloudMat.uniforms.uCoverage!.value = coverage;
    this.cloudMat.uniforms.uCloudColor!.value.copy(cloudTint);
    this.cloudMat.uniforms.uSunDir!.value.copy(sunDir);
    const night = info.period === "Night" ? 1 : info.period === "Sunset" || info.period === "Sunrise" ? 0.15 : 0;
    this.starMat.uniforms.time!.value += dt;
    this.starMat.uniforms.visibility!.value = night;
    this.stars.visible = night > 0.04;
    this.stars.position.copy(origin);
    const above = Math.max(0, sunDir.y);
    this.glow.visible = above > 0.02 && info.isDay;
    this.glow.position.copy(origin).addScaledVector(sunDir, 180);
    this.glowMat.opacity = Math.min(1, above * 1.8) * (info.period === "Midday" ? 0.85 : 1);
    this.glow.scale.setScalar(info.period === "Sunrise" || info.period === "Sunset" ? 38 : 26);
    return info;
  }

  dispose() {
    this.clouds.removeFromParent();
    this.stars.removeFromParent();
    this.glow.removeFromParent();
    this.clouds.geometry.dispose();
    this.cloudMat.dispose();
    this.stars.geometry.dispose();
    this.starMat.dispose();
    this.glowMat.map?.dispose();
    this.glowMat.dispose();
  }
}

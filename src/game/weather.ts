import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";

export type WeatherId = "sunny" | "dusk" | "overcast" | "rain" | "snow" | "storm";

export const WEATHERS: { id: WeatherId; label: string }[] = [
  { id: "sunny", label: "Sunny" },
  { id: "dusk", label: "Dusk" },
  { id: "overcast", label: "Overcast" },
  { id: "rain", label: "Rain" },
  { id: "snow", label: "Snow" },
  { id: "storm", label: "Storm" },
];

type Preset = {
  elevation: number;
  azimuth: number;
  turbidity: number;
  rayleigh: number;
  mieCoefficient: number;
  mieDirectionalG: number;
  cloudCoverage: number;
  cloudDensity: number;
  cloudSpeed: number;
  exposure: number;
  hemiSky: number;
  hemiGround: number;
  hemi: number;
  sunColor: number;
  sun: number;
  fog: number;
  fogDensity: number;
  ground: number;
  fall: number;
  flakes: number;
  size: number;
  color: number;
};

const PRESET: Record<WeatherId, Preset> = {
  sunny: {
    elevation: 48,
    azimuth: 160,
    turbidity: 2.2,
    rayleigh: 1.05,
    mieCoefficient: 0.004,
    mieDirectionalG: 0.82,
    cloudCoverage: 0.18,
    cloudDensity: 0.22,
    cloudSpeed: 0.00008,
    exposure: 1.12,
    hemiSky: 0xb8d8ff,
    hemiGround: 0x3a2a18,
    hemi: 0.72,
    sunColor: 0xfff1cc,
    sun: 1.35,
    fog: 0xc8dff2,
    fogDensity: 0.007,
    ground: 0x3d5a32,
    fall: 0,
    flakes: 0,
    size: 0,
    color: 0xffffff,
  },
  dusk: {
    elevation: 6,
    azimuth: 195,
    turbidity: 8,
    rayleigh: 2.4,
    mieCoefficient: 0.008,
    mieDirectionalG: 0.9,
    cloudCoverage: 0.32,
    cloudDensity: 0.35,
    cloudSpeed: 0.00006,
    exposure: 0.78,
    hemiSky: 0xffb080,
    hemiGround: 0x2a1410,
    hemi: 0.45,
    sunColor: 0xff8a4a,
    sun: 0.85,
    fog: 0x6a3a38,
    fogDensity: 0.012,
    ground: 0x2a241c,
    fall: 0,
    flakes: 0,
    size: 0,
    color: 0xffffff,
  },
  overcast: {
    elevation: 32,
    azimuth: 150,
    turbidity: 12,
    rayleigh: 0.55,
    mieCoefficient: 0.012,
    mieDirectionalG: 0.7,
    cloudCoverage: 0.86,
    cloudDensity: 0.78,
    cloudSpeed: 0.00012,
    exposure: 0.88,
    hemiSky: 0x8aa0b4,
    hemiGround: 0x222018,
    hemi: 0.55,
    sunColor: 0xdde4ee,
    sun: 0.35,
    fog: 0x8a96a4,
    fogDensity: 0.016,
    ground: 0x2e382c,
    fall: 0,
    flakes: 0,
    size: 0,
    color: 0xffffff,
  },
  rain: {
    elevation: 28,
    azimuth: 145,
    turbidity: 10,
    rayleigh: 0.7,
    mieCoefficient: 0.01,
    mieDirectionalG: 0.72,
    cloudCoverage: 0.92,
    cloudDensity: 0.82,
    cloudSpeed: 0.00022,
    exposure: 0.82,
    hemiSky: 0x6e8498,
    hemiGround: 0x1a1814,
    hemi: 0.42,
    sunColor: 0xc8d4e0,
    sun: 0.28,
    fog: 0x5a6a78,
    fogDensity: 0.02,
    ground: 0x243028,
    fall: 18,
    flakes: 1400,
    size: 0.085,
    color: 0xa8c8e8,
  },
  snow: {
    elevation: 22,
    azimuth: 140,
    turbidity: 6,
    rayleigh: 1.1,
    mieCoefficient: 0.006,
    mieDirectionalG: 0.78,
    cloudCoverage: 0.7,
    cloudDensity: 0.55,
    cloudSpeed: 0.0001,
    exposure: 0.98,
    hemiSky: 0xd0e4f8,
    hemiGround: 0x2a3038,
    hemi: 0.62,
    sunColor: 0xeef4ff,
    sun: 0.55,
    fog: 0xc4d4e4,
    fogDensity: 0.014,
    ground: 0x8aa0b0,
    fall: 4.2,
    flakes: 900,
    size: 0.14,
    color: 0xffffff,
  },
  storm: {
    elevation: 18,
    azimuth: 130,
    turbidity: 14,
    rayleigh: 0.4,
    mieCoefficient: 0.014,
    mieDirectionalG: 0.65,
    cloudCoverage: 0.98,
    cloudDensity: 0.92,
    cloudSpeed: 0.0004,
    exposure: 0.62,
    hemiSky: 0x4a5870,
    hemiGround: 0x121018,
    hemi: 0.28,
    sunColor: 0x8898b0,
    sun: 0.18,
    fog: 0x2c3444,
    fogDensity: 0.026,
    ground: 0x1c2420,
    fall: 24,
    flakes: 1800,
    size: 0.09,
    color: 0x9ab4cc,
  },
};

const _sun = new THREE.Vector3();

export class WeatherSystem {
  id: WeatherId = "sunny";
  readonly sky: Sky;
  readonly hemi: THREE.HemisphereLight;
  readonly sun: THREE.DirectionalLight;
  private fog: THREE.FogExp2;
  private renderer: THREE.WebGLRenderer;
  private precip: THREE.Points;
  private precipPos: Float32Array;
  private ground: THREE.MeshStandardMaterial | null = null;
  private flash = 0;
  private time = 0;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    this.sky = new Sky();
    this.sky.scale.setScalar(450);
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    this.hemi = new THREE.HemisphereLight(0xb8d8ff, 0x3a2a18, 0.72);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1cc, 1.35);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 60;
    this.sun.shadow.camera.left = -22;
    this.sun.shadow.camera.right = 22;
    this.sun.shadow.camera.top = 22;
    this.sun.shadow.camera.bottom = -22;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.fog = new THREE.FogExp2(0xc8dff2, 0.007);
    scene.fog = this.fog;

    const count = 1800;
    this.precipPos = new Float32Array(count * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.precipPos, 3));
    this.precip = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xa8c8e8,
        size: 0.08,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    this.precip.frustumCulled = false;
    this.precip.visible = false;
    scene.add(this.precip);
    this.set("sunny");
  }

  bindGround(mat: THREE.MeshStandardMaterial) {
    this.ground = mat;
    const p = PRESET[this.id];
    mat.color.setHex(p.ground);
  }

  set(id: WeatherId) {
    this.id = id;
    const p = PRESET[id];
    const u = this.sky.material.uniforms;
    u.turbidity.value = p.turbidity;
    u.rayleigh.value = p.rayleigh;
    u.mieCoefficient.value = p.mieCoefficient;
    u.mieDirectionalG.value = p.mieDirectionalG;
    u.cloudCoverage.value = p.cloudCoverage;
    u.cloudDensity.value = p.cloudDensity;
    u.cloudSpeed.value = p.cloudSpeed;
    u.showSunDisc.value = id === "overcast" || id === "rain" || id === "storm" ? 0 : 1;
    this.placeSun(p.elevation, p.azimuth);
    this.hemi.color.setHex(p.hemiSky);
    this.hemi.groundColor.setHex(p.hemiGround);
    this.hemi.intensity = p.hemi;
    this.sun.color.setHex(p.sunColor);
    this.sun.intensity = p.sun;
    this.fog.color.setHex(p.fog);
    this.fog.density = p.fogDensity;
    this.renderer.setClearColor(p.fog, 1);
    this.renderer.toneMappingExposure = p.exposure;
    if (this.ground) this.ground.color.setHex(p.ground);
    const mat = this.precip.material as THREE.PointsMaterial;
    mat.color.setHex(p.color);
    mat.size = p.size || 0.08;
    this.precip.visible = p.flakes > 0;
    this.scatter(p.flakes);
  }

  update(dt: number, origin: THREE.Vector3) {
    this.time += dt;
    const u = this.sky.material.uniforms;
    if (u.time) u.time.value = this.time;
    const p = PRESET[this.id];
    if (this.id === "storm") {
      this.flash -= dt;
      if (this.flash <= 0 && Math.random() < dt * 0.35) this.flash = 0.12 + Math.random() * 0.1;
      const bolt = this.flash > 0 ? 1.4 : 0;
      this.hemi.intensity = p.hemi + bolt;
      this.renderer.toneMappingExposure = p.exposure + bolt * 0.55;
    }
    if (!this.precip.visible) return;
    const pos = this.precipPos;
    const fall = p.fall;
    const drift = this.id === "snow" ? 1.6 : 0.4;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i]! += Math.sin(this.time + i) * drift * dt;
      pos[i + 1]! -= fall * dt * (this.id === "snow" ? 0.45 + ((i * 13) % 10) * 0.04 : 1);
      pos[i + 2]! += Math.cos(this.time * 0.7 + i) * drift * 0.5 * dt;
      const dx = pos[i]! - origin.x;
      const dy = pos[i + 1]! - origin.y;
      const dz = pos[i + 2]! - origin.z;
      if (dy < -1 || Math.abs(dx) > 16 || Math.abs(dz) > 16) {
        pos[i] = origin.x + (Math.random() - 0.5) * 28;
        pos[i + 1] = origin.y + 4 + Math.random() * 10;
        pos[i + 2] = origin.z + (Math.random() - 0.5) * 28;
      }
    }
    (this.precip.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  private scatter(count: number) {
    const pos = this.precipPos;
    const n = Math.min(count, pos.length / 3);
    this.precip.geometry.setDrawRange(0, n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 28;
      pos[i * 3 + 1] = Math.random() * 14;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 28;
    }
    (this.precip.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  private placeSun(elevation: number, azimuth: number) {
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    _sun.setFromSphericalCoords(1, phi, theta);
    this.sky.material.uniforms.sunPosition.value.copy(_sun);
    this.sun.position.copy(_sun).multiplyScalar(28);
    this.sun.target.position.set(0, 0, 0);
  }
}

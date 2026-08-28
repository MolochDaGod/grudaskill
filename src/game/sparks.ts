import * as THREE from "three";

const MAX = 900;

export class SparkPool {
  readonly points: THREE.Points;
  private life = new Float32Array(MAX);
  private vx = new Float32Array(MAX);
  private vy = new Float32Array(MAX);
  private vz = new Float32Array(MAX);
  private pos: Float32Array;
  private col: Float32Array;
  private i = 0;
  private color = new THREE.Color();

  constructor() {
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  burst(origin: THREE.Vector3, hex: string, count: number, speed: number, up = 0.4) {
    this.color.set(hex);
    const n = Math.min(count, 80);
    for (let k = 0; k < n; k++) {
      const i = this.i++ % MAX;
      this.life[i] = 0.25 + Math.random() * 0.45;
      this.pos[i * 3] = origin.x;
      this.pos[i * 3 + 1] = origin.y;
      this.pos[i * 3 + 2] = origin.z;
      const a = Math.random() * Math.PI * 2;
      const r = speed * (0.3 + Math.random());
      this.vx[i] = Math.cos(a) * r;
      this.vy[i] = up + Math.random() * speed;
      this.vz[i] = Math.sin(a) * r;
      this.col[i * 3] = this.color.r;
      this.col[i * 3 + 1] = this.color.g;
      this.col[i * 3 + 2] = this.color.b;
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }

  trail(origin: THREE.Vector3, dir: THREE.Vector3, hex: string, density: number) {
    this.color.set(hex);
    const n = density > 0.15 ? 1 + Math.floor(density * 2) : 0;
    for (let k = 0; k < n; k++) {
      const i = this.i++ % MAX;
      this.life[i] = 0.12 + density * 0.2;
      this.pos[i * 3] = origin.x + (Math.random() - 0.5) * 0.12;
      this.pos[i * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.12;
      this.pos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.12;
      this.vx[i] = -dir.x * 2 + (Math.random() - 0.5);
      this.vy[i] = -dir.y * 2 + (Math.random() - 0.2);
      this.vz[i] = -dir.z * 2 + (Math.random() - 0.5);
      this.col[i * 3] = this.color.r;
      this.col[i * 3 + 1] = this.color.g;
      this.col[i * 3 + 2] = this.color.b;
    }
  }

  update(dt: number) {
    let dirty = false;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      this.pos[i * 3] += this.vx[i] * dt;
      this.pos[i * 3 + 1] += this.vy[i] * dt;
      this.pos[i * 3 + 2] += this.vz[i] * dt;
      this.vy[i] += 4 * dt;
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = -99;
      }
      dirty = true;
    }
    if (dirty) {
      (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  }
}

// @ts-nocheck
import {
  AdditiveBlending,
  BufferGeometry,
  CircleGeometry,
  ConeGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  TorusGeometry,
  Vector3,
} from "three";

const COLOR = {
  fire: 0xff6a2a,
  water: 0x5ad8ff,
  earth: 0xc4a574,
  wind: 0xe8f6ff,
};

const ZONE = {
  fire: 1.55,
  water: 1.65,
  earth: 1.5,
  wind: 1.4,
};

const _dir = new Vector3();
const _mid = new Vector3();

/**
 * LinearAbility-style targeting: a ground arrow from the caster to the
 * cursor, and a far-cast circle sitting on the floor at the aim point.
 */
export class LinearAim {
  constructor() {
    this.group = new Group();
    this.group.name = "LinearAim";
    this.element = "fire";
    this.origin = new Vector3();
    this.target = new Vector3(0, 0, -8);
    this.maxRange = 16;
    this.minRange = 5.5;

    this.arrowMat = new MeshBasicMaterial({
      color: COLOR.fire,
      transparent: true,
      opacity: 0.92,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    });
    this.ringMat = new MeshBasicMaterial({
      color: COLOR.fire,
      transparent: true,
      opacity: 0.95,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    this.fillMat = new MeshBasicMaterial({
      color: COLOR.fire,
      transparent: true,
      opacity: 0.12,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    });

    this.shaftGeo = new BufferGeometry();
    this.shaftGeo.setAttribute("position", new Float32BufferAttribute(new Float32Array(18), 3));
    this.shaft = new Mesh(this.shaftGeo, this.arrowMat);
    this.shaft.position.y = 0.05;
    this.shaft.frustumCulled = false;

    this.head = new Mesh(new ConeGeometry(0.28, 0.72, 3), this.arrowMat);
    this.head.rotation.x = Math.PI / 2;
    this.head.position.y = 0.08;

    this.ring = new Mesh(new TorusGeometry(1, 0.045, 8, 48), this.ringMat);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = 0.06;

    this.fill = new Mesh(new CircleGeometry(1, 40), this.fillMat);
    this.fill.rotation.x = -Math.PI / 2;
    this.fill.position.y = 0.03;

    this.inner = new Mesh(new TorusGeometry(0.35, 0.03, 8, 24), this.ringMat);
    this.inner.rotation.x = Math.PI / 2;
    this.inner.position.y = 0.07;

    this.group.add(this.shaft, this.head, this.ring, this.fill, this.inner);
  }

  setElement(element) {
    this.element = COLOR[element] ? element : "fire";
    const c = COLOR[this.element];
    this.arrowMat.color.setHex(c);
    this.ringMat.color.setHex(c);
    this.fillMat.color.setHex(c);
  }

  set(origin, target, dt = 0.016) {
    this.origin.copy(origin).setY(0);
    this.target.copy(target).setY(0);
    _dir.copy(this.target).sub(this.origin);
    let dist = _dir.length();
    if (dist < 0.2) _dir.set(0, 0, -1);
    else _dir.multiplyScalar(1 / dist);
    dist = Math.max(this.minRange, Math.min(this.maxRange, dist));
    this.target.copy(this.origin).addScaledVector(_dir, dist);

    const reach = this.origin.distanceTo(this.target);
    const halfW = 0.16;
    const tip = Math.max(0.6, reach - 0.55);
    const ox = this.origin.x;
    const oz = this.origin.z;
    const rx = _dir.x;
    const rz = _dir.z;
    const px = -rz;
    const pz = rx;
    const pos = this.shaftGeo.attributes.position.array;
    // two triangles: a tapering ground arrow
    pos[0] = ox + px * halfW;
    pos[1] = 0;
    pos[2] = oz + pz * halfW;
    pos[3] = ox - px * halfW;
    pos[4] = 0;
    pos[5] = oz - pz * halfW;
    pos[6] = ox + rx * tip + px * 0.05;
    pos[7] = 0;
    pos[8] = oz + rz * tip + pz * 0.05;
    pos[9] = ox - px * halfW;
    pos[10] = 0;
    pos[11] = oz - pz * halfW;
    pos[12] = ox + rx * tip - px * 0.05;
    pos[13] = 0;
    pos[14] = oz + rz * tip - pz * 0.05;
    pos[15] = ox + rx * tip + px * 0.05;
    pos[16] = 0;
    pos[17] = oz + rz * tip + pz * 0.05;
    this.shaftGeo.attributes.position.needsUpdate = true;
    this.shaftGeo.computeBoundingSphere();

    this.head.position.set(this.target.x - rx * 0.15, 0.1, this.target.z - rz * 0.15);
    this.head.rotation.y = Math.atan2(rx, rz);

    const zone = ZONE[this.element] ?? 1.55;
    this.ring.position.set(this.target.x, 0.06, this.target.z);
    this.fill.position.set(this.target.x, 0.03, this.target.z);
    this.inner.position.set(this.target.x, 0.07, this.target.z);
    const pulse = 1 + Math.sin(performance.now() * 0.006) * 0.04;
    this.ring.scale.setScalar(zone * pulse);
    this.fill.scale.setScalar(zone * pulse);
    this.inner.rotation.z += dt * 1.8;
    void dt;
  }

  linePoints() {
    const a = this.origin.clone().setY(0.02);
    const b = this.target.clone().setY(0.02);
    _mid.copy(a).lerp(b, 0.33);
    const c = a.clone().lerp(b, 0.66);
    return [a, _mid.clone(), c, b];
  }
}

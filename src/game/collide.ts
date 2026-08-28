import * as THREE from "three";

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _ab = new THREE.Vector3();
const _ap = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _pShot = new THREE.Vector3();
const _pCap = new THREE.Vector3();
const _closest = new THREE.Vector3();

/** Capsule standing on Y: center at (x, y + height/2, z), radius r. */
export type Capsule = {
  x: number;
  y: number;
  z: number;
  height: number;
  radius: number;
};

export function capsuleFromStanding(x: number, z: number, height = 1.7, radius = 0.42, y = 0): Capsule {
  return { x, y, z, height, radius };
}

export function closestOnCapsule(cap: Capsule, p: THREE.Vector3, out = _closest): THREE.Vector3 {
  const y0 = cap.y + cap.radius;
  const y1 = cap.y + cap.height - cap.radius;
  const y = THREE.MathUtils.clamp(p.y, Math.min(y0, y1), Math.max(y0, y1));
  _a.set(cap.x, y, cap.z);
  return out.copy(_a);
}

export function sphereHitsCapsule(pos: THREE.Vector3, radius: number, cap: Capsule): boolean {
  closestOnCapsule(cap, pos, _b);
  const r = radius + cap.radius;
  return pos.distanceToSquared(_b) <= r * r;
}

export function sweptSphereHitsCapsule(
  from: THREE.Vector3,
  to: THREE.Vector3,
  radius: number,
  cap: Capsule,
): boolean {
  if (sphereHitsCapsule(from, radius, cap) || sphereHitsCapsule(to, radius, cap)) return true;
  const y0 = cap.y + cap.radius;
  const y1 = cap.y + cap.height - cap.radius;
  _a.set(cap.x, y0, cap.z);
  _b.set(cap.x, y1, cap.z);
  _ab.subVectors(to, from);
  _axis.subVectors(_b, _a);
  const aLen = Math.max(_ab.lengthSq(), 1e-8);
  const bLen = Math.max(_axis.lengthSq(), 1e-8);
  const ab = _ab.dot(_axis);
  _ap.subVectors(from, _a);
  const den = Math.max(aLen * bLen - ab * ab, 1e-8);
  const t = THREE.MathUtils.clamp((_ab.dot(_ap) * bLen - ab * _axis.dot(_ap)) / den, 0, 1);
  const s = THREE.MathUtils.clamp((ab * t - _axis.dot(_ap)) / bLen, 0, 1);
  _pShot.copy(from).addScaledVector(_ab, t);
  _pCap.copy(_a).addScaledVector(_axis, s);
  const rad = radius + cap.radius;
  return _pShot.distanceToSquared(_pCap) <= rad * rad;
}


export function dummyCapsule(x: number, z: number): Capsule {
  return capsuleFromStanding(x, z, 1.75, 0.48, 0);
}

export function shotRadius(size: number): number {
  return 0.12 + size * 0.55;
}

import * as THREE from "three";

const _size = new THREE.Vector3();
const _center = new THREE.Vector3();
const _fwd = new THREE.Vector3(0, 0, 1);
const _q = new THREE.Quaternion();

/**
 * Put the longest bbox axis on local +Z (flight axis), centered at origin.
 * Then quaternion.setFromUnitVectors(+Z, dir) lays the asset along velocity
 * instead of standing it up (KayKit / Toon arrows are Y-up in bind pose).
 */
export function makeForwardMesh(src: THREE.Object3D, length: number): THREE.Group {
  const inner = new THREE.Group();
  inner.add(src);
  src.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(src);
  box.getCenter(_center);
  box.getSize(_size);
  src.position.sub(_center);
  const max = Math.max(_size.x, _size.y, _size.z, 0.001);
  if (_size.y >= _size.x && _size.y >= _size.z) inner.rotation.x = -Math.PI / 2;
  else if (_size.x >= _size.y && _size.x >= _size.z) inner.rotation.y = Math.PI / 2;
  const wrap = new THREE.Group();
  wrap.add(inner);
  inner.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(wrap);
  const z = Math.max(box2.getSize(_size).z, 0.001);
  wrap.scale.multiplyScalar(length / z);
  wrap.userData.forward = true;
  return wrap;
}

/** Align an object whose local +Z is the nose onto a world direction. */
export function orientForward(obj: THREE.Object3D, dir: THREE.Vector3) {
  if (dir.lengthSq() < 1e-8) return;
  _fwd.set(0, 0, 1);
  _q.setFromUnitVectors(_fwd, dir.clone().normalize());
  obj.quaternion.copy(_q);
}

import * as THREE from "three";
import { findNamed } from "./grudge6";

/**
 * Flat-ground Foot IK after the mixer, ported from
 * hh-hang/three-player-controller `solveTwoBoneIK` / `rotateBoneToward`
 * (example/footIK.html).
 *
 * Critical vs the broken first pass:
 * - rotate in WORLD, then `local = parentWorld^-1 * targetWorld` (copy, not premultiply)
 * - rest-pose knee pole so legs don't flip
 * - preserve animated foot world rotation after the chain rotates
 * - pelvis offset reapplied on the Bip001 Pelvis after the clip, never += on the wrapper
 */

const L_UPPER = ["Bip001 L Thigh", "Bip001_L_Thigh"];
const L_LOWER = ["Bip001 L Calf", "Bip001_L_Calf"];
const L_FOOT = ["Bip001 L Foot", "Bip001_L_Foot"];
const R_UPPER = ["Bip001 R Thigh", "Bip001_R_Thigh"];
const R_LOWER = ["Bip001 R Calf", "Bip001_R_Calf"];
const R_FOOT = ["Bip001 R Foot", "Bip001_R_Foot"];
const HIPS = ["Bip001 Pelvis", "Bip001_Pelvis", "Bip001"];

type Leg = {
  upper: THREE.Object3D;
  lower: THREE.Object3D;
  foot: THREE.Object3D;
  lastPole: THREE.Vector3;
  hasLastPole: boolean;
};

type RigIk = {
  pelvis: number;
  left: Leg | null;
  right: Leg | null;
};

const rigs = new WeakMap<THREE.Object3D, RigIk>();
const _v = Array.from({ length: 14 }, () => new THREE.Vector3());
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const _ident = new THREE.Quaternion();
const _footQ = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);

function bone(root: THREE.Object3D, names: string[]) {
  return findNamed(root, names);
}

function bindLeg(root: THREE.Object3D, u: string[], l: string[], f: string[]): Leg | null {
  const upper = bone(root, u);
  const lower = bone(root, l);
  const foot = bone(root, f);
  if (!upper || !lower || !foot) return null;
  return { upper, lower, foot, lastPole: new THREE.Vector3(0, 0, 1), hasLastPole: false };
}

function bind(root: THREE.Object3D): RigIk {
  let s = rigs.get(root);
  if (!s) {
    s = {
      pelvis: 0,
      left: bindLeg(root, L_UPPER, L_LOWER, L_FOOT),
      right: bindLeg(root, R_UPPER, R_LOWER, R_FOOT),
    };
    rigs.set(root, s);
  }
  return s;
}

function rotateBoneToward(joint: THREE.Object3D, effectorWorld: THREE.Vector3, targetWorld: THREE.Vector3, weight: number) {
  const parent = joint.parent;
  if (!parent || weight <= 0.001) return;
  const from = _v[10]!.copy(effectorWorld).sub(joint.getWorldPosition(_v[9]!)).normalize();
  const to = _v[11]!.copy(targetWorld).sub(joint.getWorldPosition(_v[9]!)).normalize();
  if (from.lengthSq() < 1e-8 || to.lengthSq() < 1e-8) return;
  const delta = _q1.setFromUnitVectors(from, to);
  delta.slerp(_ident, 1 - weight);
  const jointWorld = joint.getWorldQuaternion(_q2);
  const targetWorldQ = delta.multiply(jointWorld);
  const parentWorld = parent.getWorldQuaternion(_q3);
  joint.quaternion.copy(parentWorld.invert().multiply(targetWorldQ));
  joint.updateMatrixWorld(true);
}

function restPole(leg: Leg, out: THREE.Vector3) {
  const hip = leg.upper.getWorldPosition(_v[9]!);
  const knee = leg.lower.getWorldPosition(_v[10]!);
  const foot = leg.foot.getWorldPosition(_v[11]!);
  const chain = _v[12]!.copy(foot).sub(hip).normalize();
  out.copy(knee).sub(hip).addScaledVector(chain, -knee.clone().sub(hip).dot(chain));
  if (out.lengthSq() < 1e-8) out.set(0, 0, 1);
  else out.normalize();
  return out;
}

function solveTwoBone(leg: Leg, target: THREE.Vector3, weight: number) {
  if (weight <= 0.001) return;
  const hip = leg.upper.getWorldPosition(_v[0]!);
  const knee = leg.lower.getWorldPosition(_v[1]!);
  const foot = leg.foot.getWorldPosition(_v[2]!);
  const upperLen = Math.max(1e-4, hip.distanceTo(knee));
  const lowerLen = Math.max(1e-4, knee.distanceTo(foot));
  const hipTo = _v[3]!.copy(target).sub(hip);
  const dist0 = hipTo.length();
  if (dist0 < 1e-4) return;
  const minBend = THREE.MathUtils.degToRad(4);
  const maxBend = THREE.MathUtils.degToRad(145);
  const maxReach = Math.sqrt(upperLen ** 2 + lowerLen ** 2 + 2 * upperLen * lowerLen * Math.cos(minBend));
  const minReach = Math.sqrt(upperLen ** 2 + lowerLen ** 2 + 2 * upperLen * lowerLen * Math.cos(maxBend));
  const dist = THREE.MathUtils.clamp(dist0, minReach, maxReach);
  const clamped = _v[4]!.copy(hip).addScaledVector(hipTo, dist / dist0);
  const chainDir = _v[5]!.copy(clamped).sub(hip).normalize();
  const pole = restPole(leg, _v[6]!);
  pole.addScaledVector(chainDir, -pole.dot(chainDir));
  if (pole.lengthSq() < 1e-8) {
    if (leg.hasLastPole) pole.copy(leg.lastPole);
    else pole.set(0, 0, 1).addScaledVector(chainDir, -chainDir.z).normalize();
  } else pole.normalize();
  leg.lastPole.copy(pole);
  leg.hasLastPole = true;
  const along = (upperLen * upperLen - lowerLen * lowerLen + dist * dist) / (2 * dist);
  const height = Math.sqrt(Math.max(0, upperLen * upperLen - along * along));
  const desiredKnee = _v[7]!.copy(hip).addScaledVector(chainDir, along).addScaledVector(pole, height);
  rotateBoneToward(leg.upper, leg.lower.getWorldPosition(_v[8]!), desiredKnee, weight);
  rotateBoneToward(leg.lower, leg.foot.getWorldPosition(_v[8]!), clamped, weight);
}

function preserveFoot(leg: Leg, animatedWorldQ: THREE.Quaternion, weight: number) {
  const parent = leg.foot.parent;
  if (!parent || weight <= 0.001) return;
  const current = leg.foot.getWorldQuaternion(_q1);
  current.slerp(animatedWorldQ, THREE.MathUtils.clamp(weight, 0, 1));
  const parentWorld = parent.getWorldQuaternion(_q2);
  leg.foot.quaternion.copy(parentWorld.invert().multiply(current));
  leg.foot.updateMatrixWorld(true);
}

function applyLeg(leg: Leg, groundY: number, sole: number) {
  const foot = leg.foot.getWorldPosition(_v[0]!);
  const planted = foot.y <= groundY + 0.14;
  const sink = groundY + sole - foot.y;
  if (!planted || sink < 0.004) return;
  const w = THREE.MathUtils.clamp(sink / 0.08, 0, 1);
  leg.foot.getWorldQuaternion(_footQ);
  const target = _v[1]!.set(foot.x, groundY + sole, foot.z);
  solveTwoBone(leg, target, w);
  preserveFoot(leg, _footQ, 1);
}

function applyPelvis(root: THREE.Object3D, state: RigIk, dt: number, groundY: number, sole: number) {
  const hips = bone(root, HIPS);
  if (!hips?.parent) return;
  const ly = state.left ? state.left.foot.getWorldPosition(_v[0]!).y : 99;
  const ry = state.right ? state.right.foot.getWorldPosition(_v[1]!).y : 99;
  const lowest = Math.min(ly, ry);
  if (lowest > 90) return;
  const wanted = THREE.MathUtils.clamp(groundY + sole - lowest, 0, 0.12);
  state.pelvis = THREE.MathUtils.damp(state.pelvis, wanted, 12, dt);
  if (state.pelvis < 0.002) return;
  const world = hips.getWorldPosition(_v[2]!).addScaledVector(_up, state.pelvis);
  hips.parent.worldToLocal(world);
  hips.position.copy(world);
  hips.updateMatrixWorld(true);
}

/** Call after `mixer.update`. Flat arena, y = groundY. */
export function plantFeet(root: THREE.Object3D, dt = 1 / 60, groundY = 0, sole = 0.03) {
  const state = bind(root);
  root.updateMatrixWorld(true);
  if (state.left) applyLeg(state.left, groundY, sole);
  if (state.right) applyLeg(state.right, groundY, sole);
  applyPelvis(root, state, dt, groundY, sole);
}

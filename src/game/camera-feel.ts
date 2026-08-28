import * as THREE from "three";

/**
 * Chase camera + trauma² shake (noise, not white jitter).
 * Presentation only — never writes player transform.
 */
export class CameraFeel {
  trauma = 0;
  private decay = 1.7;
  private freq = 22;
  private time = 0;
  private look = new THREE.Vector3();
  private desired = new THREE.Vector3();
  private velLook = new THREE.Vector3();
  readonly offset = new THREE.Vector3();
  roll = 0;

  punch(amount: number, decay = 1.7, freq = 22) {
    this.trauma = Math.min(0.55, this.trauma + amount);
    this.decay = decay;
    this.freq = freq;
  }

  update(dt: number) {
    this.time += dt;
    if (this.trauma <= 1e-4) {
      this.offset.set(0, 0, 0);
      this.roll = 0;
      this.trauma = 0;
      return;
    }
    const shake = this.trauma * this.trauma;
    const t = this.time * this.freq;
    const nx = Math.sin(t) * 0.62 + Math.sin(t * 2.31 + 1.7) * 0.38;
    const ny = Math.sin(t * 1.37 + 4.2) * 0.62 + Math.sin(t * 2.79 + 0.3) * 0.38;
    const nz = Math.sin(t * 0.83 + 2.9) * 0.62 + Math.sin(t * 3.11 + 5.1) * 0.38;
    this.offset.set(nx, ny * 0.65, nz).multiplyScalar(shake * 0.22);
    this.roll = nz * shake * 0.014;
    this.trauma = Math.max(0, this.trauma - this.decay * dt);
  }

  /**
   * Orbit chase behind the hero, look-ahead along aim + velocity.
   * `forward` must be the same yaw basis used for movement.
   */
  apply(
    camera: THREE.PerspectiveCamera,
    player: THREE.Vector3,
    camYaw: number,
    camPitch: number,
    camDist: number,
    aim: THREE.Vector3,
    speed: number,
    dt: number,
    extraOffset?: THREE.Vector3,
    lookWeight = 0.12,
  ) {
    const fx = -Math.sin(camYaw);
    const fz = -Math.cos(camYaw);
    const height = Math.sin(camPitch) * camDist;
    const planar = Math.cos(camPitch) * camDist;
    this.desired.set(player.x - fx * planar, 1.35 + height, player.z - fz * planar);
    const k = 1 - Math.exp(-7.2 * dt);
    camera.position.lerp(this.desired, k);
    camera.position.add(this.offset);
    if (extraOffset) camera.position.add(extraOffset);

    this.velLook.set(fx, 0, fz).multiplyScalar(Math.min(2.4, speed * 0.18));
    this.look.set(player.x, 1.18, player.z);
    this.look.x += (aim.x - player.x) * lookWeight + this.velLook.x;
    this.look.y += (aim.y - 1.18) * lookWeight * 0.45;
    this.look.z += (aim.z - player.z) * lookWeight + this.velLook.z;
    camera.lookAt(this.look);
    camera.rotation.z += this.roll;
  }
}

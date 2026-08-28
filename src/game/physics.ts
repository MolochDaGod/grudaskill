import RAPIER from "@dimforge/rapier3d-compat";
import type { FlyingSlash } from "./slash";

export type DummyBody = {
  collider: RAPIER.Collider;
  index: number;
};

type ShotBody = {
  rb: RAPIER.RigidBody;
  col: RAPIER.Collider;
};

export class LabPhysics {
  world: RAPIER.World | null = null;
  private dummies: DummyBody[] = [];
  private shots: ShotBody[] = [];
  private ready = false;
  private acc = 0;
  private readonly STEP = 1 / 60;
  private ownsWorld = false;
  private playerBody: RAPIER.RigidBody | null = null;
  private playerCol: RAPIER.Collider | null = null;
  private controller: RAPIER.KinematicCharacterController | null = null;
  private groundCol: RAPIER.Collider | null = null;

  async init(existing?: RAPIER.World) {
    if (existing) {
      this.attachWorld(existing);
      return;
    }
    if (this.ready && this.world) return;
    await RAPIER.init();
    if (this.ready && this.world) return;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.ready = true;
    this.ownsWorld = true;
    this.ensureArena();
  }

  attachWorld(world: RAPIER.World) {
    if (this.world === world && this.ready) {
      this.ensureArena();
      return;
    }
    this.world = world;
    this.ready = true;
    this.ownsWorld = false;
    this.playerBody = null;
    this.playerCol = null;
    this.controller = null;
    this.groundCol = null;
    this.dummies = [];
    this.shots = [];
    this.ensureArena();
  }

  ensureArena() {
    if (!this.world) return;
    if (!this.controller) {
      this.controller = this.world.createCharacterController(0.08);
      this.controller.enableAutostep(0.35, 0.22, true);
      this.controller.enableSnapToGround(0.28);
      this.controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
      this.controller.setMinSlopeSlideAngle((35 * Math.PI) / 180);
      this.controller.setApplyImpulsesToDynamicBodies(true);
    }
    if (!this.playerBody) {
      this.playerBody = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.9, 0).setCcdEnabled(true),
      );
      this.playerCol = this.world.createCollider(
        RAPIER.ColliderDesc.capsule(0.45, 0.42).setTranslation(0, 0, 0),
        this.playerBody,
      );
    }
    if (this.ownsWorld && !this.groundCol) {
      this.groundCol = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(22, 0.5, 22).setTranslation(0, -0.5, 0),
      );
    }
  }

  resetDummies() {
    if (!this.world) return;
    for (const d of this.dummies) this.world.removeCollider(d.collider, true);
    this.dummies = [];
  }

  addDummy(index: number, x: number, z: number) {
    if (!this.world) return;
    const existing = this.dummies.find((b) => b.index === index);
    if (existing) {
      existing.collider.setTranslation({ x, y: 0.9, z });
      return;
    }
    const desc = RAPIER.ColliderDesc.capsule(0.45, 0.48)
      .setTranslation(x, 0.9, z)
      .setSensor(false);
    const col = this.world.createCollider(desc);
    this.dummies.push({ collider: col, index });
  }

  moveDummy(index: number, x: number, z: number) {
    const d = this.dummies.find((b) => b.index === index);
    d?.collider.setTranslation({ x, y: 0.9, z });
  }

  /** Kinematic character move. Returns the collision-corrected translation. */
  movePlayer(x: number, z: number, dx: number, dz: number): { x: number; z: number } {
    if (!this.world || !this.playerBody || !this.playerCol || !this.controller) {
      return { x: x + dx, z: z + dz };
    }
    this.playerBody.setNextKinematicTranslation({ x, y: 0.9, z });
    this.controller.computeColliderMovement(this.playerCol, { x: dx, y: 0, z: dz });
    const mv = this.controller.computedMovement();
    const nx = x + mv.x;
    const nz = z + mv.z;
    this.playerBody.setNextKinematicTranslation({ x: nx, y: 0.9, z: nz });
    return { x: nx, z: nz };
  }

  attachSlash(slash: FlyingSlash) {
    if (!this.world) return;
    const rb = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setCcdEnabled(true));
    const col = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(slash.half.x, slash.half.y, slash.half.z).setSensor(true),
      rb,
    );
    slash.body = { rb, col };
  }

  syncSlash(slash: FlyingSlash) {
    const body = slash.body as { rb: RAPIER.RigidBody; col: RAPIER.Collider } | null;
    if (!body) return;
    body.rb.setNextKinematicTranslation({ x: slash.pos.x, y: slash.pos.y, z: slash.pos.z });
    body.rb.setNextKinematicRotation({
      x: slash.quat.x,
      y: slash.quat.y,
      z: slash.quat.z,
      w: slash.quat.w,
    });
  }

  releaseSlash(slash: FlyingSlash) {
    if (!this.world || !slash.body) return;
    const body = slash.body as { rb: RAPIER.RigidBody; col: RAPIER.Collider };
    this.world.removeCollider(body.col, true);
    this.world.removeRigidBody(body.rb);
    slash.body = null;
  }

  hits(slash: FlyingSlash): number[] {
    const out: number[] = [];
    if (!this.world || !slash.body) return out;
    const col = (slash.body as { col: RAPIER.Collider }).col;
    this.world.intersectionPairsWith(col, (other) => {
      const dummy = this.dummies.find((d) => d.collider.handle === other.handle);
      if (dummy && !slash.ignore.has(dummy.index)) out.push(dummy.index);
    });
    return out;
  }

  attachShot(index: number, x: number, y: number, z: number, radius: number) {
    if (!this.world) return;
    this.releaseShot(index);
    const rb = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z).setCcdEnabled(true),
    );
    const col = this.world.createCollider(RAPIER.ColliderDesc.ball(radius).setSensor(true), rb);
    this.shots[index] = { rb, col };
  }

  syncShot(index: number, x: number, y: number, z: number) {
    const s = this.shots[index];
    if (!s) return;
    s.rb.setNextKinematicTranslation({ x, y, z });
  }

  shotHits(index: number, ignore: Set<number>): number[] {
    const out: number[] = [];
    const s = this.shots[index];
    if (!this.world || !s) return out;
    this.world.intersectionPairsWith(s.col, (other) => {
      const dummy = this.dummies.find((d) => d.collider.handle === other.handle);
      if (dummy && !ignore.has(dummy.index)) out.push(dummy.index);
    });
    return out;
  }

  releaseShot(index: number) {
    if (!this.world) return;
    const s = this.shots[index];
    if (!s) return;
    this.world.removeCollider(s.col, true);
    this.world.removeRigidBody(s.rb);
    delete this.shots[index];
  }

  step(dt: number) {
    if (!this.ready || !this.world || !this.ownsWorld) return;
    this.acc += Math.min(dt, 0.25);
    while (this.acc >= this.STEP) {
      this.world.step();
      this.acc -= this.STEP;
    }
  }
}

/** @react-three/rapier collider args — keep in lockstep with LabPhysics. */
export const R3F_SHAPES = {
  dummyCapsule: [0.45, 0.48] as [number, number],
  playerCapsule: [0.45, 0.42] as [number, number],
  slashCuboid: (hx: number, hy: number, hz: number) => [hx, hy, hz] as [number, number, number],
  ground: [22, 0.5, 22] as [number, number, number],
};

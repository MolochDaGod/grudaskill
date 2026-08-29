import RAPIER from "@dimforge/rapier3d-compat";
import { bootRapier } from "./rapier-boot";
import type { FlyingSlash } from "./slash";

/** Rapier layer indices 0–15. Same packing as r3f `interactionGroups`. */
export const Layer = {
  GROUND: 0,
  PLAYER: 1,
  DUMMY: 2,
  PROJECTILE: 3,
  SLASH: 4,
  AOE: 5,
} as const;

function bits(layers: number[]) {
  return layers.reduce((acc, layer) => acc | (1 << layer), 0);
}

/** membership << 16 | filter — both colliders must pass for a pair to exist. */
export function groups(membership: number[], filter: number[]) {
  return (bits(membership) << 16) + bits(filter);
}

export const GROUPS = {
  ground: groups([Layer.GROUND], [Layer.PLAYER, Layer.DUMMY]),
  player: groups([Layer.PLAYER], [Layer.GROUND, Layer.DUMMY]),
  dummy: groups(
    [Layer.DUMMY],
    [Layer.GROUND, Layer.PLAYER, Layer.PROJECTILE, Layer.SLASH, Layer.AOE],
  ),
  projectile: groups([Layer.PROJECTILE], [Layer.DUMMY, Layer.SLASH, Layer.PROJECTILE, Layer.AOE]),
  slash: groups([Layer.SLASH], [Layer.DUMMY, Layer.SLASH, Layer.PROJECTILE]),
  aoe: groups([Layer.AOE], [Layer.DUMMY, Layer.PROJECTILE]),
};

/** Solver groups: physical push only. Hit volumes have empty filters (sensors). */
export const SOLVER = {
  solid: groups([Layer.GROUND, Layer.PLAYER, Layer.DUMMY], [Layer.GROUND, Layer.PLAYER, Layer.DUMMY]),
  ghost: groups([Layer.PROJECTILE, Layer.SLASH, Layer.AOE], []),
};

const HIT_TYPES = RAPIER.ActiveCollisionTypes.ALL;

function collide(desc: RAPIER.ColliderDesc, collision: number, solver: number, hits = false) {
  desc.setCollisionGroups(collision);
  desc.setSolverGroups(solver);
  if (hits) desc.setActiveCollisionTypes(HIT_TYPES);
  return desc;
}

export type DummyBody = {
  collider: RAPIER.Collider;
  index: number;
};

type ShotBody = {
  rb: RAPIER.RigidBody;
  col: RAPIER.Collider;
};

export type Overlap = { kind: "dummy" | "slash" | "shot"; index: number };

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
  private tags = new Map<number, Overlap>();

  async init(existing?: RAPIER.World) {
    if (existing) {
      this.attachWorld(existing);
      return;
    }
    if (this.ready && this.world) return;
    await bootRapier();
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
    this.tags.clear();
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
        collide(RAPIER.ColliderDesc.capsule(0.45, 0.42).setTranslation(0, 0, 0), GROUPS.player, SOLVER.solid),
        this.playerBody,
      );
    }
    if (!this.groundCol) {
      this.groundCol = this.world.createCollider(
        collide(RAPIER.ColliderDesc.cuboid(22, 0.5, 22).setTranslation(0, -0.5, 0), GROUPS.ground, SOLVER.solid),
      );
    }
  }

  resetDummies() {
    if (!this.world) return;
    for (const d of this.dummies) {
      this.tags.delete(d.collider.handle);
      this.world.removeCollider(d.collider, true);
    }
    this.dummies = [];
  }

  addDummy(index: number, x: number, z: number) {
    if (!this.world) return;
    const existing = this.dummies.find((b) => b.index === index);
    if (existing) {
      existing.collider.setTranslation({ x, y: 0.9, z });
      return;
    }
    const desc = collide(
      RAPIER.ColliderDesc.capsule(0.45, 0.48).setTranslation(x, 0.9, z).setSensor(false),
      GROUPS.dummy,
      SOLVER.solid,
      true,
    );
    const col = this.world.createCollider(desc);
    this.tags.set(col.handle, { kind: "dummy", index });
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
    this.controller.computeColliderMovement(
      this.playerCol,
      { x: dx, y: 0, z: dz },
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      GROUPS.player,
    );
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
      collide(
        RAPIER.ColliderDesc.cuboid(slash.half.x, slash.half.y, slash.half.z).setSensor(true),
        GROUPS.slash,
        SOLVER.ghost,
        true,
      ),
      rb,
    );
    this.tags.set(col.handle, { kind: "slash", index: slash.slot });
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
    this.tags.delete(body.col.handle);
    this.world.removeCollider(body.col, true);
    this.world.removeRigidBody(body.rb);
    slash.body = null;
  }

  /** Dummy indices only — kept for older call sites. */
  hits(slash: FlyingSlash): number[] {
    return this.overlaps(slash).filter((h) => h.kind === "dummy").map((h) => h.index);
  }

  overlaps(slash: FlyingSlash): Overlap[] {
    if (!this.world || !slash.body) return [];
    return this.pairs((slash.body as { col: RAPIER.Collider }).col);
  }

  shotOverlaps(index: number): Overlap[] {
    const s = this.shots[index];
    if (!this.world || !s) return [];
    return this.pairs(s.col);
  }

  private pairs(col: RAPIER.Collider): Overlap[] {
    const out: Overlap[] = [];
    const seen = new Set<string>();
    this.world?.intersectionPairsWith(col, (other) => {
      const tag = this.tags.get(other.handle);
      if (!tag) return;
      const key = `${tag.kind}:${tag.index}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(tag);
    });
    return out;
  }

  attachShot(index: number, x: number, y: number, z: number, radius: number) {
    if (!this.world) return;
    this.releaseShot(index);
    const rb = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z).setCcdEnabled(true),
    );
    const col = this.world.createCollider(
      collide(RAPIER.ColliderDesc.ball(radius).setSensor(true), GROUPS.projectile, SOLVER.ghost, true),
      rb,
    );
    this.shots[index] = { rb, col };
    this.tags.set(col.handle, { kind: "shot", index });
  }

  syncShot(index: number, x: number, y: number, z: number) {
    const s = this.shots[index];
    if (!s) return;
    s.rb.setNextKinematicTranslation({ x, y, z });
  }

  shotHits(index: number, ignore: Set<number>): number[] {
    return this.shotOverlaps(index)
      .filter((h) => h.kind === "dummy" && !ignore.has(h.index))
      .map((h) => h.index);
  }

  releaseShot(index: number) {
    if (!this.world) return;
    const s = this.shots[index];
    if (!s) return;
    this.tags.delete(s.col.handle);
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

  dispose() {
    if (!this.world) {
      this.ready = false;
      return;
    }
    this.resetDummies();
    for (let i = 0; i < this.shots.length; i++) this.releaseShot(i);
    this.tags.clear();
    if (this.ownsWorld) {
      this.world.free();
    } else {
      if (this.playerBody) this.world.removeRigidBody(this.playerBody);
      if (this.groundCol) this.world.removeCollider(this.groundCol, true);
      this.controller?.free();
    }
    this.world = null;
    this.playerBody = null;
    this.playerCol = null;
    this.controller = null;
    this.groundCol = null;
    this.ownsWorld = false;
    this.ready = false;
  }
}

/** @react-three/rapier collider args — keep in lockstep with LabPhysics. */
export const R3F_SHAPES = {
  dummyCapsule: [0.45, 0.48] as [number, number],
  playerCapsule: [0.45, 0.42] as [number, number],
  slashCuboid: (hx: number, hy: number, hz: number) => [hx, hy, hz] as [number, number, number],
  ground: [22, 0.5, 22] as [number, number, number],
  collision: GROUPS,
  solver: SOLVER,
};

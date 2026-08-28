import * as THREE from "three";
import type { SkillDef } from "./skills";
import { SparkPool } from "./sparks";

type RitualKind = "pyre" | "kraken" | "orb" | "spire" | "gate" | "ring" | "scribe";

type ActiveRitual = {
  kind: RitualKind;
  skill: SkillDef;
  group: THREE.Group;
  age: number;
  life: number;
  origin: THREE.Vector3;
  dir: THREE.Vector3;
  parts: THREE.Object3D[];
  persistent: boolean;
};

const _v = new THREE.Vector3();

function addMat(color: number, opts: THREE.MeshBasicMaterialParameters = {}) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    ...opts,
  });
}

export class RitualDirector {
  private scene: THREE.Scene;
  private sparks: SparkPool;
  private active: ActiveRitual[] = [];
  private portals = new Map<string, ActiveRitual>();
  private auras = new Map<string, THREE.Group>();
  private player: THREE.Object3D;

  constructor(scene: THREE.Scene, sparks: SparkPool, player: THREE.Object3D) {
    this.scene = scene;
    this.sparks = sparks;
    this.player = player;
  }

  cast(skill: SkillDef, aim: THREE.Vector3, from: THREE.Vector3, yaw: number) {
    const id = skill.id;
    if (id === "pyre_crown") this.spawnPyre(skill, aim);
    else if (id === "kraken_crown") this.spawnKraken(skill, aim);
    else if (id === "electrical_sphere") this.spawnOrb(skill, aim);
    else if (id === "earthen_spire") this.spawnSpire(skill, from, aim);
    else if (id === "verdant_gate") this.spawnGate(skill, aim, yaw);
    else if (id === "tidewrought_ring") this.spawnRing(skill, aim, yaw);
    else if (id === "fire_portal") this.spawnScribe(skill, aim);
    else if (skill.kind === "nova") this.spawnPyre(skill, aim);
  }

  setAura(name: string, color: number, on: boolean) {
    const old = this.auras.get(name);
    if (old) {
      this.player.remove(old);
      this.auras.delete(name);
    }
    if (!on) return;
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 8, 32), addMat(color, { opacity: 0.85 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08;
    g.add(ring);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), addMat(color, { opacity: 0.18 }));
    halo.position.y = 1.1;
    g.add(halo);
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), addMat(color, { opacity: 0.95 }));
      p.userData.i = i;
      g.add(p);
    }
    this.player.add(g);
    this.auras.set(name, g);
  }

  update(dt: number) {
    for (const [, aura] of this.auras) {
      aura.rotation.y += dt * 1.6;
      aura.children.forEach((c) => {
        if (c.userData.i == null) return;
        const i = c.userData.i as number;
        const a = aura.rotation.y * 2 + i * ((Math.PI * 2) / 6);
        c.position.set(Math.cos(a) * 0.7, 1.1 + Math.sin(a * 2) * 0.2, Math.sin(a) * 0.7);
      });
    }
    for (let i = this.active.length - 1; i >= 0; i--) {
      const r = this.active[i]!;
      r.age += dt;
      const t = r.life > 0 ? Math.min(1, r.age / r.life) : 0;
      this.tick(r, dt, t);
      if (!r.persistent && r.age >= r.life) {
        this.scene.remove(r.group);
        this.active.splice(i, 1);
      }
    }
  }

  hitsAt(pos: THREE.Vector3, radius: number): boolean {
    for (const r of this.active) {
      if (r.origin.distanceTo(pos) < radius + (r.skill.radius || 2.4)) return true;
    }
    return false;
  }

  private push(r: ActiveRitual) {
    this.scene.add(r.group);
    this.active.push(r);
  }

  private replacePortal(key: string, next: ActiveRitual) {
    const prev = this.portals.get(key);
    if (prev) {
      this.scene.remove(prev.group);
      this.active = this.active.filter((a) => a !== prev);
    }
    this.portals.set(key, next);
    this.push(next);
  }

  private spawnPyre(skill: SkillDef, aim: THREE.Vector3) {
    const g = new THREE.Group();
    g.position.copy(aim).setY(0.02);
    const r = skill.radius || 3.2;
    const molten = new THREE.Mesh(new THREE.CircleGeometry(r * 0.92, 32), addMat(0xff3b0e, { opacity: 0.7 }));
    molten.rotation.x = -Math.PI / 2;
    g.add(molten);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.88, 0.08, 8, 40), addMat(0xffc14a, { opacity: 0.95 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.06;
    g.add(rim);
    const blades: THREE.Mesh[] = [];
    for (let i = 0; i < 14; i++) {
      const h = 1.1 + (i % 5) * 0.45 + (i % 3) * 0.2;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, h, 0.04), addMat(0xff6a2a, { opacity: 0.95 }));
      const a = (i / 14) * Math.PI * 2;
      blade.position.set(Math.cos(a) * r * 0.72, 0, Math.sin(a) * r * 0.72);
      blade.lookAt(0, 2.4, 0);
      blade.rotateX(0.35);
      blade.userData.h = h;
      blades.push(blade);
      g.add(blade);
    }
    this.sparks.burst(aim.clone().setY(0.4), skill.color, 40, 5, 3);
    this.push({
      kind: "pyre",
      skill,
      group: g,
      age: 0,
      life: 3.6,
      origin: aim.clone(),
      dir: new THREE.Vector3(),
      parts: [molten, rim, ...blades],
      persistent: false,
    });
  }

  private spawnKraken(skill: SkillDef, aim: THREE.Vector3) {
    const g = new THREE.Group();
    g.position.copy(aim).setY(0.02);
    const r = skill.radius || 3.4;
    const water = new THREE.Mesh(new THREE.CircleGeometry(r, 32), addMat(0x0b1c33, { opacity: 0.85, blending: THREE.NormalBlending, depthWrite: true }));
    water.rotation.x = -Math.PI / 2;
    g.add(water);
    const rift = new THREE.Mesh(new THREE.CircleGeometry(r * 0.35, 24), addMat(0x1ee0c8, { opacity: 0.55 }));
    rift.rotation.x = -Math.PI / 2;
    rift.position.y = 0.04;
    g.add(rift);
    const arms: THREE.Group[] = [];
    for (let i = 0; i < 8; i++) {
      const arm = new THREE.Group();
      const a = (i / 8) * Math.PI * 2;
      arm.position.set(Math.cos(a) * r * 0.82, 0.05, Math.sin(a) * r * 0.82);
      arm.userData.a = a;
      for (let s = 0; s < 7; s++) {
        const seg = new THREE.Mesh(
          new THREE.SphereGeometry(0.16 - s * 0.015, 8, 6),
          new THREE.MeshStandardMaterial({
            color: 0x1a3344,
            emissive: 0x0a6b6b,
            emissiveIntensity: 0.35,
            roughness: 0.35,
            metalness: 0.2,
          }),
        );
        arm.add(seg);
      }
      arms.push(arm);
      g.add(arm);
    }
    this.sparks.burst(aim.clone().setY(0.3), "#1ee0c8", 28, 3, 1.4);
    this.push({
      kind: "kraken",
      skill,
      group: g,
      age: 0,
      life: 4.2,
      origin: aim.clone(),
      dir: new THREE.Vector3(),
      parts: arms,
      persistent: false,
    });
  }

  private spawnOrb(skill: SkillDef, aim: THREE.Vector3) {
    const g = new THREE.Group();
    g.position.copy(aim).setY(0);
    const r = skill.radius || 2.2;
    const pad = new THREE.Mesh(new THREE.CircleGeometry(r * 0.7, 28), addMat(0x7ee8ff, { opacity: 0.35 }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.03;
    g.add(pad);
    const rings = new THREE.Mesh(new THREE.TorusGeometry(r * 0.55, 0.05, 8, 32), addMat(0xb8f0ff, { opacity: 0.8 }));
    rings.rotation.x = Math.PI / 2;
    rings.position.y = 0.06;
    g.add(rings);
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 32, 24),
      new THREE.MeshStandardMaterial({
        color: 0x05070c,
        metalness: 0.95,
        roughness: 0.12,
        emissive: 0x113344,
        emissiveIntensity: 0.6,
      }),
    );
    orb.position.y = 1.15;
    g.add(orb);
    const arcs: THREE.Line[] = [];
    for (let i = 0; i < 10; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12), 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x9ef6ff, transparent: true, opacity: 0.9 }));
      g.add(line);
      arcs.push(line);
    }
    const light = new THREE.PointLight(0x7ee8ff, 4, 8);
    light.position.y = 1.2;
    g.add(light);
    this.sparks.burst(aim.clone().setY(1.1), "#7ee8ff", 36, 6, 2);
    this.push({
      kind: "orb",
      skill,
      group: g,
      age: 0,
      life: 3.8,
      origin: aim.clone(),
      dir: new THREE.Vector3(),
      parts: [orb, ...arcs, rings],
      persistent: false,
    });
  }

  private spawnSpire(skill: SkillDef, from: THREE.Vector3, aim: THREE.Vector3) {
    const g = new THREE.Group();
    const dir = aim.clone().sub(from);
    dir.y = 0;
    const len = Math.max(4, Math.min(dir.length(), 14));
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
    dir.normalize();
    const stones: THREE.Mesh[] = [];
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      const p = from.clone().addScaledVector(dir, (i + 1) * (len / steps));
      const stone = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.18, 0.9),
        new THREE.MeshStandardMaterial({ color: 0x6b5a48, roughness: 0.9 }),
      );
      stone.position.copy(p).setY(0.1);
      stone.lookAt(p.clone().add(dir));
      stones.push(stone);
      g.add(stone);
    }
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.55, 2.6, 8),
      new THREE.MeshStandardMaterial({ color: 0x7a6a55, roughness: 0.85 }),
    );
    tower.position.copy(from).addScaledVector(dir, len).setY(1.3);
    g.add(tower);
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22), new THREE.MeshStandardMaterial({ color: 0x8a7864 }));
      const a = (i / 6) * Math.PI * 2;
      b.position.copy(tower.position);
      b.position.x += Math.cos(a) * 0.85;
      b.position.z += Math.sin(a) * 0.85;
      b.position.y = 0.28;
      g.add(b);
    }
    this.sparks.burst(tower.position, "#d7c4a3", 22, 3, 2);
    this.push({
      kind: "spire",
      skill,
      group: g,
      age: 0,
      life: 4.5,
      origin: tower.position.clone(),
      dir,
      parts: stones,
      persistent: false,
    });
  }

  private spawnGate(skill: SkillDef, aim: THREE.Vector3, yaw: number) {
    const g = new THREE.Group();
    g.position.copy(aim).setY(0);
    g.rotation.y = yaw;
    const stone = new THREE.MeshStandardMaterial({ color: 0x4a5c3a, roughness: 0.8 });
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.38, 2.4, 0.38), stone);
    l.position.set(-1.05, 1.2, 0);
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.38, 2.4, 0.38), stone);
    r.position.set(1.05, 1.2, 0);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.32, 0.4), stone);
    cap.position.set(0, 2.45, 0);
    const key = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.42), stone);
    key.position.set(0, 2.7, 0);
    const portal = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.2), addMat(0x86efac, { opacity: 0.55 }));
    portal.position.set(0, 1.2, 0);
    g.add(l, r, cap, key, portal);
    this.replacePortal("gate", {
      kind: "gate",
      skill,
      group: g,
      age: 0,
      life: 999,
      origin: aim.clone(),
      dir: new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)),
      parts: [portal, l, r, cap, key],
      persistent: true,
    });
    this.sparks.burst(aim.clone().setY(1.2), "#86efac", 30, 4, 2);
  }

  private spawnRing(skill: SkillDef, aim: THREE.Vector3, yaw: number) {
    const g = new THREE.Group();
    g.position.copy(aim).setY(0.02);
    g.rotation.y = yaw;
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.08, 10, 48), addMat(0x7ee8ff, { opacity: 0.95 }));
    hoop.rotation.x = Math.PI / 2.4;
    hoop.position.y = 1.15;
    const eye = new THREE.Mesh(new THREE.CircleGeometry(1.18, 40), addMat(0x134e4a, { opacity: 0.85, blending: THREE.NormalBlending, depthWrite: true }));
    eye.position.y = 1.15;
    eye.rotation.x = -0.25;
    g.add(hoop, eye);
    this.replacePortal("ring", {
      kind: "ring",
      skill,
      group: g,
      age: 0,
      life: 999,
      origin: aim.clone(),
      dir: new THREE.Vector3(),
      parts: [hoop, eye],
      persistent: true,
    });
    this.sparks.burst(aim.clone().setY(1.1), "#7ee8ff", 26, 4, 1.5);
  }

  private spawnScribe(skill: SkillDef, aim: THREE.Vector3) {
    const g = new THREE.Group();
    g.position.copy(aim).setY(Math.max(1.15, aim.y));
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.05, 40),
      new THREE.MeshBasicMaterial({ color: 0x050505, side: THREE.DoubleSide }),
    );
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.045, 8, 48), addMat(0xff6a2a, { opacity: 1 }));
    g.add(disc, rim);
    this.replacePortal("scribe", {
      kind: "scribe",
      skill,
      group: g,
      age: 0,
      life: 999,
      origin: g.position.clone(),
      dir: new THREE.Vector3(),
      parts: [disc, rim],
      persistent: true,
    });
    this.sparks.burst(g.position, "#ff6a2a", 34, 5, 1);
  }

  private tick(r: ActiveRitual, dt: number, t: number) {
    if (r.kind === "pyre") {
      const rise = Math.min(1, r.age / 0.45);
      const consume = t > 0.62 ? (t - 0.62) / 0.38 : 0;
      for (const p of r.parts) {
        if (p.userData.h) {
          p.scale.y = rise * (1 - consume);
          p.position.y = ((p.userData.h as number) * p.scale.y) / 2;
        }
      }
      const molten = r.parts[0] as THREE.Mesh;
      (molten.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - consume);
    } else if (r.kind === "kraken") {
      const hammer = 0.5 + 0.5 * Math.sin(r.age * 6);
      for (const arm of r.parts as THREE.Group[]) {
        const a = arm.userData.a as number;
        arm.children.forEach((seg, s) => {
          const u = (s + 1) / 7;
          const curl = (1 - Math.min(1, r.age / 0.6)) * 1.4;
          const inward = hammer * u;
          seg.position.set(
            Math.cos(a) * (-0.1 - u * 0.15) * (1 - inward),
            0.25 + Math.sin(u * Math.PI) * (1.35 - inward * 1.1) + Math.sin(r.age * 8 + s) * 0.04,
            Math.sin(a) * (-0.1 - u * 0.15) * (1 - inward),
          );
          _v.set(-Math.cos(a) * curl, 0.2, -Math.sin(a) * curl);
          void dt;
        });
      }
      if (Math.sin(r.age * 6) > 0.92) this.sparks.burst(r.origin.clone().setY(0.3), "#1ee0c8", 8, 2, 0.6);
    } else if (r.kind === "orb") {
      const orb = r.parts[0] as THREE.Mesh;
      orb.position.y = 0.7 + Math.min(1, r.age / 0.5) * 0.55 + Math.sin(r.age * 3) * 0.06;
      orb.rotation.y += dt * 1.4;
      const collapse = t > 0.78 ? 1 - (t - 0.78) / 0.22 : 1;
      orb.scale.setScalar(Math.max(0.05, collapse));
      for (let i = 1; i < r.parts.length - 1; i++) {
        const line = r.parts[i] as THREE.Line;
        const pos = line.geometry.getAttribute("position") as THREE.BufferAttribute;
        const seed = r.age * 13 + i * 17;
        let px = orb.position.x;
        let py = orb.position.y;
        let pz = orb.position.z;
        for (let k = 0; k < 4; k++) {
          pos.setXYZ(k, px, py, pz);
          px += Math.sin(seed + k * 2.1) * 0.55;
          py += (Math.random() - 0.4) * 0.4;
          pz += Math.cos(seed + k * 1.7) * 0.55;
        }
        pos.needsUpdate = true;
      }
    } else if (r.kind === "spire") {
      r.parts.forEach((s, i) => {
        s.visible = r.age > i * 0.08;
      });
    } else if (r.kind === "gate" || r.kind === "ring" || r.kind === "scribe") {
      const pulse = 0.7 + 0.3 * Math.sin(r.age * 3.2);
      const mat = (r.parts[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
      if (mat.opacity != null && mat.transparent) mat.opacity = 0.4 + 0.25 * pulse;
      r.parts[0].rotation.z += dt * (r.kind === "scribe" ? 1.2 : 0.35);
    }
  }
}

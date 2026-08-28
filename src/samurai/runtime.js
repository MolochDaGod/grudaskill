// @ts-nocheck
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from "three";
import { enableMainCameraLayers } from "./core/Layers.js";
import { frame } from "./core/FrameUniforms.js";
import { settings } from "./config/settings.js";
import { ShadowCharacter } from "./vfx/ShadowCharacter.js";
import { BladeStorm } from "./vfx/BladeStorm.js";
import { Judgement } from "./vfx/Judgement.js";

const _dir = new Vector3();

function wrapDummy(dummy) {
  return {
    _dummy: dummy,
    get alive() {
      return dummy.hp > 0;
    },
    get position() {
      return dummy.group.position;
    },
  };
}

function proceduralSword() {
  const g = new Group();
  g.name = "ProceduralKatana";
  const steel = new MeshStandardMaterial({
    color: 0xc9d4e4,
    metalness: 0.92,
    roughness: 0.18,
    emissive: 0x1a2a44,
    emissiveIntensity: 0.25,
  });
  const wrap = new MeshStandardMaterial({
    color: 0x1a1410,
    metalness: 0.08,
    roughness: 0.7,
  });
  const blade = new Mesh(new BoxGeometry(0.045, 0.045, 1.05), steel);
  blade.position.z = 0.58;
  const guard = new Mesh(new BoxGeometry(0.22, 0.04, 0.04), steel);
  guard.position.z = 0.06;
  const grip = new Mesh(new CylinderGeometry(0.028, 0.032, 0.28, 8), wrap);
  grip.rotation.x = Math.PI / 2;
  grip.position.z = -0.1;
  g.add(blade, guard, grip);
  return g;
}

/**
 * Original samurai GitHub VFX — shadow clones, orbiting blades, judgement fist.
 * Adapts Grudge6 toon + lab dummies to the kit's character / enemy contracts.
 */
export class SamuraiRuntime {
  constructor(scene, camera, renderer, player) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.player = player;
    this.toon = null;
    this.elapsed = 0;
    this._launchIn = 0;
    this.loader = new GLTFLoader();
    enableMainCameraLayers(camera);

    this.character = {
      model: null,
      clips: new Map(),
      position: player.position,
      facing: 0,
      height: 1.78,
      forwardAxis: new Vector3(0, 0, 1),
    };
    this.enemyBag = { enemies: [] };
    this._wraps = new WeakMap();

    this.swordSlot = { model: proceduralSword(), placement: { scale: 1 } };

    const onStrike = (enemy, dx, dz, force) => {
      const dummy = enemy?._dummy;
      if (!dummy) return;
      const impulse = typeof force === "object" ? (force.impulse ?? force.force ?? 16) : 16;
      dummy.hp -= 18 + impulse * 0.4;
      dummy.vel.x += dx * (8 + impulse * 0.15);
      dummy.vel.z += dz * (8 + impulse * 0.15);
    };

    this.shadows = new ShadowCharacter(this.character, {
      terrain: null,
      enemies: this.enemyBag,
      onStrike,
    });
    this.blades = new BladeStorm({
      terrain: null,
      equipment: () => ({
        get: (id) => (id === "sword" ? this.swordSlot : null),
      }),
      onStrike,
    });
    this.judgement = new Judgement({
      terrain: null,
      enemies: this.enemyBag,
      onStrike,
    });

    scene.add(this.shadows.group);
    scene.add(this.blades.group);
    scene.add(this.judgement.group);

    this.ready = this._loadKit();
  }

  async _loadKit() {
    try {
      const gltf = await this.loader.loadAsync("/models/weapons/sword.glb");
      if (gltf?.scene) this.swordSlot.model = gltf.scene;
    } catch (err) {
      console.warn("[samurai] sword.glb missing — procedural katana", err);
    }
    try {
      await this.judgement.load({
        loadGLTF: (url) => this.loader.loadAsync(url),
        settled: () => Promise.resolve(),
      });
    } catch (err) {
      console.warn("[samurai] judgement fist failed to load", err);
    }
    return this;
  }

  bindToon(toon, clips) {
    this.toon = toon;
    this.character.model = toon?.root ?? null;
    this.character.height = 1.78;
    if (clips) {
      const map = new Map();
      if (clips.idle) map.set("crouch", clips.idle);
      if (clips.run) map.set("run", clips.run);
      else if (clips.walk) map.set("run", clips.walk);
      const strike = clips.attack ?? clips.cast ?? clips.idle;
      if (strike) {
        map.set("kick", strike);
        map.set("slashHit", strike);
        map.set("crouchSlash", strike);
      }
      this.character.clips = map;
    }
  }

  syncDummies(dummies) {
    const bag = this.enemyBag.enemies;
    bag.length = 0;
    for (const d of dummies) {
      let wrap = this._wraps.get(d);
      if (!wrap) {
        wrap = wrapDummy(d);
        this._wraps.set(d, wrap);
      }
      bag.push(wrap);
    }
  }

  nearest(from) {
    let best = null;
    let bestD = Infinity;
    for (const e of this.enemyBag.enemies) {
      if (!e.alive) continue;
      const dx = e.position.x - from.x;
      const dz = e.position.z - from.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  living() {
    return this.enemyBag.enemies.filter((e) => e.alive);
  }

  summonShadows(from) {
    const marks = this.living()
      .slice()
      .sort((a, b) => {
        const da = a.position.distanceToSquared(from);
        const db = b.position.distanceToSquared(from);
        return da - db;
      })
      .slice(0, 2);
    this.shadows.summon(marks);
    return marks.length;
  }

  forgeBlades(from) {
    const marks = this.living()
      .slice()
      .sort((a, b) => a.position.distanceToSquared(from) - b.position.distanceToSquared(from))
      .slice(0, Math.max(1, Math.round(settings.flight.blades.max ?? 6)));
    let n = 0;
    for (const m of marks) {
      if (this.blades.mark(m) === "forged") n += 1;
    }
    this._launchIn = 0.85;
    return n;
  }

  launchBlades() {
    this._launchIn = 0;
    return this.blades.launch();
  }

  dropJudgement(from) {
    const mark = this.nearest(from);
    if (!mark) return false;
    settings.judgement.enabled = true;
    return this.judgement.cast(mark);
  }

  update(dt, width, height, yaw = 0) {
    this.elapsed += dt;
    frame.uTime.value = this.elapsed;
    frame.uDelta.value = dt;
    frame.uResolution.value.set(width, height);
    frame.uCameraNear.value = this.camera.near;
    frame.uCameraFar.value = this.camera.far;

    this.character.position = this.player.position;
    this.character.facing = yaw + Math.PI;
    this.character.model = this.toon?.root ?? this.character.model;
    this.character.height = 1.78;

    if (this._launchIn > 0) {
      this._launchIn -= dt;
      if (this._launchIn <= 0) this.blades.launch();
    }

    this.shadows.update(dt);
    this.blades.update(dt, this.elapsed, this.player.position, this.character.height);
    this.judgement.update(dt, this.elapsed);
  }

  clear() {
    this.shadows.dismiss({ immediate: true });
    this.blades.dismiss({ immediate: true });
    this.judgement.dismiss({ immediate: true });
    this._launchIn = 0;
  }
}

export { settings };

// @ts-nocheck
import { enableMainCameraLayers } from "./core/Layers.js";
import { Vector3 } from "three";
import { AbilityManager } from "./abilities/AbilityManager.js";
import { AimController } from "./input/AimController.js";
import { ParticleEngine } from "./particles/ParticleEngine.js";
import { LightPool } from "./effects/LightPool.js";
import { DecalSystem } from "./effects/GroundDecals.js";
import { BurstSystem } from "./effects/BurstSphere.js";
import { CameraShake } from "./effects/CameraShake.js";
import { ScreenFlash } from "./effects/ScreenFlash.js";
import { ElectricBoost } from "./effects/ElectricBoost.js";
import { MagicBoost } from "./effects/MagicBoost.js";
import { FireBoost } from "./effects/FireBoost.js";
import { frame } from "./core/FrameUniforms.js";
import { patchOnBeforeCompile } from "./utils/shaderPatch.js";
import { ELEMENTS, ELEMENT_META, settings } from "./config/settings.js";

const KEY_TO_ELEMENT = {
  KeyQ: "pyre",
  KeyE: "kraken",
  KeyR: "electrical",
  KeyF: "earth",
  KeyV: "portal",
  KeyX: "aether",
  KeyZ: "firePortal",
};

const _boneA = new Vector3();
const _boneB = new Vector3();

/**
 * Host for LinearAbilityExtThreeJS — the real Pyre / Kraken / Orb / Spire /
 * portals / boosts, with their own arrow + circle aiming. Not a rewrite.
 */
export class ExtRuntime {
  constructor(scene, camera, renderer, player) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.player = player;
    this.toon = null;
    this.castOrigin = player.position;
    this.element = ELEMENTS[0];
    this.rig = { shakeOffset: new Vector3(), shakeRoll: 0 };
    enableMainCameraLayers(camera);

    this.environment = {
      scene,
      camera,
      renderer: { gl: renderer },
      registerShadowCaster: (m) => m,
      registerShadowCasterWithPatch(material, fn) {
        patchOnBeforeCompile(material, fn);
        return material;
      },
      setFocus() {},
      update() {},
    };

    this.particles = new ParticleEngine(scene);
    this.lights = new LightPool(scene);
    this.decals = new DecalSystem(scene);
    this.bursts = new BurstSystem(scene);
    this.shake = new CameraShake(this.rig);
    this.flash = new ScreenFlash();

    this.abilities = new AbilityManager({
      scene,
      camera,
      environment: this.environment,
      particles: this.particles,
      lights: this.lights,
      decals: this.decals,
      bursts: this.bursts,
      shake: this.shake,
      flash: this.flash,
    });

    this.character = {
      position: player.position,
      height: 1.78,
      facing: 0,
      playCast() {},
      castLunge() {},
      setFacing(yaw) {
        this.facing = yaw;
      },
      writeBoneSegments: (boneA, boneB) => this.writeBoneSegments(boneA, boneB),
    };

    const buffContext = {
      scene,
      particles: this.particles,
      lights: this.lights,
      decals: this.decals,
      bursts: this.bursts,
      shake: this.shake,
      flash: this.flash,
      character: this.character,
    };
    this.boost = new ElectricBoost(buffContext);
    this.magic = new MagicBoost(buffContext);
    this.fire = new FireBoost(buffContext);

    this.aim = new AimController(camera);
    scene.add(this.aim.object3D);
    this.aim.on("cast", (origin, direction, distance) => {
      this.abilities.cast(origin, direction, distance, this.element);
      this.aim.arm();
    });

    this.abilities.select(this.element);
    this.aim.setElement(this.element);
    this.aim.arm();
  }

  bindToon(toon) {
    this.toon = toon;
  }

  writeBoneSegments(boneA, boneB) {
    const root = this.toon?.root;
    if (!root || !boneA || !boneB) return 0;
    root.updateMatrixWorld(true);
    const names = [
      [["Bip001 Pelvis", "Bip001_Pelvis"], ["Bip001 Spine", "Bip001_Spine"]],
      [["Bip001 Spine", "Bip001_Spine"], ["Bip001 Head", "Bip001_Head"]],
      [["Bip001 L UpperArm", "Bip001_L_UpperArm"], ["Bip001 L Hand", "Bip001_L_Hand"]],
      [["Bip001 R UpperArm", "Bip001_R_UpperArm"], ["Bip001 R Hand", "Bip001_R_Hand"]],
      [["Bip001 L Thigh", "Bip001_L_Thigh"], ["Bip001 L Foot", "Bip001_L_Foot"]],
      [["Bip001 R Thigh", "Bip001_R_Thigh"], ["Bip001 R Foot", "Bip001_R_Foot"]],
    ];
    let n = 0;
    for (const [aNames, bNames] of names) {
      if (n >= boneA.length) break;
      const ao = aNames.map((nm) => root.getObjectByName(nm)).find(Boolean);
      const bo = bNames.map((nm) => root.getObjectByName(nm)).find(Boolean);
      if (!ao || !bo) continue;
      ao.getWorldPosition(_boneA);
      bo.getWorldPosition(_boneB);
      if (!Number.isFinite(_boneA.x + _boneB.x)) continue;
      boneA[n].set(_boneA.x, _boneA.y, _boneA.z, _boneA.y > 1.25 ? 0.09 : 0.12);
      boneB[n].set(_boneB.x, _boneB.y, _boneB.z, 0);
      n += 1;
    }
    return n;
  }

  keyToElement(code) {
    return KEY_TO_ELEMENT[code] ?? null;
  }

  armAbility(element) {
    if (!ELEMENTS.includes(element)) return;
    this.element = element;
    this.abilities.select(element);
    this.aim.setElement(element);
    this.aim.arm();
  }

  point(ndc) {
    this.aim.point(ndc);
  }

  confirm() {
    if (!this.aim.isArmed) this.aim.arm();
    this.aim.setOrigin(this.player.position);
    this.aim.update(0);
    return this.aim.confirm();
  }

  setCastOrigin(pos) {
    this.castOrigin = pos;
    this.aim.setOrigin(pos);
  }

  toggleBoost() {
    this._toggle(this.boost);
  }
  toggleMagic() {
    this._toggle(this.magic);
  }
  toggleFire() {
    this._toggle(this.fire);
  }

  _toggle(buff) {
    if (buff.active) buff.cancel();
    else buff.activate();
  }

  update(dt, width, height) {
    frame.uTime.value += dt;
    frame.uDelta.value = dt;
    frame.uResolution.value.set(width, height);
    frame.uCameraNear.value = this.camera.near;
    frame.uCameraFar.value = this.camera.far;

    this.character.position = this.player.position;
    this.character.facing = this.player.rotation?.y ?? 0;
    this.character.height = 1.78;
    this.aim.setOrigin(this.castOrigin ?? this.player.position);
    this.aim.update(dt);
    this.abilities.update(dt);
    this.boost.update(dt);
    this.magic.update(dt);
    this.fire.update(dt);
    this.particles.flush();
    this.decals.update(dt);
    this.bursts.update(dt);
    this.lights.update(dt);
    this.shake.update(dt);
    this.flash.update(dt);
  }

  clear() {
    this.aim.cancel();
    this.abilities.clear();
    this.boost.cancel();
    this.magic.cancel();
    this.fire.cancel();
    this.particles.reset();
    this.decals.clear();
    this.bursts.clear();
    this.lights.reset();
    this.shake.reset();
    this.flash.reset();
    this.aim.arm();
  }

  label() {
    return ELEMENT_META[this.element]?.label ?? this.element;
  }
}

export { ELEMENTS, ELEMENT_META, KEY_TO_ELEMENT, settings };
export { DecalType } from "./effects/GroundDecals.js";

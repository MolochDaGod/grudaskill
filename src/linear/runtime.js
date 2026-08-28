// @ts-nocheck
import { enableMainCameraLayers } from "./core/Layers.js";
import { Vector3 } from "three";
import { AbilityManager } from "./abilities/AbilityManager.js";
import { AimController } from "./input/AimController.js";
import { ParticleEngine } from "./particles/ParticleEngine.js";
import { LightPool } from "./effects/LightPool.js";
import { DecalSystem } from "./effects/GroundDecals.js";
import { FissureSystem } from "./effects/GroundFissures.js";
import { BurstSystem } from "./effects/BurstSphere.js";
import { CameraShake } from "./effects/CameraShake.js";
import { ScreenFlash } from "./effects/ScreenFlash.js";
import { frame } from "./core/FrameUniforms.js";
import { patchOnBeforeCompile } from "./utils/shaderPatch.js";
import { ELEMENTS, ELEMENT_META, settings } from "./config/settings.js";

const KEY_TO_ELEMENT = {
  KeyQ: "ice",
  KeyE: "thunder",
  KeyN: "meteor",
  KeyY: "beam",
  KeyI: "snare",
  KeyJ: "glacier",
};

/**
 * Host for LinearAbiltyCastingThreeJS — Frost Lance, Storm Lance, Cinder Fall,
 * Nova Beam, Voltaic Snare, Glacial Crown. Linear arrow + far-cast circle.
 * Original GLSL, not a rewrite.
 */
export class LinearCastRuntime {
  constructor(scene, camera, renderer, player) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.player = player;
    this.element = ELEMENTS[0];
    this.castOrigin = player.position;
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
    this.fissures = new FissureSystem(scene);
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
      fissures: this.fissures,
      bursts: this.bursts,
      shake: this.shake,
      flash: this.flash,
    });

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

  update(dt, width, height) {
    frame.uTime.value += dt;
    frame.uDelta.value = dt;
    frame.uResolution.value.set(width, height);
    frame.uCameraNear.value = this.camera.near;
    frame.uCameraFar.value = this.camera.far;
    this.aim.setOrigin(this.castOrigin ?? this.player.position);
    this.aim.update(dt);
    this.abilities.update(dt);
    this.particles.flush();
    this.decals.update(dt);
    this.fissures.update(dt);
    this.bursts.update(dt);
    this.lights.update(dt);
    this.shake.update(dt);
    this.flash.update(dt);
  }

  clear() {
    this.aim.cancel();
    this.abilities.clear();
    this.particles.reset();
    this.decals.clear();
    this.fissures.clear();
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

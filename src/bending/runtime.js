// @ts-nocheck
import { CatmullRomCurve3, Vector3 } from "three";
import { AbilityManager } from "./abilities/AbilityManager.js";
import { ParticleEngine } from "./particles/ParticleEngine.js";
import { LightPool } from "./effects/LightPool.js";
import { DecalSystem } from "./effects/GroundDecals.js";
import { BurstSystem } from "./effects/BurstSphere.js";
import { CameraShake } from "./effects/CameraShake.js";
import { ScreenFlash } from "./effects/ScreenFlash.js";
import { frame } from "./core/FrameUniforms.js";
import { patchOnBeforeCompile } from "./utils/shaderPatch.js";
import { enableMainCameraLayers } from "./core/Layers.js";
import { ELEMENTS } from "./config/settings.js";
import { LinearAim } from "./LinearAim.js";

const ELEMENT_BY_DIGIT = ["fire", "water", "earth", "wind"];

/**
 * AvatarCastingAbilitiesThreeJS fire/water/earth/air, aimed LinearAbility-style:
 * ground arrow + far-cast circle. Click sends the volume down that line.
 */
export class BendingRuntime {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.element = ELEMENTS[0];
    this.rig = { shakeOffset: new Vector3(), shakeRoll: 0 };
    enableMainCameraLayers(camera);

    this.environment = {
      scene,
      camera,
      renderer: { gl: renderer },
      registerShadowCasterWithPatch(material, fn) {
        patchOnBeforeCompile(material, fn);
      },
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

    this.aim = new LinearAim();
    this.aim.setElement(this.element);
    scene.add(this.aim.group);
  }

  select(element) {
    if (!ELEMENT_BY_DIGIT.includes(element) && !ELEMENTS.includes(element)) return;
    this.element = element;
    this.abilities.select(element);
    this.aim.setElement(element);
  }

  selectIndex(i) {
    const el = ELEMENT_BY_DIGIT[i];
    if (el) this.select(el);
  }

  setAim(origin, target, dt) {
    this.aim.set(origin, target, dt);
  }

  /** Straight ground path from caster to the circle. Real GLSL travels it. */
  castLinear() {
    const pts = this.aim.linePoints();
    if (pts[0].distanceTo(pts[3]) < 4) return false;
    const curve = new CatmullRomCurve3(pts, false, "catmullrom", 0);
    curve.arcLengthDivisions = 64;
    this.abilities.select(this.element);
    this.abilities.cast(curve, this.element);
    return true;
  }

  update(dt, width, height) {
    frame.uTime.value += dt;
    frame.uDelta.value = dt;
    frame.uResolution.value.set(width, height);
    frame.uCameraNear.value = this.camera.near;
    frame.uCameraFar.value = this.camera.far;
    this.abilities.update(dt);
    this.particles.flush();
    this.decals.update(dt);
    this.bursts.update(dt);
    this.lights.update(dt);
    this.shake.update(dt);
    this.flash.update(dt);
  }

  clear() {
    this.abilities.clear();
    this.particles.reset();
    this.decals.clear();
    this.bursts.clear();
    this.lights.reset();
    this.shake.reset();
    this.flash.reset();
  }
}

export { ELEMENTS, ELEMENT_BY_DIGIT };

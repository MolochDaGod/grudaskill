import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  type SkillDef,
  type ProjectileAsset,
  type AimMode,
  type PathKind,
  AIM_MODES,
  loadSkills,
  saveSkillState,
  skillById,
  keyLabel,
  defaultCustomSkill,
  isPlayKey,
  isWeaponKey,
  WEAPON_KEYS,
  CLASS_KEYS,
  isFarAoe,
} from "./skills";
import { loadFleet, MODEL_URLS, SKILL_VFX, type VfxEntry } from "./fleet";
import { SparkPool } from "./sparks";
import { SpriteActor, WARLORD_KITS, DUMMY_KITS } from "./sprite-actor";
import {
  GRUDGE6_RACES,
  raceGlbUrl,
  dressToon,
  preparePlayKit,
  loadBip001Packs,
  tickMixer,
  findEquippedWeapon,
  weaponMuzzleWorld,
  type ToonRig,
} from "./grudge6";
import { makeForwardMesh, orientForward } from "./orient";
import { dummyCapsule, shotRadius, sphereHitsCapsule, sweptSphereHitsCapsule } from "./collide";
import {
  createSlashPool,
  isFlyingSlash,
  meleeReach,
  offsetSlashDir,
  orientSlash,
  restyleSlash,
  slashLaunch,
  tickSlash,
  weaponSwingProfile,
  type FlyingSlash,
} from "./slash";
import { LabPhysics } from "./physics";
import { RitualDirector } from "./rituals";
import { CameraFeel } from "./camera-feel";
import { pollPad, rumble, type PadFrame } from "./pad";
import type { KitMode } from "./lab-types";
import type { HudState } from "./lab-types";
export type { HudState, KitMode } from "./lab-types";
import { WeatherSystem, type WeatherId } from "./weather";
import { GrassField } from "./grass";

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys?: (codes: string[]) => void;
    };
  }
}

const DecalType = { SCORCH: 0, RIPPLE: 1, CRACK: 2, SHOCKWAVE: 3, DUSTRING: 4, FOAM: 5, FROST: 6, ARC: 7 } as const;

type Dummy = {
  group: THREE.Group;
  hp: number;
  frozen: number;
  vel: THREE.Vector3;
  collider: THREE.Mesh;
  actor?: SpriteActor;
  toon?: ToonRig;
  home: THREE.Vector3;
  wander: { radius: number; speed: number; offset: number; wobble: number; cx: number; cz: number };
};

type Shot = {
  active: boolean;
  skill: SkillDef;
  skillKey: string;
  pos: THREE.Vector3;
  prev: THREE.Vector3;
  dir: THREE.Vector3;
  origin: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  age: number;
  pierce: number;
  path: PathKind;
  ignore: Set<number>;
  clash: Set<string>;
  slot: number;
  mesh: THREE.Object3D;
  trail: THREE.Line;
  trailGeo: THREE.BufferGeometry;
  trailPts: Float32Array;
};

type Burst = {
  active: boolean;
  pos: THREE.Vector3;
  age: number;
  life: number;
  radius: number;
  color: THREE.Color;
  kind: SkillDef["explosion"];
  force: number;
  mesh: THREE.Mesh;
};

type Nova = {
  active: boolean;
  origin: THREE.Vector3;
  dir: THREE.Vector3;
  radius: number;
  max: number;
  age: number;
  cone: number;
  skill: SkillDef;
  ring: THREE.Mesh;
  disk: THREE.Mesh;
  hit: Set<number>;
};

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _muzzleFwd = new THREE.Vector3();
const FALLBACK_FORWARD = new THREE.Vector3(0, 0, -1);
const FOCUS_HOLD_KEY = "grudge-lab-focus-hold";

function readFocusHold() {
  try {
    return localStorage.getItem(FOCUS_HOLD_KEY) === "1";
  } catch {
    return false;
  }
}

function hexToInt(hex: string): number {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return Number.isFinite(n) ? n : 0xff6a2a;
}

function makeMat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.45, ...opts });
}

export class LabEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1800);
  private clock = new THREE.Timer();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private aimPoint = new THREE.Vector3(0, 0, -8);
  private keys = new Set<string>();
  private disposed = false;
  private raf = 0;
  private yaw = 0;
  private camYaw = 0.4;
  private camPitch = 0.38;
  private camDist = 9.5;
  private orbiting = false;
  private focused = false;
  private focusHold = false;
  private focusOrbit = 0;
  private lastX = 0;
  private lastY = 0;
  private rmbMoved = false;
  private paused = false;
  private editorOpen = false;
  private studioOpen = false;
  private bookOpen = false;
  private listening = false;
  private bindings: Record<string, string> = {};
  private catalog: SkillDef[] = [];
  private custom: SkillDef = defaultCustomSkill();
  private activeSkillId = "q-firebolt";
  private player = new THREE.Group();
  private kit!: THREE.Group;
  private torso!: THREE.Object3D;
  private rArm!: THREE.Object3D;
  private weaponHold!: THREE.Group;
  private bowHold!: THREE.Group;
  private helm!: THREE.Object3D;
  private animT = 0;
  private fireT = 0;
  private speed = 0;
  private hp = 100;
  private mana = 100;
  private buffs: string[] = [];
  private buffT = 0;
  private dummies: Dummy[] = [];
  private shots: Shot[] = [];
  private bursts: Burst[] = [];
  private novas: Nova[] = [];
  private customProto: THREE.Object3D | null = null;
  private dummyMat!: THREE.MeshStandardMaterial;
  private dummyIceMat!: THREE.MeshStandardMaterial;
  private hint = "Aim with mouse · LMB / Cast to fire";
  private frames = 0;
  private fps = 60;
  private fpsAcc = 0;
  private onHud: (s: HudState) => void;
  private canvas: HTMLCanvasElement;
  private touchMove = { x: 0, y: 0 };
  private pad: PadFrame | null = null;
  private sparks = new SparkPool();
  private heroActor: SpriteActor | null = null;
  private kitId = "human";
  private toon: ToonRig | null = null;
  private weaponMesh: THREE.Object3D | null = null;
  private weaponUuid = "";
  private arrowProto: THREE.Object3D | null = null;
  private aim: AimMode = "mouse";
  private lockDummy: Dummy | null = null;
  private cameraFeel = new CameraFeel();
  private weatherSys!: WeatherSystem;
  private grass!: GrassField;
  private activeMode = false;
  private simTime = 0;
  private weather!: WeatherSystem;
  private hitStop = 0;
  private moveFwd = new THREE.Vector3();
  private moveRight = new THREE.Vector3();
  private playerCollider: THREE.Mesh | null = null;
  private fleetLabel = "linking D1 / VFX…";
  private effects: VfxEntry[] = [];
  private loader = new GLTFLoader();
  private pendingOverlay: "attack" | "cast" | null = null;
  private animPacks: Record<string, THREE.AnimationClip> | null = null;
  private gravity = new THREE.Vector3(0, -18, 0);
  private collidersOn = false;
  private armor = "A";
  private reticle!: THREE.Mesh;
  private aoeGhost!: THREE.Group;
  private rangeGroup = new THREE.Group();
  private physics = new LabPhysics();
  private rituals!: RitualDirector;
  private slashes: FlyingSlash[] = [];
  private handNow = new THREE.Vector3(0, 1.2, 0);
  private handPrev = new THREE.Vector3(0, 1.2, 0);
  private pendingSlash: { skill: SkillDef; t: number } | null = null;
  private ownLoop = true;
  private ext: {
    element: string;
    rig: { shakeOffset: THREE.Vector3 };
    aim: { object3D: { visible: boolean }; point: (p: THREE.Vector2) => void; arm: () => void };
    keyToElement: (code: string) => string | null;
    armAbility: (el: string) => void;
    point: (p: THREE.Vector2) => void;
    confirm: () => void;
    setCastOrigin?: (p: THREE.Vector3) => void;
    toggleBoost: () => void;
    toggleMagic: () => void;
    toggleFire: () => void;
    update: (dt: number, w: number, h: number) => void;
    label: () => string;
    bindToon: (toon: unknown) => void;
    clear?: () => void;
    decals: { spawn: (type: number, pos: THREE.Vector3, opts: Record<string, unknown>) => void };
  } | null = null;
  private bending: {
    select: (el: string) => void;
    setAim: (o: THREE.Vector3, t: THREE.Vector3, dt: number) => void;
    castLinear: () => boolean;
    update: (dt: number, w: number, h: number) => void;
    aim: { group: { visible: boolean } };
    decals?: { spawn: (type: number, pos: THREE.Vector3, opts: Record<string, unknown>) => void };
  } | null = null;
  private linear: {
    element: string;
    aim: { object3D: { visible: boolean }; point: (p: THREE.Vector2) => void; arm: () => void };
    armAbility: (el: string) => void;
    point: (p: THREE.Vector2) => void;
    confirm: () => void;
    setCastOrigin?: (p: THREE.Vector3) => void;
    update: (dt: number, w: number, h: number) => void;
    label: () => string;
    clear?: () => void;
    decals?: { spawn: (type: number, pos: THREE.Vector3, opts: Record<string, unknown>) => void };
  } | null = null;
  private samurai: {
    bindToon: (toon: unknown, clips?: Record<string, THREE.AnimationClip>) => void;
    syncDummies: (dummies: Dummy[]) => void;
    summonShadows: (from: THREE.Vector3) => number;
    forgeBlades: (from: THREE.Vector3) => number;
    launchBlades: () => number;
    dropJudgement: (from: THREE.Vector3) => boolean;
    update: (dt: number, w: number, h: number, yaw?: number) => void;
    clear?: () => void;
  } | null = null;
  private chrome = false;
  private element = "pyre";
  private kitMode: KitMode = "sandbox";
  private bendElement = "fire";
  private snapshotTunes: ((mode: KitMode, el: string) => HudState["tunes"]) | null = null;
  private writeTuneFn: ((knob: { source: "ext" | "bend" | "lin" | "sam"; block: string; key: string; label: string; min: number; max: number; step: number }, value: number) => void) | null = null;

  private static SKILL_EXT: Record<string, string> = {
    pyre_crown: "pyre",
    kraken_crown: "kraken",
    electrical_sphere: "electrical",
    earthen_spire: "earth",
    verdant_gate: "portal",
    tidewrought_ring: "aether",
    fire_portal: "firePortal",
  };

  private static SKILL_BEND: Record<string, string> = {
    fire_bending: "fire",
    water_linear: "water",
    earth_line: "earth",
    air_gale: "wind",
  };

  private static SKILL_LINEAR: Record<string, string> = {
    frost_lance: "ice",
    storm_lance: "thunder",
    cinder_fall: "meteor",
    nova_beam: "beam",
    voltaic_snare: "snare",
    glacial_crown: "glacier",
  };

  private static SKILL_SAMURAI: Record<string, string> = {
    shadow_clones: "shadows",
    blade_storm: "blades",
    judgement_fist: "judgement",
  };

  constructor(
    canvas: HTMLCanvasElement,
    onHud: (s: HudState) => void,
    attach?: {
      gl?: THREE.WebGLRenderer;
      scene?: THREE.Scene;
      camera?: THREE.Camera;
      ownLoop?: boolean;
    },
  ) {
    this.canvas = canvas;
    this.onHud = onHud;
    this.ownLoop = attach?.ownLoop ?? true;
    if (attach?.scene) this.scene = attach.scene;
    if (attach?.camera && (attach.camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      this.camera = attach.camera as THREE.PerspectiveCamera;
      this.camera.near = 0.1;
      this.camera.far = 1800;
      this.camera.updateProjectionMatrix();
    }
    this.renderer =
      attach?.gl ??
      new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x05070a, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const loaded = loadSkills();
    this.catalog = loaded.catalog;
    this.custom = loaded.custom;
    this.bindings = loaded.bindings;
    this.buildWorld();
    this.buildWarlord();
    this.buildDummies();
    this.allocPools();
    this.slashes = createSlashPool(10, this.scene);
    this.rituals = new RitualDirector(this.scene, this.sparks, this.player);
    this.camera.layers.enable(0);
    this.camera.layers.enable(1);
    this.camera.layers.enable(3);
    this.hint = "1–6 weapon · R F V T G B class · LMB fire · RMB focus";
    this.focusHold = readFocusHold();
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene.add(this.sparks.points);
    this.bind();
    this.resize();
    this.installControlsProbe();
    this.emit();
    this.clock.connect(document);
    if (this.ownLoop) this.raf = requestAnimationFrame(this.loop);
    void this.bootFleet();
  }

  private kitsPromise: Promise<void> | null = null;

  private ensureKits() {
    if (!this.kitsPromise) this.kitsPromise = this.bootKits();
    return this.kitsPromise;
  }

  private async bootKits() {
    const [{ ExtRuntime }, { BendingRuntime }, { LinearCastRuntime }, { SamuraiRuntime }, tune] = await Promise.all([
      import("@/ext/runtime.js"),
      import("@/bending/runtime.js"),
      import("@/linear/runtime.js"),
      import("@/samurai/runtime.js"),
      import("./vfx-tune"),
    ]);
    this.snapshotTunes = tune.snapshotTunes;
    this.writeTuneFn = tune.writeTune;
    this.ext = new ExtRuntime(this.scene, this.camera, this.renderer, this.player);
    this.bending = new BendingRuntime(this.scene, this.camera, this.renderer);
    this.linear = new LinearCastRuntime(this.scene, this.camera, this.renderer, this.player);
    this.samurai = new SamuraiRuntime(this.scene, this.camera, this.renderer, this.player);
    if (this.toon) {
      this.ext.bindToon(this.toon);
      this.samurai.bindToon(this.toon, this.animPacks ?? undefined);
    }
    this.samurai.syncDummies(this.dummies);
    this.applyKitForSkill(this.activeSkillId);
    this.hint = "Kits live · 1–6 weapon · R F V T G B class · LMB fire";
    this.emit();
  }

  attachRapier(world: unknown) {
    this.physics.attachWorld(world as never);
    this.rebuildPhysicsBodies();
  }

  tick(dt: number) {
    if (this.disposed) return;
    this.stepFrame(dt);
  }

  private persist() {
    saveSkillState({ custom: this.custom, bindings: this.bindings, catalog: this.catalog });
  }

  setCustom(patch: Partial<SkillDef>) {
    this.custom = { ...this.custom, ...patch, id: "custom" };
    const i = this.catalog.findIndex((s) => s.id === "custom");
    if (i >= 0) this.catalog[i] = this.custom;
    this.persist();
    this.activeSkillId = "custom";
    this.emit();
  }

  patchActive(patch: Partial<SkillDef>) {
    const skill = skillById(this.catalog, this.custom, this.activeSkillId);
    Object.assign(skill, patch);
    if (skill.id === "custom") this.custom = { ...skill };
    this.syncSkillTunes(skill);
    this.persist();
    this.emit();
  }

  cycleAim() {
    const i = AIM_MODES.indexOf(this.aim);
    this.aim = AIM_MODES[(i + 1) % AIM_MODES.length] ?? "mouse";
    this.hint = `Aim: ${this.aim}`;
    this.emit();
  }

  applyVfx(id: string) {
    const e = this.effects.find((x) => x.id === id);
    if (!e) return;
    this.setCustom({ name: e.name, color: e.colors?.primary ?? this.custom.color });
    this.hint = `Bound VFX ${e.name} → T`;
  }

  toggleEditor(v?: boolean) {
    this.editorOpen = v ?? !this.editorOpen;
    this.emit();
  }
  toggleStudio(v?: boolean) {
    this.studioOpen = v ?? !this.studioOpen;
    this.emit();
  }
  toggleBook(v?: boolean) {
    this.bookOpen = v ?? !this.bookOpen;
    if (this.bookOpen) {
      this.editorOpen = false;
      this.studioOpen = false;
    }
    this.listening = false;
    this.emit();
  }
  toggleColliders(v?: boolean) {
    this.collidersOn = v ?? !this.collidersOn;
    this.syncColliderVis();
    this.hint = this.collidersOn ? "Colliders on" : "Colliders off";
    this.emit();
  }

  selectElement(element: string) {
    this.kitMode = "sandbox";
    this.element = element;
    this.ext?.armAbility(element);
    this.hint = this.ext?.label() ?? element;
    this.syncAimVis();
    this.emit();
  }

  selectBending(element: string) {
    this.kitMode = "bending";
    this.bendElement = element;
    this.bending?.select(element);
    this.hint = `Bending · ${element}`;
    this.syncAimVis();
    this.emit();
  }

  selectLinear(element: string) {
    this.kitMode = "linear";
    this.element = element;
    this.linear?.armAbility(element);
    this.hint = this.linear?.label() ?? element;
    this.syncAimVis();
    this.emit();
  }

  toggleBoost() {
    this.ext?.toggleBoost();
    this.addBuff("Electric Boost");
    this.buffT = 14;
    this.element = "boost";
    this.emit();
  }
  toggleMagic() {
    this.ext?.toggleMagic();
    this.addBuff("Magic Boost");
    this.buffT = 14;
    this.element = "magic";
    this.emit();
  }
  toggleFireBuff() {
    this.ext?.toggleFire();
    this.addBuff("Fire Boost");
    this.buffT = 14;
    this.element = "firebuff";
    this.emit();
  }

  patchTune(block: string, key: string, source: "ext" | "bend" | "lin" | "sam", value: number) {
    this.writeTuneFn?.({ block, key, source, label: key, min: 0, max: 1, step: 0.01 }, value);
    this.emit();
  }

  private applyKitForSkill(id: string) {
    const skill = skillById(this.catalog, this.custom, id);
    this.showWeapon(skill.asset);
    const bend = LabEngine.SKILL_BEND[id];
    const lin = LabEngine.SKILL_LINEAR[id];
    const sam = LabEngine.SKILL_SAMURAI[id];
    const ext = LabEngine.SKILL_EXT[id];
    if (bend) {
      this.kitMode = "bending";
      this.bendElement = bend;
      if (!this.bending) void this.ensureKits().then(() => this.applyKitForSkill(id));
      else this.bending.select(bend);
    } else if (lin) {
      this.kitMode = "linear";
      this.element = lin;
      if (!this.linear) void this.ensureKits().then(() => this.applyKitForSkill(id));
      else this.linear.armAbility(lin);
    } else if (sam) {
      this.kitMode = "samurai";
      this.element = sam;
      if (!this.samurai) void this.ensureKits().then(() => this.applyKitForSkill(id));
    } else if (ext || skill.kind === "ritual" || skill.kind === "portal") {
      this.kitMode = "sandbox";
      if (ext) {
        this.element = ext;
        if (!this.ext) void this.ensureKits().then(() => this.applyKitForSkill(id));
        else this.ext.armAbility(ext);
      }
    } else {
      this.kitMode = "shot";
    }
    this.syncSkillTunes(skill);
    this.syncAimVis();
  }

  private syncSkillTunes(skill: SkillDef) {
    if (!this.writeTuneFn) return;
    const write = (
      source: "ext" | "bend" | "lin" | "sam",
      block: string,
      key: string,
      value: number,
    ) => {
      this.writeTuneFn?.(
        { source, block, key, label: key, min: 0, max: 1, step: 0.01 },
        value,
      );
    };
    const ext = LabEngine.SKILL_EXT[skill.id];
    const lin = LabEngine.SKILL_LINEAR[skill.id];
    const bend = LabEngine.SKILL_BEND[skill.id];
    if (ext) {
      if (ext === "earth") write("ext", ext, "range", Math.max(4, skill.length || skill.radius * 3));
      else if (ext === "portal") write("ext", ext, "gateWidth", skill.radius || 2.4);
      else if (ext === "aether" || ext === "firePortal") write("ext", ext, "ringRadius", skill.radius || 1.6);
      else write("ext", ext, "zoneRadius", skill.radius || 3);
      if (skill.speed) write("ext", ext, "speed", skill.speed);
    }
    if (lin) {
      if (lin === "snare" || lin === "glacier") write("lin", lin, "zoneRadius", skill.radius || 3);
      else if (lin === "beam") write("lin", lin, "range", Math.max(6, skill.length || 18));
      else write("lin", lin, "range", Math.max(4, skill.length || 12));
      if (skill.speed) write("lin", lin, "speed", skill.speed);
    }
    if (bend && skill.speed) write("bend", bend, "speed", Math.min(28, Math.max(4, skill.speed * 0.55)));
  }

  private stampGround(skill: SkillDef, origin: THREE.Vector3, radius: number) {
    const fire = skill.explosion === "fire" || skill.school === "fire";
    const ice = skill.explosion === "ice" || skill.school === "frost";
    const storm = skill.school === "lightning";
    const nature = skill.school === "nature";
    const field = fire
      ? DecalType.SCORCH
      : ice
        ? DecalType.FROST
        : storm
          ? DecalType.ARC
          : nature
            ? DecalType.FOAM
            : DecalType.CRACK;
    const wave = ice ? DecalType.RIPPLE : storm ? DecalType.SHOCKWAVE : DecalType.SHOCKWAVE;
    const opts = {
      radius,
      life: 8.5,
      intensity: 1.2,
      growth: radius * 0.28,
      height: 0.03,
    };
    this.ext?.decals.spawn(field, origin, opts);
    this.ext?.decals.spawn(wave, origin, { ...opts, radius: radius * 0.72, life: 3.4, growth: radius * 0.5 });
    this.linear?.decals?.spawn(field, origin, opts);
    this.bending?.decals?.spawn(field, origin, opts);
  }

  private syncAimVis() {
    const aim = this.ext?.aim?.object3D;
    if (aim) aim.visible = this.kitMode === "sandbox";
    const bendAim = this.bending?.aim?.group;
    if (bendAim) bendAim.visible = this.kitMode === "bending";
    const linAim = this.linear?.aim?.object3D;
    if (linAim) linAim.visible = this.kitMode === "linear";
  }

  castBending() {
    this.updateAim();
    if (this.kitMode === "bending") {
      this.castBendingLinear();
      return;
    }
    this.weaponTip(_v3);
    this.ext?.setCastOrigin?.(_v3);
    this.linear?.setCastOrigin?.(_v3);
    this.ext?.point(this.pointer);
    this.ext?.confirm();
    this.pendingOverlay = "cast";
    this.punchCast({ kind: "ritual", impact: 1.2 } as SkillDef);
  }

  private castBendingLinear() {
    if (!this.bending) return;
    this.weaponTip(_v3);
    this.bending.select(this.bendElement);
    this.bending.setAim(_v3, this.aimPoint, 0.016);
    const ok = this.bending.castLinear();
    this.pendingOverlay = "cast";
    this.punchCast({ kind: "linear", impact: 1.4 } as SkillDef);
    this.hint = ok ? `${this.bendElement} stream` : "Draw a longer line";
    this.emit();
  }

  setArmor(letter: string) {
    this.armor = letter.toUpperCase();
    if (this.toon) {
      this.toon.armor = this.armor;
      const skill = skillById(this.catalog, this.custom, this.activeSkillId);
      dressToon(this.toon.root, skill.asset, this.toon.raceId, this.armor);
      this.showWeapon(skill.asset);
    }
    this.emit();
  }

  setWeather(id: WeatherId) {
    this.weatherSys.set(id);
    this.hint = `${id[0]!.toUpperCase()}${id.slice(1)} sky`;
    this.emit();
  }

  toggleActiveMode() {
    this.activeMode = !this.activeMode;
    this.hint = this.activeMode ? "Active · AI wandering" : "Range · dummies hold";
    this.emit();
  }

  setHour(hour: number) {
    this.weatherSys.setHour(hour);
    this.hint = `${this.weatherSys.clock} · ${this.weatherSys.period}`;
    this.emit();
  }

  toggleCycle() {
    this.weatherSys.toggleCycle();
    this.hint = this.weatherSys.timeScale > 0 ? "Day cycle running" : "Time paused";
    this.emit();
  }

  setFocusHold(hold: boolean) {
    this.focusHold = hold;
    try {
      localStorage.setItem(FOCUS_HOLD_KEY, hold ? "1" : "0");
    } catch {
      /* ignore */
    }
    this.hint = hold ? "RMB focus · hold" : "RMB focus · toggle";
    this.emit();
  }

  resetDummies() {
    this.dummies.forEach((d, i) => {
      const a = (i / this.dummies.length) * Math.PI * 2 + 0.2;
      d.home.set(Math.cos(a) * 8.5, 0, Math.sin(a) * 8.5);
      d.wander.cx = Math.cos(a) * 6.5;
      d.wander.cz = Math.sin(a) * 6.5;
      d.group.position.copy(d.home);
      d.hp = 100;
      d.frozen = 0;
      d.vel.set(0, 0, 0);
      this.physics.moveDummy(i, d.group.position.x, d.group.position.z);
    });
    this.hint = "Dummies reset";
    this.emit();
  }
  togglePause() {
    this.paused = !this.paused;
    this.emit();
  }
  armBind() {
    this.listening = !this.listening;
    this.hint = this.listening
      ? "Press 1–6 (weapon) or R F V T G B (class)"
      : "Bind cancelled";
    this.emit();
  }
  bindToSlot(code: string) {
    this.bindActiveTo(code);
  }
  bindActiveTo(code: string) {
    if (!isPlayKey(code)) {
      this.listening = false;
      this.hint = "Only 1–6 and R F V T G B";
      this.emit();
      return;
    }
    const bank = isWeaponKey(code) ? WEAPON_KEYS : CLASS_KEYS;
    for (const k of bank) {
      if (this.bindings[k] === this.activeSkillId) delete this.bindings[k];
    }
    this.bindings[code] = this.activeSkillId;
    this.listening = false;
    this.hint = `${keyLabel(code)} → ${skillById(this.catalog, this.custom, this.activeSkillId).name}`;
    this.persist();
    this.emit();
  }
  setActiveSkill(id: string) {
    this.activeSkillId = id;
    this.applyKitForSkill(id);
    const skill = skillById(this.catalog, this.custom, id);
    this.hint = skill.desc || skill.name;
    this.emit();
  }
  setTouchMove(x: number, y: number) {
    this.touchMove.x = x;
    this.touchMove.y = y;
  }
  castCurrent() {
    this.castSkill(this.activeSkillId);
  }

  async importAsset(file: File) {
    const url = URL.createObjectURL(file);
    try {
      const gltf = await this.loader.loadAsync(url);
      this.customProto = gltf.scene;
      this.custom = { ...this.custom, name: file.name.replace(/\.[^.]+$/, "") };
      this.persist();
      this.activeSkillId = "custom";
      this.hint = `Imported ${file.name}`;
      this.emit();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  exportSkillJson(): string {
    return JSON.stringify(
      { skill: this.custom, vfx: SKILL_VFX[this.custom.id] ?? SKILL_VFX.custom, v: 2 },
      null,
      2,
    );
  }

  async setWarlordKit(id: string) {
    if (GRUDGE6_RACES.some((r) => r.id === id)) {
      await this.loadRace(id);
      return;
    }
    const def = WARLORD_KITS.find((k) => k.id === id) ?? WARLORD_KITS[0];
    if (!def) return;
    this.kitId = def.id;
    this.clearToon();
    if (this.heroActor) this.player.remove(this.heroActor.group);
    const actor = new SpriteActor(def);
    this.heroActor = actor;
    this.player.add(actor.group);
    this.kit.visible = false;
    await actor.load();
    this.hint = `Pixel kit: ${def.name}`;
    this.emit();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.clock.disconnect();
    this.unbind();
    if (window.__controlsTest) delete window.__controlsTest;
    if (this.ownLoop) this.renderer.dispose();
    this.grass?.dispose();
    this.weatherSys?.dispose();
  }

  private clearToon() {
    if (this.toon) {
      this.toon.mixer?.stopAllAction();
      this.player.remove(this.toon.root);
      this.toon = null;
      this.weaponMesh = null;
      this.weaponUuid = "";
    }
  }

  private async loadRace(id: string) {
    this.kitId = id;
    this.kit.visible = false;
    if (this.heroActor) {
      this.player.remove(this.heroActor.group);
      this.heroActor = null;
    }
    this.clearToon();
    try {
      const gltf = await this.loader.loadAsync(raceGlbUrl(id));
      const skill = skillById(this.catalog, this.custom, this.activeSkillId);
      const clips = this.animPacks ?? (await loadBip001Packs(this.loader));
      this.animPacks = clips;
      const rig = preparePlayKit(gltf.scene, {
        raceId: id,
        asset: skill.asset,
        armor: this.armor,
        clips,
        targetH: 1.8,
      });
      this.toon = rig;
      this.weaponMesh = rig.weapon;
      this.weaponUuid = rig.weapon?.uuid ?? "";
      this.player.add(rig.root);
      this.ext?.bindToon(rig);
      this.samurai?.bindToon(rig, clips);
      this.samurai?.syncDummies(this.dummies);
      const name = GRUDGE6_RACES.find((r) => r.id === id)?.name ?? id;
      this.hint = `Grudge6 Toon RTS · ${name}`;
    } catch {
      this.hint = `Grudge6 ${id} failed — pixel fallback`;
      await this.setWarlordKit("barbarian-warrior");
      return;
    }
    this.emit();
  }

  private async bootFleet() {
    try {
      this.animPacks = await loadBip001Packs(this.loader);
      const snap = await loadFleet();
      this.effects = snap.effects;
      this.fleetLabel = `D1 ${Object.keys(snap.d1).length} spells · ${snap.effects.length} VFX · grudge6`;
      this.emit();
      await this.loadWarlords();
      if (!this.physics.world) await this.physics.init();
      this.rebuildPhysicsBodies();
    } catch {
      this.fleetLabel = "fleet offline";
      this.emit();
    }
  }

  private async loadWarlords() {
    this.kit.visible = false;
    await this.loadRace(this.kitId);
    try {
      const arrow = await this.loader.loadAsync(MODEL_URLS.arrow);
      this.arrowProto = makeForwardMesh(arrow.scene, 1.1);
    } catch {
      /* skip */
    }
    const dummyRaces = GRUDGE6_RACES.filter((r) => r.id !== this.kitId);
    await Promise.all(
      this.dummies.map(async (d, i) => {
        const race = dummyRaces[i % dummyRaces.length];
        if (!race) return;
        try {
          const gltf = await this.loader.loadAsync(raceGlbUrl(race.id));
          const clips = this.animPacks ?? (await loadBip001Packs(this.loader));
          this.animPacks = clips;
          const rig = preparePlayKit(gltf.scene, {
            raceId: race.id,
            asset: "spear",
            armor: "A",
            clips,
            targetH: 1.75,
          });
          d.group.clear();
          d.group.add(rig.root);
          d.toon = rig;
          d.collider = this.makeColliderMesh();
          d.group.add(d.collider);
        } catch {
          const def = DUMMY_KITS[i % DUMMY_KITS.length];
          if (!def) return;
          const actor = new SpriteActor(def);
          d.actor = actor;
          d.group.clear();
          d.group.add(actor.group);
          await actor.load();
        }
      }),
    );
    this.emit();
  }

  private fitModel(root: THREE.Object3D, targetH: number) {
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(_v);
    const h = Math.max(size.y, 0.001);
    root.scale.multiplyScalar(targetH / h);
    const box2 = new THREE.Box3().setFromObject(root);
    root.position.y -= box2.min.y;
  }

  private emit() {
    const skill = skillById(this.catalog, this.custom, this.activeSkillId);
    this.onHud({
      paused: this.paused,
      skillName: skill.name,
      skill,
      hp: this.hp,
      mana: this.mana,
      frozen: this.dummies.filter((d) => d.frozen > 0).length,
      fps: this.fps,
      editorOpen: this.editorOpen,
      studioOpen: this.studioOpen,
      custom: this.custom,
      hint: this.hint,
      buffs: this.buffs,
      aim: this.aim,
      fleet: this.fleetLabel,
      effects: this.effects.slice(0, 40).map((e) => ({ id: e.id, name: e.name })),
      kitId: this.kitId,
      kits: GRUDGE6_RACES.map((k) => ({ id: k.id, name: k.name })),
      bookOpen: this.bookOpen,
      listening: this.listening,
      bindings: this.bindings,
      book: this.catalog.map((s) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        school: s.school,
        book: s.book,
        hotkey: keyLabel(Object.entries(this.bindings).find(([, id]) => id === s.id)?.[0] ?? ""),
      })),
      colliders: this.collidersOn,
      armor: this.armor,
      range: Number(this.player.position.distanceTo(this.aimPoint).toFixed(1)),
      element:
        this.kitMode === "bending"
          ? this.bendElement
          : this.kitMode === "linear"
            ? (this.linear?.element ?? this.element)
            : this.kitMode === "samurai"
              ? this.element
              : (this.ext?.element ?? this.element),
      chrome: this.chrome,
      kitMode: this.kitMode,
      bendElement: this.bendElement,
      weather: this.weatherSys.id,
      activeMode: this.activeMode,
      hour: this.weatherSys.hour,
      clock: this.weatherSys.clock,
      period: this.weatherSys.period,
      timeScale: this.weatherSys.timeScale,
      focusHold: this.focusHold,
      focused: this.focused,
      pad: this.pad?.connected ? this.pad.id : "",
      tunes:
        this.snapshotTunes && this.kitMode !== "shot"
          ? this.snapshotTunes(this.kitMode, this.kitMode === "bending" ? this.bendElement : this.element)
          : [],
    });
  }

  private buildWorld() {
    this.weatherSys = new WeatherSystem(this.scene, this.renderer);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(22, 48),
      new THREE.MeshStandardMaterial({ color: 0x5a4630, roughness: 0.94 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.weatherSys.bindGround(ground.material as THREE.MeshStandardMaterial);
    this.grass = new GrassField(this.scene);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(16.2, 16.55, 64),
      new THREE.MeshBasicMaterial({ color: 0xc9a227, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    this.scene.add(ring);
    this.aoeGhost = new THREE.Group();
    const ghostDisk = new THREE.Mesh(
      new THREE.CircleGeometry(1, 48),
      new THREE.MeshBasicMaterial({
        color: 0x7ee8ff,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    ghostDisk.rotation.x = -Math.PI / 2;
    ghostDisk.name = "disk";
    const ghostRing = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1, 64),
      new THREE.MeshBasicMaterial({
        color: 0x7ee8ff,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    ghostRing.rotation.x = -Math.PI / 2;
    ghostRing.position.y = 0.02;
    ghostRing.name = "ring";
    this.aoeGhost.add(ghostDisk, ghostRing);
    this.aoeGhost.visible = false;
    this.aoeGhost.position.y = 0.04;
    this.scene.add(this.aoeGhost);
    for (const r of [5, 10, 15]) {
      const g = new THREE.Mesh(
        new THREE.RingGeometry(r - 0.04, r + 0.04, 64),
        new THREE.MeshBasicMaterial({ color: 0x2a4a58, side: THREE.DoubleSide, transparent: true, opacity: 0.35 }),
      );
      g.rotation.x = -Math.PI / 2;
      g.position.y = 0.03;
      this.rangeGroup.add(g);
    }
    this.scene.add(this.rangeGroup);
    this.rangeGroup.visible = false;
    this.reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.38, 24),
      new THREE.MeshBasicMaterial({ color: 0xff6a2a, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
    );
    this.reticle.rotation.x = -Math.PI / 2;
    this.scene.add(this.reticle);
    this.scene.add(this.sparks.points);
  }

  private buildWarlord() {
    this.player.position.set(0, 0, 0);
    this.scene.add(this.player);
    this.kit = new THREE.Group();
    this.player.add(this.kit);
    const armor = makeMat(0x2a323c, { metalness: 0.72, roughness: 0.32 });
    this.torso = new THREE.Group();
    this.torso.position.y = 1.18;
    this.kit.add(this.torso);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.7, 0.42), armor);
    chest.position.y = 0.28;
    this.torso.add(chest);
    this.helm = new THREE.Group();
    this.helm.position.y = 0.78;
    this.torso.add(this.helm);
    this.rArm = new THREE.Group();
    this.rArm.position.set(0.48, 0.48, 0);
    this.torso.add(this.rArm);
    this.weaponHold = new THREE.Group();
    this.weaponHold.position.set(0.05, -0.52, 0.12);
    this.rArm.add(this.weaponHold);
    this.weaponHold.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.15, 0.16), makeMat(0xc5d0dc, { metalness: 0.95 })));
    this.bowHold = new THREE.Group();
    this.bowHold.visible = false;
    this.rArm.add(this.bowHold);
    this.playerCollider = this.makeColliderMesh();
    this.player.add(this.playerCollider);
  }

  private buildDummies() {
    this.dummyMat = makeMat(0x5a4030, { roughness: 0.85 });
    this.dummyIceMat = makeMat(0x7aa8c4, { emissive: 0x113344, emissiveIntensity: 0.45 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.2;
      const g = new THREE.Group();
      g.position.set(Math.cos(a) * 8.5, 0, Math.sin(a) * 8.5);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 1.5, 8), this.dummyMat);
      body.position.y = 1.05;
      g.add(body);
      const col = this.makeColliderMesh();
      g.add(col);
      this.scene.add(g);
      this.dummies.push({
        group: g,
        hp: 100,
        frozen: 0,
        vel: new THREE.Vector3(),
        collider: col,
        home: new THREE.Vector3(g.position.x, 0, g.position.z),
        wander: {
          radius: 3.2 + i * 0.7,
          speed: 0.35 + i * 0.08,
          offset: i * 1.26,
          wobble: 0.8 + i * 0.15,
          cx: Math.cos(a) * 6.5,
          cz: Math.sin(a) * 6.5,
        },
      });
    }
  }

  private makeColliderMesh() {
    const col = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.48, 0.9, 4, 8),
      new THREE.MeshBasicMaterial({ color: 0x39d2c0, wireframe: true, transparent: true, opacity: 0.7 }),
    );
    col.position.y = 0.9;
    col.visible = this.collidersOn;
    return col;
  }

  private allocPools() {
    for (let i = 0; i < 32; i++) {
      const mesh = this.makeProjectileMesh({ asset: "arrow", color: "#d7c4a3", length: 1.2, size: 0.16 } as SkillDef);
      mesh.visible = false;
      this.scene.add(mesh);
      const trailPts = new Float32Array(18);
      const trailGeo = new THREE.BufferGeometry();
      trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPts, 3));
      const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xff6a2a, transparent: true, opacity: 0.85 }));
      trail.visible = false;
      trail.frustumCulled = false;
      this.scene.add(trail);
      this.shots.push({
        active: false,
        skill: this.custom,
        skillKey: "",
        pos: new THREE.Vector3(),
        prev: new THREE.Vector3(),
        dir: new THREE.Vector3(0, 0, -1),
        origin: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        age: 0,
        pierce: 0,
        path: "straight",
        ignore: new Set(),
        clash: new Set(),
        slot: i,
        mesh,
        trail,
        trailGeo,
        trailPts,
      });
    }
    for (let i = 0; i < 16; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(1, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xff6a2a, transparent: true, opacity: 0.45, depthWrite: false }),
      );
      mesh.visible = false;
      this.scene.add(mesh);
      this.bursts.push({
        active: false,
        pos: new THREE.Vector3(),
        age: 0,
        life: 0.55,
        radius: 1,
        color: new THREE.Color(0xff6a2a),
        kind: "fire",
        force: 10,
        mesh,
      });
    }
    for (let i = 0; i < 6; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.07, 10, 64),
        new THREE.MeshBasicMaterial({
          color: 0x7ee8ff,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.visible = false;
      const disk = new THREE.Mesh(
        new THREE.CircleGeometry(1, 48),
        new THREE.MeshBasicMaterial({
          color: 0x7ee8ff,
          transparent: true,
          opacity: 0.22,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      disk.rotation.x = -Math.PI / 2;
      disk.visible = false;
      this.scene.add(ring, disk);
      this.novas.push({
        active: false,
        origin: new THREE.Vector3(),
        dir: new THREE.Vector3(0, 0, -1),
        radius: 0.4,
        max: 6,
        age: 0,
        cone: 0,
        skill: this.custom,
        ring,
        disk,
        hit: new Set(),
      });
    }
  }

  private makeProjectileMesh(skill: SkillDef, proto?: THREE.Object3D | null): THREE.Object3D {
    if (proto) {
      const c = proto.clone(true);
      c.visible = true;
      c.scale.setScalar(skill.length / 1.1);
      return c;
    }
    const g = new THREE.Group();
    const col = hexToInt(skill.color);
    const len = skill.length || 1.2;
    const sz = skill.size || 0.2;
    if (skill.asset === "bullet") {
      const slug = new THREE.Mesh(
        new THREE.CylinderGeometry(sz * 0.35, sz * 0.45, len * 0.55, 6),
        new THREE.MeshStandardMaterial({ color: 0xc9b48a, metalness: 0.85, roughness: 0.25, emissive: col, emissiveIntensity: 0.25 }),
      );
      slug.rotation.x = -Math.PI / 2;
      g.add(slug);
      const flash = new THREE.Mesh(
        new THREE.SphereGeometry(sz * 0.7, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffe7a0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      flash.position.z = -len * 0.2;
      g.add(flash);
    } else if (skill.asset === "fire" || skill.id === "magic_flame") {
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(sz * 0.55, 14, 12),
        new THREE.MeshBasicMaterial({ color: 0xfff4c8, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      const shell = new THREE.Mesh(
        new THREE.SphereGeometry(sz, 14, 12),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      g.add(shell, core);
    } else if (skill.asset === "ice") {
      const shard = new THREE.Mesh(
        new THREE.OctahedronGeometry(sz, 0),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.18, metalness: 0.15, transparent: true, opacity: 0.92, emissive: col, emissiveIntensity: 0.35 }),
      );
      shard.scale.set(0.55, 1.6, 0.55);
      g.add(shard);
    } else {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(sz * 0.22, sz * 0.38, len, 7), makeMat(col, { metalness: 0.6 }));
      shaft.rotation.x = -Math.PI / 2;
      g.add(shaft);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(sz * 0.42, sz * 1.1, 7), makeMat(0xeee6d8, { metalness: 0.8 }));
      tip.rotation.x = -Math.PI / 2;
      tip.position.z = len * 0.5;
      g.add(tip);
    }
    g.userData.forward = true;
    return g;
  }

  private bind() {
    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.canvas.addEventListener("contextmenu", this.onCtx);
  }
  private unbind() {
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.removeEventListener("contextmenu", this.onCtx);
  }

  private onResize = () => this.resize();
  private onCtx = (e: Event) => e.preventDefault();
  private onBlur = () => this.keys.clear();
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.camDist = THREE.MathUtils.clamp(this.camDist + e.deltaY * 0.01, 4.5, 18);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (this.listening) {
      e.preventDefault();
      if (e.code !== "Escape") this.bindActiveTo(e.code);
      else {
        this.listening = false;
        this.emit();
      }
      return;
    }
    if (e.repeat) return;
    this.keys.add(e.code);
    if (e.code === "KeyP") this.togglePause();
    if (e.code === "Backquote") {
      e.preventDefault();
      this.toggleEditor();
      return;
    }
    if (e.code === "KeyU") this.toggleStudio();
    if (e.code === "Tab") {
      e.preventDefault();
      this.toggleBook();
      return;
    }
    if (e.code === "KeyH") {
      this.chrome = !this.chrome;
      this.emit();
      return;
    }
    if (e.code === "KeyC") {
      if (e.shiftKey) this.ext?.clear?.();
      else this.cycleAim();
      return;
    }
    const bound = this.bindings[e.code];
    if (bound && isPlayKey(e.code)) {
      this.activeSkillId = bound;
      this.castSkill(bound);
      return;
    }
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private onPointerDown = (e: PointerEvent) => {
    if (e.button === 2) {
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.rmbMoved = false;
      this.updatePointer(e);
      const target = this.pickFocusTarget();
      if (this.focusHold) {
        if (target) {
          this.focused = true;
          this.lockDummy = target;
          this.focusOrbit = 0;
          this.hint = "Focus · hold RMB";
          this.emit();
        } else {
          this.orbiting = true;
        }
      } else if (!this.focused && !target) {
        this.orbiting = true;
      }
      return;
    }
    if (e.button === 0 && !this.editorOpen && !this.studioOpen && !this.bookOpen) {
      this.updatePointer(e);
      this.updateAim();
      this.castCurrent();
    }
  };
  private onPointerUp = (e: PointerEvent) => {
    if (e.button !== 2) return;
    this.orbiting = false;
    if (this.focusHold) {
      if (this.focused) {
        this.focused = false;
        this.focusOrbit = 0;
        this.emit();
      }
      return;
    }
    if (this.rmbMoved) return;
    this.updatePointer(e);
    const target = this.pickFocusTarget();
    if (this.focused) {
      if (target && target !== this.lockDummy) {
        this.lockDummy = target;
        this.focusOrbit = 0;
        this.hint = "Focus · A/D strafe";
      } else {
        this.focused = false;
        this.lockDummy = null;
        this.focusOrbit = 0;
        this.hint = "Focus off";
      }
    } else if (target) {
      this.focused = true;
      this.lockDummy = target;
      this.focusOrbit = 0;
      this.hint = "Focus · A/D strafe · RMB to drop";
    }
    this.emit();
  };
  private onPointerMove = (e: PointerEvent) => {
    this.updatePointer(e);
    this.ext?.point(this.pointer);
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    if (dx * dx + dy * dy > 16) this.rmbMoved = true;
    if (this.focused && (e.buttons & 2)) {
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.focusOrbit = THREE.MathUtils.clamp(this.focusOrbit - dx * 0.004, -0.7, 0.7);
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * 0.003, 0.12, 1.05);
      return;
    }
    if (this.orbiting) {
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.camYaw -= dx * 0.005;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * 0.004, 0.12, 1.15);
    }
  };
  private updatePointer(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }
  private resize() {
    if (!this.ownLoop) return;
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }
  private addBuff(name: string) {
    this.buffs = [...this.buffs.filter((b) => b !== name), name].slice(-3);
    this.buffT = 6;
    this.hint = `${name} applied`;
    this.emit();
  }

  private weaponTip(out: THREE.Vector3) {
    _muzzleFwd.set(this.aimPoint.x - this.player.position.x, 0, this.aimPoint.z - this.player.position.z);
    if (_muzzleFwd.lengthSq() < 1e-6) {
      _muzzleFwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    } else {
      _muzzleFwd.normalize();
    }
    const mesh = this.weaponMesh ?? this.toon?.weapon ?? null;
    if (weaponMuzzleWorld(mesh, _muzzleFwd, out)) return out;
    if (this.toon?.rHand) {
      this.toon.rHand.updateWorldMatrix(true, false);
      out.set(0, 0, 0).applyMatrix4(this.toon.rHand.matrixWorld);
      out.addScaledVector(_muzzleFwd, 0.42);
      if (!Number.isFinite(out.y) || out.y < 0.35) out.y = 1.15;
      return out;
    }
    if (this.heroActor) {
      out.set(
        this.player.position.x + _muzzleFwd.x * 0.55,
        1.15,
        this.player.position.z + _muzzleFwd.z * 0.55,
      );
      return out;
    }
    this.weaponHold.updateWorldMatrix(true, false);
    out.set(0, 1.05, 0).applyMatrix4(this.weaponHold.matrixWorld);
    return out;
  }

  private safeCopy(dst: THREE.Vector3, src: THREE.Vector3 | undefined | null, fallback: THREE.Vector3) {
    if (src && Number.isFinite(src.x) && Number.isFinite(src.y) && Number.isFinite(src.z)) dst.copy(src);
    else dst.copy(fallback);
    return dst;
  }

  private castSkill(id: string) {
    if (this.paused) return;
    const skill = skillById(this.catalog, this.custom, id);
    this.activeSkillId = id;
    this.applyKitForSkill(id);
    this.fireT = 0.45;
    this.pendingOverlay = this.castOverlay();
    this.showWeapon(skill.asset);
    this.punchCast(skill);
    this.mana = Math.max(0, this.mana - (skill.kind === "buff" ? 6 : 8));
    const origin = this.weaponTip(_v3);
    this.sparks.burst(origin, skill.color, 18, 3.2, 1.2);
    if (skill.kind === "buff") {
      if (skill.id === "electric_boost") {
        this.ext?.toggleBoost();
        this.addBuff("Electric Boost");
        this.buffT = 14;
      } else if (skill.id === "magic_boost") {
        this.ext?.toggleMagic();
        this.addBuff("Magic Boost");
        this.buffT = 14;
      } else if (skill.id === "fire_boost") {
        this.ext?.toggleFire();
        this.addBuff("Fire Boost");
        this.buffT = 14;
      } else {
        this.addBuff(skill.name);
        if (skill.school === "holy") this.hp = Math.min(100, this.hp + 18);
        const auraColor =
          skill.school === "lightning" ? 0x7ee8ff : skill.school === "arcane" ? 0xc084fc : skill.school === "fire" ? 0xff6a2a : 0xfde68a;
        this.rituals.setAura(skill.id, auraColor, true);
      }
      this.emit();
      return;
    }
    if (skill.kind === "dash") {
      this.doDash(skill);
      this.emit();
      return;
    }
    const bendEl = LabEngine.SKILL_BEND[skill.id];
    if (bendEl) {
      this.selectBending(bendEl);
      this.castBendingLinear();
      return;
    }
    const linEl = LabEngine.SKILL_LINEAR[skill.id];
    if (linEl) {
      this.selectLinear(linEl);
      this.linear?.point(this.pointer);
      this.linear?.confirm();
      this.pendingOverlay = "cast";
      if (skill.kind === "ritual" || skill.kind === "nova") {
        const r = skill.radius || 3;
        this.stampGround(skill, this.aimPoint, r);
        for (const d of this.dummies) {
          if (d.group.position.distanceTo(this.aimPoint) < r + 0.6) this.hitDummy(d, skill, FALLBACK_FORWARD);
        }
      }
      this.emit();
      return;
    }
    const samEl = LabEngine.SKILL_SAMURAI[skill.id];
    if (samEl) {
      this.kitMode = "samurai";
      this.element = samEl;
      this.samurai?.syncDummies(this.dummies);
      const from = this.player.position;
      if (samEl === "shadows") {
        const n = this.samurai?.summonShadows(from) ?? 0;
        this.hint = n ? `Shadows · ${n}` : "No marks standing";
      } else if (samEl === "blades") {
        const n = this.samurai?.forgeBlades(from) ?? 0;
        this.hint = n ? `Blades forging · ${n}` : "No marks standing";
      } else {
        const ok = this.samurai?.dropJudgement(this.aimPoint) ?? false;
        this.hint = ok ? "Judgement" : "No mark under the seal";
      }
      this.pendingOverlay = "cast";
      this.syncAimVis();
      this.emit();
      return;
    }
    const extEl = LabEngine.SKILL_EXT[skill.id];
    if (extEl || skill.kind === "ritual" || skill.kind === "portal") {
      if (extEl) this.selectElement(extEl);
      this.ext?.point(this.pointer);
      this.ext?.confirm();
      this.pendingOverlay = "cast";
      if (skill.kind === "ritual" || skill.kind === "portal") {
        const r = skill.radius || 3;
        this.stampGround(skill, this.aimPoint, r);
        for (const d of this.dummies) {
          if (d.group.position.distanceTo(this.aimPoint) < r + 0.6) this.hitDummy(d, skill, FALLBACK_FORWARD);
        }
      }
      this.emit();
      return;
    }
    if (isFlyingSlash(skill)) {
      const profile = weaponSwingProfile(skill.asset);
      this.pendingSlash = { skill, t: profile.delay };
      this.emit();
      return;
    }
    if (skill.kind === "beam") this.spawnBeam(skill);
    else if (skill.kind === "nova" || skill.kind === "cone") this.spawnNova(skill);
    else if (skill.kind === "volley") this.spawnVolley(skill);
    else if (this.aim === "beam" && skill.kind === "linear") this.spawnBeam(skill);
    else this.spawnShot(skill);
    this.emit();
  }

  private showWeapon(asset: ProjectileAsset) {
    if (this.toon) {
      dressToon(this.toon.root, asset, this.toon.raceId, this.armor);
      this.toon.weapon = findEquippedWeapon(this.toon.root, asset);
      this.weaponMesh = this.toon.weapon;
      this.weaponUuid = this.weaponMesh?.uuid ?? "";
    } else {
      this.weaponMesh = this.weaponHold;
      this.weaponUuid = this.weaponHold.uuid;
    }
    const bow = asset === "arrow";
    this.bowHold.visible = bow && !this.toon;
    this.weaponHold.visible = !bow && !this.toon;
  }

  private spawnShot(skill: SkillDef, dirIn?: THREE.Vector3) {
    const shot = this.shots.find((s) => !s.active);
    if (!shot) return;
    const origin = this.weaponTip(_v);
    const dir = dirIn ? _v2.copy(dirIn) : _v2.copy(this.aimPoint).sub(origin);
    if (dir.lengthSq() < 0.0001) dir.copy(FALLBACK_FORWARD);
    dir.normalize();
    this.onTravel(shot, origin, dir, skill);
    const key = `${skill.id}|${skill.asset}|${skill.color}|${skill.length}|${skill.size}`;
    if (shot.skillKey !== key) {
      this.scene.remove(shot.mesh);
      shot.mesh = this.makeProjectileMesh(skill, skill.asset === "arrow" ? this.arrowProto : skill.id === "custom" ? this.customProto : null);
      this.scene.add(shot.mesh);
      shot.skillKey = key;
    }
    shot.active = true;
    shot.life = 2.6;
    shot.age = 0;
    shot.pierce = skill.pierce ?? 0;
    shot.path = skill.path ?? "straight";
    shot.ignore = new Set();
    shot.clash = new Set();
    shot.mesh.visible = true;
    shot.trail.visible = true;
    (shot.trail.material as THREE.LineBasicMaterial).color.set(skill.color);
    shot.prev.copy(shot.pos);
    this.physics.attachShot(shot.slot, shot.pos.x, shot.pos.y, shot.pos.z, shotRadius(skill.size));
  }

  private onTravel(shot: Shot, origin?: THREE.Vector3, dir?: THREE.Vector3, skill?: SkillDef) {
    shot.skill = skill ?? shot.skill ?? this.custom;
    this.safeCopy(shot.origin, origin, this.player.position);
    this.safeCopy(shot.dir, dir, FALLBACK_FORWARD);
    if (shot.dir.lengthSq() < 1e-8) shot.dir.copy(FALLBACK_FORWARD);
    shot.dir.normalize();
    shot.pos.copy(shot.origin);
    shot.vel.copy(shot.dir).multiplyScalar(shot.skill.speed * (shot.path === "arc" || this.aim === "arc" ? 0.85 : 1));
    if (shot.path === "arc" || this.aim === "arc") shot.vel.y += 6 + shot.skill.speed * 0.08;
    shot.mesh.position.copy(shot.pos);
    this.orientAlong(shot.mesh, shot.dir);
    for (let i = 0; i < 6; i++) {
      shot.trailPts[i * 3] = shot.pos.x;
      shot.trailPts[i * 3 + 1] = shot.pos.y;
      shot.trailPts[i * 3 + 2] = shot.pos.z;
    }
    shot.trailGeo.attributes.position.needsUpdate = true;
  }

  private spawnVolley(skill: SkillDef) {
    const origin = this.weaponTip(new THREE.Vector3());
    const base = this.aimPoint.clone().sub(origin);
    if (base.lengthSq() < 1e-6) base.copy(FALLBACK_FORWARD);
    base.normalize();
    const n = Math.max(1, Math.min(skill.count || 5, 8));
    const spread = ((skill.cone || 28) * Math.PI) / 180;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1) - 0.5;
      const dir = base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), t * spread);
      this.spawnShot(skill, dir);
    }
  }

  private doDash(skill: SkillDef) {
    const origin = this.player.position.clone();
    const dir = this.aimPoint.clone().sub(origin);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.copy(FALLBACK_FORWARD);
    dir.normalize();
    const dist = skill.radius || 5;
    this.player.position.addScaledVector(dir, dist);
    this.player.position.x = THREE.MathUtils.clamp(this.player.position.x, -15.5, 15.5);
    this.player.position.z = THREE.MathUtils.clamp(this.player.position.z, -15.5, 15.5);
    this.sparks.burst(origin, skill.color, 30, 6, 1);
    for (const d of this.dummies) {
      const to = d.group.position.clone().sub(origin);
      const along = to.dot(dir);
      const perp = to.clone().addScaledVector(dir, -along);
      perp.y = 0;
      if (along > 0 && along < dist + 0.6 && perp.length() < 1.1) this.hitDummy(d, skill, dir);
    }
  }

  private spawnNova(skill: SkillDef) {
    const nova = this.novas.find((n) => !n.active);
    if (!nova) return;
    const far = skill.kind !== "cone";
    const origin = (far ? this.aimPoint : this.player.position).clone();
    origin.y = 0.12;
    const dir = _v.copy(this.aimPoint).sub(this.player.position);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.copy(FALLBACK_FORWARD);
    dir.normalize();
    this.iceNovaOnTravel(nova, origin, dir, skill);
    const r = skill.radius || 3.2;
    this.stampGround(skill, origin, r);
    this.sparks.burst(origin, skill.color, 36, 5 + r, 1.6);
    this.punchCast(skill);
  }

  private iceNovaOnTravel(nova: Nova, origin?: THREE.Vector3, dir?: THREE.Vector3, skill?: SkillDef) {
    nova.skill = skill ?? nova.skill ?? this.custom;
    if (!nova.origin) nova.origin = new THREE.Vector3();
    if (!nova.dir) nova.dir = new THREE.Vector3();
    this.safeCopy(nova.origin, origin, this.player.position);
    this.safeCopy(nova.dir, dir, FALLBACK_FORWARD);
    nova.radius = 0.35;
    nova.max = nova.skill.radius || 4 + nova.skill.impact * 1.4;
    nova.cone = nova.skill.kind === "cone" ? nova.skill.cone || 55 : 0;
    nova.age = 0;
    nova.active = true;
    nova.hit = new Set();
    const col = hexToInt(nova.skill.color);
    nova.ring.visible = true;
    nova.ring.position.copy(nova.origin);
    nova.ring.position.y = 0.16;
    (nova.ring.material as THREE.MeshBasicMaterial).color.set(col);
    nova.ring.scale.setScalar(nova.radius);
    nova.disk.visible = true;
    nova.disk.position.copy(nova.origin);
    nova.disk.position.y = 0.05;
    (nova.disk.material as THREE.MeshBasicMaterial).color.set(col);
    nova.disk.scale.setScalar(nova.radius);
  }

  private spawnBeam(skill: SkillDef) {
    const origin = this.weaponTip(new THREE.Vector3());
    const dir = this.aimPoint.clone().sub(origin);
    if (dir.lengthSq() < 1e-6) dir.copy(FALLBACK_FORWARD);
    dir.normalize();
    const hitAt = origin.clone().addScaledVector(dir, 2 + skill.length * 6);
    for (const d of this.dummies) {
      const cap = dummyCapsule(d.group.position.x, d.group.position.z);
      if (sweptSphereHitsCapsule(origin, hitAt, 0.28 + skill.size, cap)) {
        this.hitDummy(d, skill, dir);
        hitAt.set(d.group.position.x, 1.1, d.group.position.z);
        break;
      }
    }
    this.sparks.burst(origin, skill.color, 24, 5, 0.2);
    this.sparks.burst(hitAt, skill.color, 40, 8, 2);
    this.impact(hitAt, skill);
  }

  private orientAlong(obj: THREE.Object3D, forward: THREE.Vector3) {
    orientForward(obj, forward);
  }

  private loop = (t: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    this.clock.update(t);
    let dt = this.clock.getDelta();
    if (!Number.isFinite(dt) || dt <= 0) dt = 1 / 60;
    dt = Math.min(dt, 0.1);
    this.stepFrame(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private stepFrame(dt: number) {
    this.frames += 1;
    this.fpsAcc += dt;
    if (this.fpsAcc >= 0.4) {
      this.fps = Math.round(this.frames / this.fpsAcc);
      this.frames = 0;
      this.fpsAcc = 0;
      this.emit();
    }
    this.pollGamepad(dt);
    this.cameraFeel.update(dt);
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - dt);
      this.drawCamera(dt);
      return;
    }
    if (!this.paused) this.update(dt);
    this.drawCamera(dt);
  }

  private update(dt: number) {
    this.updateAim();
    this.movePlayer(dt);
    this.physics.step(dt);
    this.sampleHand();
    this.animateWarlord(dt);
    this.updateShots(dt);
    this.updateSlashes(dt);
    this.updateNovas(dt);
    this.updateBursts(dt);
    this.updateDummies(dt);
    this.grass.update(
      dt,
      this.player.position,
      this.dummies.map((d) => d.group.position),
      this.weatherSys.sun.position,
      this.weatherSys.id,
    );
    this.rituals.update(dt);
    this.weaponTip(_v3);
    this.ext?.setCastOrigin?.(_v3);
    this.linear?.setCastOrigin?.(_v3);
    this.ext?.point(this.pointer);
    this.ext?.update(dt, this.canvas.clientWidth || 1, this.canvas.clientHeight || 1);
    this.linear?.point(this.pointer);
    this.linear?.update(dt, this.canvas.clientWidth || 1, this.canvas.clientHeight || 1);
    this.bending?.setAim(_v3, this.aimPoint, dt);
    this.bending?.update(dt, this.canvas.clientWidth || 1, this.canvas.clientHeight || 1);
    this.samurai?.syncDummies(this.dummies);
    this.samurai?.update(dt, this.canvas.clientWidth || 1, this.canvas.clientHeight || 1, this.yaw);
    this.weatherSys.update(dt, this.player.position);
    this.syncAimVis();
    this.updateAoeGhost();
    this.physics.step(dt);
    this.sparks.update(dt);
    this.reticle.visible = false;
    this.mana = Math.min(100, this.mana + dt * 8);
    if (this.buffT > 0) {
      this.buffT -= dt;
      if (this.buffT <= 0) {
        this.buffs = [];
        this.rituals.setAura("electric_boost", 0, false);
        this.rituals.setAura("magic_boost", 0, false);
        this.rituals.setAura("fire_boost", 0, false);
      }
    }
  }

  private updateAim() {
    if (this.focused && this.lockDummy) {
      this.aimPoint.copy(this.lockDummy.group.position);
      this.aimPoint.y = 1.25;
      return;
    }
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const planeHit = this.raycaster.ray.intersectPlane(this.groundPlane, _v);
    if (this.aim === "lock") {
      let best = Infinity;
      this.lockDummy = null;
      for (const d of this.dummies) {
        _v2.copy(d.group.position).setY(1.2);
        const dist = this.player.position.distanceToSquared(_v2);
        if (dist < best) {
          best = dist;
          this.lockDummy = d;
        }
      }
      if (this.lockDummy) {
        this.aimPoint.copy(this.lockDummy.group.position);
        this.aimPoint.y = 1.25;
      }
      return;
    }
    if (planeHit) {
      this.aimPoint.copy(planeHit);
      if (this.aim === "height" || this.aim === "beam") {
        const tt = Math.max(0, this.raycaster.ray.origin.y / Math.max(0.001, -this.raycaster.ray.direction.y));
        this.aimPoint.copy(this.raycaster.ray.origin).addScaledVector(this.raycaster.ray.direction, Math.min(tt, 40));
        this.aimPoint.y = Math.max(0.4, this.aimPoint.y);
      } else {
        this.aimPoint.y = this.aim === "arc" ? 0.2 : 1.15;
      }
    }
    if (this.aim === "mouse") {
      for (const d of this.dummies) {
        _v.copy(d.group.position).setY(1.2);
        if (this.raycaster.ray.distanceToPoint(_v) < 0.55) {
          this.aimPoint.copy(_v);
          break;
        }
      }
    }
  }

  private movePlayer(dt: number) {
    if (this.focused && this.lockDummy) {
      const tx = this.lockDummy.group.position.x - this.player.position.x;
      const tz = this.lockDummy.group.position.z - this.player.position.z;
      const targetYaw = Math.atan2(tx, tz);
      const desiredCam = Math.atan2(-tx, -tz) + this.focusOrbit;
      this.yaw += Math.atan2(Math.sin(targetYaw - this.yaw), Math.cos(targetYaw - this.yaw)) * Math.min(1, dt * 14);
      this.camYaw += Math.atan2(Math.sin(desiredCam - this.camYaw), Math.cos(desiredCam - this.camYaw)) * Math.min(1, dt * 10);
      this.player.rotation.y = this.yaw;
    }
    this.moveFwd.set(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
    this.moveRight.set(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw));
    let ix = 0;
    let iz = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) iz += 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) iz -= 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) ix -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) ix += 1;
    ix += this.touchMove.x + (this.pad?.moveX ?? 0);
    iz += this.touchMove.y + (this.pad?.moveY ?? 0);
    const mag = Math.hypot(ix, iz);
    if (mag > 1) {
      ix /= mag;
      iz /= mag;
    }
    const sprint =
      this.keys.has("ShiftLeft") ||
      this.keys.has("ShiftRight") ||
      this.buffs.includes("Might") ||
      this.pad?.sprint
        ? 1.55
        : 1;
    const spd = 5.4 * sprint;
    const vx = (this.moveFwd.x * iz + this.moveRight.x * ix) * spd;
    const vz = (this.moveFwd.z * iz + this.moveRight.z * ix) * spd;
    const next = this.physics.movePlayer(this.player.position.x, this.player.position.z, vx * dt, vz * dt);
    this.player.position.x = THREE.MathUtils.clamp(next.x, -15.5, 15.5);
    this.player.position.z = THREE.MathUtils.clamp(next.z, -15.5, 15.5);
    this.speed = Math.hypot(vx, vz);
    if (this.focused) return;
    const aimX = this.aimPoint.x - this.player.position.x;
    const aimZ = this.aimPoint.z - this.player.position.z;
    const faceX = this.speed > 0.6 ? vx : aimX;
    const faceZ = this.speed > 0.6 ? vz : aimZ;
    const targetYaw = Math.atan2(faceX, faceZ);
    const delta = Math.atan2(Math.sin(targetYaw - this.yaw), Math.cos(targetYaw - this.yaw));
    this.yaw += delta * Math.min(1, dt * 12);
    this.player.rotation.y = this.yaw;
  }

  private animateWarlord(dt: number) {
    this.animT += dt;
    if (this.toon) {
      if (this.fireT > 0) this.fireT -= dt;
      const overlay = this.pendingOverlay;
      this.pendingOverlay = null;
      tickMixer(this.toon, dt, this.speed, overlay);
    } else if (this.heroActor) {
      const moving = this.speed > 0.4;
      if (this.fireT > 0) {
        this.fireT -= dt;
        this.heroActor.setAnim("attack");
      } else this.heroActor.setAnim(moving ? "walk" : "idle");
      this.heroActor.setFlip(this.aimPoint.x >= this.player.position.x ? 1 : -1);
      this.heroActor.update(dt);
    } else {
      if (this.fireT > 0) this.fireT -= dt;
    }
    for (const d of this.dummies) {
      d.actor?.update(dt);
      if (d.toon) tickMixer(d.toon, dt, 0, null);
    }
  }

  private castOverlay(): "attack" | "cast" {
    const skill = skillById(this.catalog, this.custom, this.activeSkillId);
    if (skill.kind === "slash" || skill.kind === "weapon" || skill.kind === "dash") return "attack";
    if (
      skill.kind === "buff" ||
      skill.kind === "ritual" ||
      skill.kind === "portal" ||
      skill.kind === "nova" ||
      skill.kind === "beam" ||
      skill.kind === "path" ||
      skill.kind === "cone"
    ) {
      return "cast";
    }
    if (skill.asset === "fire" || skill.asset === "ice" || skill.asset === "bolt") return "cast";
    return "attack";
  }

  private updateShots(dt: number) {
    for (const shot of this.shots) {
      if (!shot.active) continue;
      shot.prev.copy(shot.pos);
      shot.life -= dt;
      shot.age += dt;
      const path = shot.path;
      if (path === "arc" || this.aim === "arc") {
        shot.vel.addScaledVector(this.gravity, dt);
        shot.pos.addScaledVector(shot.vel, dt);
        if (shot.vel.lengthSq() > 1e-6) shot.dir.copy(shot.vel).normalize();
      } else {
        if (path === "homing") {
          let best = Infinity;
          let tgt: Dummy | null = null;
          for (let idx = 0; idx < this.dummies.length; idx++) {
            if (shot.ignore.has(idx)) continue;
            const d = this.dummies[idx]!;
            const dist = d.group.position.distanceToSquared(shot.pos);
            if (dist < best) {
              best = dist;
              tgt = d;
            }
          }
          if (tgt) {
            _v.copy(tgt.group.position).setY(1.1).sub(shot.pos);
            if (_v.lengthSq() > 1e-6) shot.dir.lerp(_v.normalize(), Math.min(1, dt * 4)).normalize();
          }
        }
        const spd = shot.skill.speed * (this.buffs.includes("Clarity") ? 1.25 : 1);
        shot.pos.addScaledVector(shot.dir, spd * dt);
        if (path === "sine") {
          const amp = 0.35 + shot.skill.length * 0.35;
          const right = _v2.set(-shot.dir.z, 0, shot.dir.x).normalize();
          shot.pos.addScaledVector(right, Math.sin(shot.age * 10) * amp * dt * 8);
        }
      }
      shot.mesh.position.copy(shot.pos);
      this.orientAlong(shot.mesh, shot.dir);
      this.physics.syncShot(shot.slot, shot.pos.x, shot.pos.y, shot.pos.z);
      if (this.resolveVolumeClash("shot", shot.slot, shot.pos, shot.dir, shot.skill, shot.age, shot.clash)) {
        this.killShot(shot);
        continue;
      }
      for (let i = 15; i >= 3; i--) shot.trailPts[i] = shot.trailPts[i - 3]!;
      shot.trailPts[0] = shot.pos.x;
      shot.trailPts[1] = shot.pos.y;
      shot.trailPts[2] = shot.pos.z;
      shot.trailGeo.attributes.position.needsUpdate = true;
      this.sparks.trail(shot.pos, shot.dir, shot.skill.color, shot.skill.trail);
      if (shot.pos.y < 0.05 || shot.life <= 0 || shot.pos.length() > 40) {
        this.impact(shot.pos, shot.skill);
        this.killShot(shot);
        continue;
      }
      const rad = shotRadius(shot.skill.size);
      const rapierHits = this.physics.shotHits(shot.slot, shot.ignore);
      for (let di = 0; di < this.dummies.length; di++) {
        const d = this.dummies[di]!;
        if (shot.ignore.has(di)) continue;
        const cap = dummyCapsule(d.group.position.x, d.group.position.z);
        if (rapierHits.includes(di) || sweptSphereHitsCapsule(shot.prev, shot.pos, rad, cap)) {
          this.hitDummy(d, shot.skill, shot.dir);
          this.impact(shot.pos, shot.skill);
          if (shot.pierce > 0) {
            shot.pierce -= 1;
            shot.ignore.add(di);
          } else {
            this.killShot(shot);
            break;
          }
        }
      }
    }
  }

  private updateNovas(dt: number) {
    for (const nova of this.novas) {
      if (!nova.active) continue;
      nova.age += dt;
      nova.radius += nova.skill.speed * dt * 0.35;
      const k = Math.min(1, nova.radius / Math.max(0.2, nova.max));
      nova.ring.scale.setScalar(Math.max(0.2, nova.radius));
      nova.disk.scale.setScalar(Math.max(0.2, nova.radius));
      (nova.ring.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - k * 0.35);
      (nova.disk.material as THREE.MeshBasicMaterial).opacity = 0.28 * (1 - k * 0.5);
      nova.ring.position.copy(nova.origin).setY(0.16);
      nova.disk.position.copy(nova.origin).setY(0.05);
      for (let i = 0; i < this.dummies.length; i++) {
        const d = this.dummies[i]!;
        if (nova.hit.has(i)) continue;
        const dist = Math.hypot(d.group.position.x - nova.origin.x, d.group.position.z - nova.origin.z);
        if (dist > nova.radius || dist > nova.max) continue;
        _v.copy(d.group.position).sub(nova.origin).setY(0);
        if (_v.lengthSq() < 1e-6) _v.copy(nova.dir);
        _v.normalize();
        if (nova.cone > 0 && (_v.angleTo(nova.dir) * 180) / Math.PI > nova.cone * 0.5) continue;
        nova.hit.add(i);
        this.hitDummy(d, nova.skill, _v);
        if (nova.skill.explosion === "ice" || nova.skill.school === "frost") {
          d.frozen = Math.max(d.frozen, 2.4);
        }
      }
      if (nova.radius >= nova.max) {
        this.impact(nova.origin, nova.skill);
        nova.active = false;
        nova.ring.visible = false;
        nova.disk.visible = false;
      }
    }
  }

  private updateAoeGhost() {
    if (!this.aoeGhost) return;
    const skill = skillById(this.catalog, this.custom, this.activeSkillId);
    const show = isFarAoe(skill.kind) || skill.kind === "cone";
    this.aoeGhost.visible = show && this.kitMode === "shot";
    if (!show) return;
    const r = Math.max(0.8, skill.radius || 3);
    if (skill.kind === "cone") {
      this.aoeGhost.position.set(this.player.position.x, 0.04, this.player.position.z);
    } else {
      this.aoeGhost.position.set(this.aimPoint.x, 0.04, this.aimPoint.z);
    }
    this.aoeGhost.scale.set(r, 1, r);
    const col = hexToInt(skill.color);
    this.aoeGhost.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) (m.material as THREE.MeshBasicMaterial).color.set(col);
    });
  }

  private updateBursts(dt: number) {
    for (const b of this.bursts) {
      if (!b.active) continue;
      b.age += dt;
      const k = b.age / b.life;
      b.mesh.scale.setScalar(b.radius * (0.3 + k * 1.4));
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.55;
      if (b.age >= b.life) {
        b.active = false;
        b.mesh.visible = false;
      }
    }
  }

  private updateDummies(dt: number) {
    this.simTime += dt;
    for (let i = 0; i < this.dummies.length; i++) {
      const d = this.dummies[i]!;
      if (d.frozen > 0) {
        d.frozen -= dt;
        d.vel.multiplyScalar(0.2);
      } else if (this.activeMode) {
        const w = d.wander;
        const angle = this.simTime * w.speed + w.offset;
        const wobble = Math.sin(angle * 2.3) * w.wobble;
        const tx = w.cx + Math.cos(angle) * w.radius + wobble * 0.25;
        const tz = w.cz + Math.sin(angle) * w.radius + wobble * 0.25;
        const lim = 15.5;
        const cl = Math.hypot(tx, tz);
        const nx = cl > lim ? (tx / cl) * lim : tx;
        const nz = cl > lim ? (tz / cl) * lim : tz;
        const dx = nx - d.group.position.x;
        const dz = nz - d.group.position.z;
        d.group.position.x += dx * Math.min(1, dt * 2.2);
        d.group.position.z += dz * Math.min(1, dt * 2.2);
        if (dx * dx + dz * dz > 1e-4) d.group.rotation.y = Math.atan2(dx, dz);
      }
      d.group.position.addScaledVector(d.vel, dt);
      d.vel.multiplyScalar(0.9);
      if (!this.activeMode) {
        const dx = this.player.position.x - d.group.position.x;
        const dz = this.player.position.z - d.group.position.z;
        d.group.rotation.y = Math.atan2(dx, dz);
      }
      if (d.collider) d.collider.visible = this.collidersOn;
      this.physics.moveDummy(i, d.group.position.x, d.group.position.z);
      if (d.hp <= 0) {
        d.hp = 100;
        this.hint = "Dummy reset";
      }
    }
  }

  private sampleHand() {
    this.handPrev.copy(this.handNow);
    this.weaponTip(this.handNow);
  }

  private updateSlashes(dt: number) {
    if (this.pendingSlash) {
      this.pendingSlash.t -= dt;
      if (this.pendingSlash.t <= 0) {
        this.launchSlash(this.pendingSlash.skill);
        this.pendingSlash = null;
      }
    }
    for (const s of this.slashes) {
      if (!s.active) continue;
      s.age += dt;
      s.life -= dt;
      s.pos.addScaledVector(s.dir, s.speed * dt);
      tickSlash(s, dt);
      orientSlash(s);
      this.physics.syncSlash(s);
      this.sparks.trail(s.pos, s.dir, s.skill.color, 0.7);
      if (this.resolveVolumeClash("slash", s.slot, s.pos, s.dir, s.skill, s.age, s.clash)) {
        this.impact(s.pos, s.skill);
        this.killSlash(s);
        continue;
      }
      const rapierHits = this.physics.hits(s);
      _v.copy(s.pos).addScaledVector(s.dir, -s.speed * dt);
      for (let di = 0; di < this.dummies.length; di++) {
        if (s.ignore.has(di)) continue;
        const d = this.dummies[di]!;
        const cap = dummyCapsule(d.group.position.x, d.group.position.z);
        if (rapierHits.includes(di) || sweptSphereHitsCapsule(_v, s.pos, 0.55, cap) || sphereHitsCapsule(s.pos, 0.55, cap)) {
          this.hitDummy(d, s.skill, s.dir);
          this.impact(s.pos, s.skill);
          s.ignore.add(di);
          s.pierce -= 1;
          if (s.pierce < 0) {
            this.killSlash(s);
            break;
          }
        }
      }
      if (s.active && (s.life <= 0 || s.pos.length() > 42)) this.killSlash(s);
    }
  }

  private launchSlash(skill: SkillDef) {
    const profile = weaponSwingProfile(skill.asset);
    const launched = slashLaunch(this.handNow, this.handPrev, this.aimPoint, this.player.position, profile);
    this.meleeCleave(skill, launched.dir);
    const n = Math.max(1, Math.min(3, skill.count || 1));
    const spread = n === 1 ? [0] : n === 2 ? [-0.12, 0.12] : [-0.18, 0, 0.18];
    for (const yaw of spread) {
      const slot = this.slashes.find((s) => !s.active);
      if (!slot) break;
      restyleSlash(slot, skill);
      slot.active = true;
      slot.skill = skill;
      slot.pos.copy(launched.pos);
      slot.dir.copy(offsetSlashDir(launched.dir, yaw));
      slot.speed = Math.max(18, skill.speed);
      slot.life = 0.85 + skill.length * 0.12;
      slot.age = 0;
      slot.pierce = Math.max(2, skill.pierce || 3);
      slot.ignore = new Set();
      slot.clash = new Set();
      slot.mesh.visible = true;
      orientSlash(slot);
      this.physics.attachSlash(slot);
    }
    this.sparks.burst(launched.pos, skill.color, 22, 6, 1.1);
    this.punchCast(skill);
    this.hint = n > 1 ? `${skill.name} · ${n} flying cuts` : `${skill.name} screaming slash`;
  }

  /** Blade itself — anyone in reach and in front is cut as the wave leaves the steel. */
  private meleeCleave(skill: SkillDef, dir: THREE.Vector3) {
    const reach = meleeReach(skill);
    const origin = this.player.position;
    for (let i = 0; i < this.dummies.length; i++) {
      const d = this.dummies[i]!;
      const dx = d.group.position.x - origin.x;
      const dz = d.group.position.z - origin.z;
      const dist = Math.hypot(dx, dz);
      if (dist > reach || dist < 0.15) continue;
      _v.set(dx, 0, dz);
      if (_v.lengthSq() < 1e-6) continue;
      _v.normalize();
      if (_v.dot(dir) < 0.25) continue;
      this.hitDummy(d, skill, dir);
      this.impact(d.group.position, skill);
    }
  }

  private clashKey(kind: "slash" | "shot", index: number) {
    return `${kind}:${index}`;
  }

  /** Hitbox ∩ hitbox. Returns true if this volume should die. */
  private resolveVolumeClash(
    kind: "slash" | "shot",
    index: number,
    pos: THREE.Vector3,
    dir: THREE.Vector3,
    skill: SkillDef,
    age: number,
    clash: Set<string>,
  ): boolean {
    if (age < 0.12) return false;
    const hits = kind === "slash" ? this.physics.overlaps(this.slashes[index]!) : this.physics.shotOverlaps(index);
    for (const hit of hits) {
      if (hit.kind === "dummy") continue;
      if (hit.kind === kind && hit.index === index) continue;
      const otherKey = this.clashKey(hit.kind, hit.index);
      if (clash.has(otherKey)) continue;
      let otherPos: THREE.Vector3 | null = null;
      let otherDir: THREE.Vector3 | null = null;
      let otherForce = 0;
      let otherAge = 0;
      let otherClash: Set<string> | null = null;
      let killOther: (() => void) | null = null;
      if (hit.kind === "slash") {
        const o = this.slashes[hit.index];
        if (!o?.active) continue;
        otherPos = o.pos;
        otherDir = o.dir;
        otherForce = o.skill.force;
        otherAge = o.age;
        otherClash = o.clash;
        killOther = () => this.killSlash(o);
      } else {
        const o = this.shots[hit.index];
        if (!o?.active) continue;
        otherPos = o.pos;
        otherDir = o.dir;
        otherForce = o.skill.force;
        otherAge = o.age;
        otherClash = o.clash;
        killOther = () => this.killShot(o);
      }
      if (otherAge < 0.12) continue;
      if (dir.dot(otherDir!) > 0.82 && pos.distanceToSquared(otherPos!) < 1.6) continue;
      const selfKey = this.clashKey(kind, index);
      clash.add(otherKey);
      otherClash!.add(selfKey);
      const fa = skill.force;
      const fb = otherForce;
      const mid = _v.copy(pos).lerp(otherPos!, 0.5);
      this.sparks.burst(mid, skill.color, 22, 5, 1.1);
      rumble(0.35, 0.2, 70);
      const equal = Math.abs(fa - fb) < Math.max(5, 0.18 * Math.max(fa, fb));
      if (equal) {
        const n = _v2.copy(otherPos!).sub(pos);
        n.y = 0;
        if (n.lengthSq() < 1e-6) n.copy(dir);
        n.normalize();
        dir.addScaledVector(n, -2 * dir.dot(n)).normalize();
        otherDir!.addScaledVector(n, -2 * otherDir!.dot(n)).normalize();
        this.hint = "Clash · elastic";
        continue;
      }
      if (fa > fb) {
        killOther?.();
        this.hint = "Clash · overwhelm";
        continue;
      }
      this.hint = "Clash · stopped";
      return true;
    }
    return false;
  }

  private killSlash(s: FlyingSlash) {
    s.active = false;
    s.mesh.visible = false;
    this.physics.releaseSlash(s);
  }

  private hitDummy(d: Dummy, skill: SkillDef, dir: THREE.Vector3) {
    d.hp -= 12 + skill.impact * 8 + skill.size * 10;
    this.safeCopy(_v, dir, FALLBACK_FORWARD);
    d.vel.addScaledVector(_v, skill.force * 0.35);
    if (skill.explosion === "ice") d.frozen = Math.max(d.frozen, 1.6);
    this.punchHit(skill);
    this.hint = `${skill.name} hit · ${Math.max(0, Math.round(d.hp))} hp`;
  }

  private impact(pos: THREE.Vector3, skill: SkillDef) {
    const b = this.bursts.find((x) => !x.active);
    if (!b) return;
    b.active = true;
    b.age = 0;
    b.life = 0.45 + skill.impact * 0.08;
    this.safeCopy(b.pos, pos, this.player.position);
    b.mesh.position.copy(b.pos);
    b.radius = 0.4 + skill.impact * 0.55;
    b.kind = skill.explosion;
    b.force = skill.force;
    b.color.set(skill.color);
    (b.mesh.material as THREE.MeshBasicMaterial).color.copy(b.color);
    b.mesh.visible = true;
    b.mesh.scale.setScalar(0.2);
    this.sparks.burst(b.pos, skill.color, 28, 4 + skill.force * 0.12, 2.2);
    this.punchCast(skill);
    const mark =
      skill.explosion === "fire" || skill.asset === "fire"
        ? DecalType.SCORCH
        : skill.explosion === "ice"
          ? DecalType.FROST
          : DecalType.SHOCKWAVE;
    this.ext?.decals.spawn(mark, b.pos, {
      radius: 0.9 + skill.impact * 0.55,
      life: 4.2,
      intensity: 1,
      height: 0.025,
    });
  }

  private killShot(shot: Shot) {
    shot.active = false;
    shot.mesh.visible = false;
    shot.trail.visible = false;
    this.physics.releaseShot(shot.slot);
  }

  private pollGamepad(dt: number) {
    const was = this.pad?.connected ?? false;
    const pad = pollPad();
    this.pad = pad;
    if (pad.connected !== was) {
      this.hint = pad.connected ? `Pad · ${pad.id}` : "Pad disconnected";
      this.emit();
    }
    if (!pad.connected) return;
    if (pad.pauseEdge) this.togglePause();
    if (pad.bookEdge) this.toggleBook();
    if (this.paused || this.bookOpen || this.editorOpen) return;

    if (Math.abs(pad.lookX) + Math.abs(pad.lookY) > 0) {
      if (this.focused) {
        this.focusOrbit = THREE.MathUtils.clamp(this.focusOrbit - pad.lookX * dt * 1.6, -0.7, 0.7);
        this.camPitch = THREE.MathUtils.clamp(this.camPitch + pad.lookY * dt * 1.2, 0.12, 1.05);
      } else {
        this.camYaw -= pad.lookX * dt * 2.4;
        this.camPitch = THREE.MathUtils.clamp(this.camPitch + pad.lookY * dt * 1.6, 0.12, 1.15);
      }
    }

    if (pad.focusToggleEdge) this.toggleFocusFromPad();
    if (this.focusHold) {
      if (pad.focus && !this.focused) this.lockFocusFromPad();
      if (!pad.focus && this.focused && !this.orbiting) {
        this.focused = false;
        this.focusOrbit = 0;
      }
    } else if (pad.focusEdge) {
      this.toggleFocusFromPad();
    }

    if (pad.weaponDelta) this.cycleBank(WEAPON_KEYS, pad.weaponDelta);
    if (pad.classSlot >= 0) this.castBound(CLASS_KEYS[pad.classSlot] ?? "KeyR");
    if (pad.fireEdge) this.castCurrent();
  }

  private cycleBank(bank: readonly string[], delta: number) {
    const idx = Math.max(
      0,
      bank.findIndex((k) => this.bindings[k] === this.activeSkillId),
    );
    const next = bank[(idx + delta + bank.length) % bank.length];
    if (!next) return;
    const id = this.bindings[next];
    if (id) this.setActiveSkill(id);
  }

  private castBound(code: string) {
    const id = this.bindings[code];
    if (!id) return;
    this.activeSkillId = id;
    this.castSkill(id);
  }

  private lockFocusFromPad() {
    const target = this.pickFocusTarget() ?? this.dummies[0] ?? null;
    if (!target) return;
    this.focused = true;
    this.lockDummy = target;
    this.focusOrbit = 0;
    this.hint = "Focus · stick strafe";
    this.emit();
  }

  private toggleFocusFromPad() {
    if (this.focused) {
      this.focused = false;
      this.lockDummy = null;
      this.focusOrbit = 0;
      this.hint = "Focus off";
      this.emit();
      return;
    }
    this.lockFocusFromPad();
  }

  private pickFocusTarget(): Dummy | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    let best: Dummy | null = null;
    let bestScore = Infinity;
    for (const d of this.dummies) {
      _v.copy(d.group.position).setY(1.2);
      const along = this.raycaster.ray.direction.dot(_v2.copy(_v).sub(this.raycaster.ray.origin));
      if (along < 0.5) continue;
      const rayDist = this.raycaster.ray.distanceToPoint(_v);
      const dist = this.player.position.distanceTo(_v);
      if (dist > 18 || rayDist > 1.15) continue;
      const score = rayDist * 3 + dist * 0.08;
      if (score < bestScore) {
        bestScore = score;
        best = d;
      }
    }
    if (best) return best;
    this.camera.getWorldDirection(_v);
    _v.y = 0;
    if (_v.lengthSq() < 1e-6) return null;
    _v.normalize();
    bestScore = Infinity;
    for (const d of this.dummies) {
      _v2.copy(d.group.position).sub(this.player.position);
      _v2.y = 0;
      const dist = _v2.length();
      if (dist < 0.6 || dist > 16) continue;
      const dot = _v.dot(_v2.multiplyScalar(1 / dist));
      if (dot < 0.12) continue;
      const score = (1 - dot) * 10 + dist;
      if (score < bestScore) {
        bestScore = score;
        best = d;
      }
    }
    return best;
  }

  private punchCast(skill: SkillDef) {
    const amount =
      skill.kind === "nova" || skill.kind === "ritual" || skill.kind === "portal"
        ? 0.18
        : skill.kind === "slash"
          ? 0.14
          : skill.kind === "beam"
            ? 0.1
            : 0.07;
    this.cameraFeel.punch(amount + skill.impact * 0.018);
    rumble(0.28 + skill.impact * 0.08, 0.1, 55);
  }

  private punchHit(skill: SkillDef) {
    this.cameraFeel.punch(0.05 + skill.impact * 0.016, 3.2, 22);
    this.hitStop = Math.max(this.hitStop, Math.min(0.05, 0.016 + skill.impact * 0.006));
    rumble(0.4 + skill.impact * 0.12, 0.18, 90);
  }

  private syncColliderVis() {
    for (const d of this.dummies) d.collider.visible = this.collidersOn;
    if (this.playerCollider) this.playerCollider.visible = this.collidersOn;
  }

  private rebuildPhysicsBodies() {
    this.physics.resetDummies();
    this.dummies.forEach((d, i) => this.physics.addDummy(i, d.group.position.x, d.group.position.z));
    for (const shot of this.shots) {
      if (shot.active) this.physics.attachShot(shot.slot, shot.pos.x, shot.pos.y, shot.pos.z, shotRadius(shot.skill.size));
    }
    for (const s of this.slashes) {
      if (s.active) this.physics.attachSlash(s);
    }
  }

  private installControlsProbe() {
    window.__controlsTest = {
      getYaw: () => this.yaw,
      getSpeed: () => this.speed,
      setKeys: (codes) => {
        this.keys.clear();
        for (const c of codes) this.keys.add(c);
      },
    };
  }

  private drawCamera(dt: number) {
    _v.set(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw)).multiplyScalar(this.focused ? 0.62 : 0.28);
    if (this.ext?.rig?.shakeOffset) _v.add(this.ext.rig.shakeOffset);
    this.cameraFeel.apply(
      this.camera,
      this.player.position,
      this.camYaw,
      this.camPitch,
      this.focused ? this.camDist * 0.86 : this.camDist,
      this.aimPoint,
      this.speed,
      dt,
      _v,
      this.focused ? 0.42 : 0.12,
    );
  }
}

export type ProjectileAsset = "arrow" | "bolt" | "ice" | "fire" | "spear" | "bullet";
export type ExplosionKind = "fire" | "ice" | "kinetic";
export type SkillKind =
  | "linear"
  | "nova"
  | "cone"
  | "path"
  | "beam"
  | "dash"
  | "buff"
  | "volley"
  | "weapon"
  | "slash"
  | "ritual"
  | "portal";
export type PathKind = "straight" | "arc" | "sine" | "homing";
export type AimMode = "mouse" | "lock" | "height" | "arc" | "beam";
export type School = "fire" | "frost" | "arcane" | "physical" | "nature" | "holy" | "shadow" | "lightning";

export const AIM_MODES: AimMode[] = ["mouse", "lock", "height", "arc", "beam"];

export const AIM_LABEL: Record<AimMode, string> = {
  mouse: "Mouse ground",
  lock: "Dummy lock",
  height: "Free height",
  arc: "Lob / arc",
  beam: "Hitscan beam",
};

export const KIND_LABEL: Record<SkillKind, string> = {
  linear: "Linear",
  nova: "Nova / AOE",
  cone: "Cone",
  path: "Pathing",
  beam: "Beam",
  dash: "Dash",
  buff: "Self buff",
  volley: "Volley",
  weapon: "Weapon",
  slash: "Flying slash",
  ritual: "Ritual / crown",
  portal: "Portal",
};

export const PATH_LABEL: Record<PathKind, string> = {
  straight: "Straight",
  arc: "Arc / lob",
  sine: "Wave",
  homing: "Homing",
};

export const SCHOOL_COLOR: Record<School, string> = {
  fire: "#ff6a2a",
  frost: "#7ee8ff",
  arcane: "#c084fc",
  physical: "#d7c4a3",
  nature: "#86efac",
  holy: "#fde68a",
  shadow: "#a78bfa",
  lightning: "#b8f0ff",
};

export type SkillDef = {
  id: string;
  name: string;
  kind: SkillKind;
  asset: ProjectileAsset;
  color: string;
  length: number;
  trail: number;
  speed: number;
  impact: number;
  force: number;
  size: number;
  explosion: ExplosionKind;
  path: PathKind;
  radius: number;
  cone: number;
  pierce: number;
  count: number;
  school: School;
  book: string;
  desc: string;
};

export const STORAGE_KEY = "grudge-ability-lab-v5";

function skill(
  partial: Partial<SkillDef> & Pick<SkillDef, "id" | "name" | "kind">,
): SkillDef {
  const school = partial.school ?? "physical";
  return {
    asset: "bolt",
    color: SCHOOL_COLOR[school],
    length: 1.3,
    trail: 0.55,
    speed: 28,
    impact: 1.2,
    force: 16,
    size: 0.22,
    explosion: "kinetic",
    path: "straight",
    radius: 3.2,
    cone: 50,
    pierce: 0,
    count: 1,
    school,
    book: "lab",
    desc: "",
    ...partial,
  };
}

export const BOOK_SKILLS: SkillDef[] = [
  skill({
    id: "pyre_crown",
    name: "Pyre Crown",
    kind: "ritual",
    asset: "fire",
    school: "fire",
    explosion: "fire",
    radius: 3.2,
    impact: 2.8,
    desc: "Fire circle — molten crater and a ring of burning blades.",
    book: "sandbox",
  }),
  skill({
    id: "kraken_crown",
    name: "Kraken Crown",
    kind: "ritual",
    school: "shadow",
    radius: 3.5,
    impact: 2.6,
    force: 22,
    desc: "Rift of black water. Eight arms haul out and hammer the centre.",
    book: "sandbox",
  }),
  skill({
    id: "electrical_sphere",
    name: "Electrical Sphere",
    kind: "ritual",
    asset: "bolt",
    school: "lightning",
    radius: 2.4,
    impact: 2.4,
    desc: "Far-cast electric orb on a containment platform, arcs tearing off.",
    book: "sandbox",
  }),
  skill({
    id: "earthen_spire",
    name: "Earthen Spire",
    kind: "ritual",
    school: "physical",
    length: 10,
    radius: 1.6,
    desc: "Linear three.js line-cast. Stone crust, then a tower at the head.",
    book: "sandbox",
  }),
  skill({
    id: "verdant_gate",
    name: "Verdant Gate",
    kind: "portal",
    school: "nature",
    desc: "Portal 1 — standing arch. Stays lit 30s, then the stones come apart.",
    book: "sandbox",
  }),
  skill({
    id: "tidewrought_ring",
    name: "Tidewrought Ring",
    kind: "portal",
    school: "frost",
    desc: "Portal 2 — hoop forged on the floor, hinges up. Breaks after 30s.",
    book: "sandbox",
  }),
  skill({
    id: "fire_portal",
    name: "Fire Portal",
    kind: "portal",
    school: "fire",
    desc: "Portal 3 — scribe-cast black disc in the air. Breaks after 30s.",
    book: "sandbox",
  }),
  skill({
    id: "electric_boost",
    name: "Electric Boost",
    kind: "buff",
    school: "lightning",
    desc: "Buff 1 — cyan corona, charge in the bones.",
    book: "sandbox",
  }),
  skill({
    id: "magic_boost",
    name: "Magic Boost",
    kind: "buff",
    school: "arcane",
    desc: "Buff 2 — violet ribbons. Clarity.",
    book: "sandbox",
  }),
  skill({
    id: "fire_boost",
    name: "Fire Boost",
    kind: "buff",
    school: "fire",
    desc: "Buff 3 — flames on the kit. Might.",
    book: "sandbox",
  }),
  skill({
    id: "q-firebolt",
    name: "Fire Bolt",
    kind: "linear",
    asset: "fire",
    school: "fire",
    explosion: "fire",
    trail: 0.85,
    speed: 28,
    desc: "Linear three.js fire projectile with trail and burst.",
    book: "linear",
  }),
  skill({
    id: "e-iceshard",
    name: "Ice Linear",
    kind: "linear",
    asset: "ice",
    school: "frost",
    explosion: "ice",
    speed: 32,
    size: 0.2,
    desc: "Ice linear attack — fast frost bolt, freeze on hit.",
    book: "linear",
  }),
  skill({
    id: "v-bolt",
    name: "Arc Bolt",
    kind: "linear",
    asset: "bolt",
    school: "lightning",
    speed: 42,
    path: "sine",
    trail: 0.7,
    desc: "Linear three.js lightning that snakes.",
    book: "linear",
  }),
  skill({
    id: "f-fireorb",
    name: "Fire Orb",
    kind: "linear",
    asset: "fire",
    school: "fire",
    explosion: "fire",
    speed: 16,
    impact: 2.2,
    size: 0.46,
    trail: 1,
    desc: "Heavy linear fire orb.",
    book: "linear",
  }),
  skill({
    id: "z-icenova",
    name: "Ice Nova",
    kind: "nova",
    asset: "ice",
    school: "frost",
    explosion: "ice",
    radius: 4.4,
    impact: 3.4,
    speed: 14,
    desc: "Expanding freeze ring.",
    book: "nova",
  }),
  skill({
    id: "lightning_lash",
    name: "Lightning Beam",
    kind: "beam",
    school: "lightning",
    length: 2.4,
    impact: 1.8,
    desc: "Hitscan beam.",
    book: "beam",
  }),
  skill({
    id: "slash",
    name: "Flying Slash",
    kind: "slash",
    asset: "spear",
    school: "physical",
    speed: 26,
    length: 1.8,
    pierce: 5,
    desc: "One Piece air blade — inverse of the swing, linear cut.",
    book: "warrior",
  }),
  skill({
    id: "r-spear",
    name: "War Spear",
    kind: "weapon",
    asset: "spear",
    school: "physical",
    length: 2.2,
    trail: 0.25,
    force: 22,
    pierce: 1,
    desc: "Thrown spear that pierces one dummy.",
    book: "warrior",
  }),
  skill({
    id: "x-arrow",
    name: "War Arrow",
    kind: "weapon",
    asset: "arrow",
    school: "physical",
    speed: 38,
    size: 0.14,
    desc: "Straight arrow from the Warlords bow kit.",
    book: "ranger",
  }),
  skill({
    id: "y-cleave",
    name: "Heroic Cleave",
    kind: "slash",
    asset: "spear",
    school: "physical",
    cone: 70,
    radius: 4.2,
    force: 24,
    pierce: 3,
    desc: "Forward flying slash.",
    book: "warrior",
  }),
  skill({
    id: "n-frostaoe",
    name: "Frost Wave",
    kind: "nova",
    asset: "ice",
    school: "frost",
    explosion: "ice",
    radius: 3.6,
    speed: 11,
    desc: "Ground frost AOE.",
    book: "nova",
  }),
  skill({
    id: "war_cry",
    name: "War Cry",
    kind: "buff",
    school: "physical",
    desc: "Might for 6s — damage and sprint.",
    book: "warrior",
  }),
  skill({
    id: "shield_bash",
    name: "Shield Bash",
    kind: "dash",
    school: "physical",
    radius: 6,
    force: 28,
    impact: 1.6,
    desc: "Dash 6m and knock dummies.",
    book: "warrior",
  }),
  skill({
    id: "cleave",
    name: "Cleave",
    kind: "cone",
    school: "physical",
    cone: 90,
    radius: 3.8,
    desc: "Wide warrior cone.",
    book: "warrior",
  }),
  skill({
    id: "invincible",
    name: "Invincible",
    kind: "buff",
    school: "holy",
    desc: "Barrier + Might.",
    book: "warrior",
  }),
  skill({
    id: "arcane_bolt",
    name: "Arcane Bolt",
    kind: "linear",
    school: "arcane",
    asset: "bolt",
    speed: 34,
    desc: "Mage resource bolt.",
    book: "mage",
  }),
  skill({
    id: "fireball",
    name: "Fireball",
    kind: "path",
    school: "fire",
    asset: "fire",
    path: "arc",
    explosion: "fire",
    speed: 20,
    impact: 2.6,
    size: 0.4,
    desc: "Lobed fireball with ground burst.",
    book: "mage",
  }),
  skill({
    id: "ice_storm",
    name: "Ice Storm",
    kind: "nova",
    school: "frost",
    explosion: "ice",
    radius: 5,
    speed: 10,
    desc: "Blizzard disk from D1 params.",
    book: "mage",
  }),
  skill({
    id: "heal",
    name: "Divine Heal",
    kind: "buff",
    school: "holy",
    desc: "Restore clarity and hp.",
    book: "mage",
  }),
  skill({
    id: "mana_shield",
    name: "Mana Shield",
    kind: "buff",
    school: "arcane",
    desc: "Barrier from mana.",
    book: "mage",
  }),
  skill({
    id: "quick_shot",
    name: "Quick Shot",
    kind: "linear",
    school: "physical",
    asset: "arrow",
    speed: 44,
    size: 0.12,
    desc: "Ranger snap shot.",
    book: "ranger",
  }),
  skill({
    id: "aimed_shot",
    name: "Aimed Shot",
    kind: "path",
    school: "physical",
    asset: "arrow",
    path: "homing",
    speed: 26,
    impact: 2.1,
    desc: "Locks the nearest dummy.",
    book: "ranger",
  }),
  skill({
    id: "poison_arrow",
    name: "Poison Arrow",
    kind: "linear",
    school: "nature",
    asset: "arrow",
    color: "#86efac",
    explosion: "ice",
    desc: "Nature-tipped linear.",
    book: "ranger",
  }),
  skill({
    id: "volley",
    name: "Arrow Volley",
    kind: "volley",
    school: "physical",
    asset: "arrow",
    count: 5,
    speed: 32,
    cone: 28,
    desc: "Five arrows in a fan.",
    book: "ranger",
  }),
  skill({
    id: "evasive_maneuver",
    name: "Evasive Roll",
    kind: "dash",
    school: "physical",
    radius: 5,
    desc: "Short dodge dash.",
    book: "ranger",
  }),
  skill({
    id: "dagger_toss",
    name: "Dagger Toss",
    kind: "path",
    school: "physical",
    asset: "bolt",
    path: "sine",
    speed: 30,
    desc: "Waving thrown dagger.",
    book: "worge",
  }),
  skill({
    id: "natures_grasp",
    name: "Nature's Grasp",
    kind: "buff",
    school: "nature",
    desc: "HoT clarity.",
    book: "worge",
  }),
  skill({
    id: "smite",
    name: "Smite",
    kind: "beam",
    school: "holy",
    desc: "Priest holy bolt, hitscan.",
    book: "priest",
  }),
  skill({
    id: "word_shield",
    name: "Word Shield",
    kind: "buff",
    school: "holy",
    desc: "Absorb barrier.",
    book: "priest",
  }),
  skill({
    id: "sinister",
    name: "Sinister Strike",
    kind: "weapon",
    school: "physical",
    asset: "spear",
    speed: 24,
    desc: "Thief combo builder.",
    book: "thief",
  }),
  skill({
    id: "pistol_shot",
    name: "Pistol Shot",
    kind: "beam",
    school: "physical",
    length: 1.2,
    speed: 50,
    desc: "Ranged interrupt hitscan.",
    book: "thief",
  }),
  skill({
    id: "mortal_strike",
    name: "Mortal Strike",
    kind: "weapon",
    school: "physical",
    impact: 2.2,
    force: 26,
    desc: "Raider two-hand.",
    book: "raider",
  }),
  skill({
    id: "crane_kick",
    name: "Crane Kick",
    kind: "cone",
    school: "nature",
    cone: 40,
    radius: 2.6,
    desc: "Verduror melee splash.",
    book: "verduror",
  }),
  skill({
    id: "soothing_mist",
    name: "Soothing Mist",
    kind: "buff",
    school: "nature",
    desc: "Channeled heal → Clarity.",
    book: "verduror",
  }),
  skill({
    id: "ember_wrath",
    name: "Ember Wrath",
    kind: "nova",
    school: "fire",
    explosion: "fire",
    radius: 4.8,
    desc: "Sword-line fire nova.",
    book: "warrior",
  }),
  skill({
    id: "ground_slam",
    name: "Ground Slam",
    kind: "nova",
    school: "physical",
    radius: 3.4,
    force: 32,
    desc: "Axe AOE slow slam.",
    book: "warrior",
  }),
  skill({
    id: "homing_spark",
    name: "Homing Spark",
    kind: "path",
    school: "arcane",
    path: "homing",
    asset: "bolt",
    speed: 18,
    trail: 0.9,
    desc: "Seeks the closest dummy.",
    book: "lab",
  }),
  skill({
    id: "wave_path",
    name: "Serpent Path",
    kind: "path",
    school: "frost",
    path: "sine",
    asset: "ice",
    speed: 24,
    trail: 0.8,
    desc: "Sine-wave travel. Edit amplitude via length.",
    book: "lab",
  }),
  skill({
    id: "custom",
    name: "Custom Shot",
    kind: "weapon",
    school: "fire",
    asset: "arrow",
    desc: "Your bound T skill. Import a mesh or VFX.",
    book: "lab",
  }),
  skill({
    id: "fire_bending",
    name: "Fire Bending",
    kind: "linear",
    asset: "fire",
    school: "fire",
    explosion: "fire",
    trail: 1,
    speed: 18,
    size: 0.38,
    desc: "Volumetric fire stream along the ground arrow. Unique flame editor.",
    book: "bending",
  }),
  skill({
    id: "water_linear",
    name: "Water Whip",
    kind: "linear",
    asset: "ice",
    school: "frost",
    explosion: "ice",
    trail: 0.9,
    speed: 16,
    desc: "Linear water bending — ocean volume along the aim line.",
    book: "bending",
  }),
  skill({
    id: "earth_line",
    name: "Earth Line",
    kind: "linear",
    school: "physical",
    asset: "bolt",
    speed: 14,
    desc: "Linear earth bending — plates and a tower at the head.",
    book: "bending",
  }),
  skill({
    id: "air_gale",
    name: "Air Gale",
    kind: "linear",
    school: "nature",
    asset: "bolt",
    speed: 22,
    trail: 0.8,
    desc: "Linear air bending — wind volume down the aim line.",
    book: "bending",
  }),
  skill({
    id: "magic_flame",
    name: "Magic Flame",
    kind: "linear",
    asset: "fire",
    school: "fire",
    explosion: "fire",
    trail: 1,
    speed: 24,
    size: 0.28,
    impact: 2.4,
    desc: "Mage flame bolt — additive core, fire trail, ground scorch.",
    book: "mage",
  }),
  skill({
    id: "flintlock",
    name: "Flintlock",
    kind: "linear",
    asset: "bullet",
    school: "physical",
    speed: 52,
    size: 0.08,
    length: 0.55,
    trail: 0.2,
    impact: 1.4,
    desc: "Bullet. Fast linear, tiny trail, kinetic impact.",
    book: "thief",
  }),
  skill({
    id: "frost_lance",
    name: "Frost Lance",
    kind: "linear",
    asset: "ice",
    school: "frost",
    explosion: "ice",
    speed: 26,
    length: 15,
    desc: "Original linear ice — crystal fracture front and a field of spikes.",
    book: "linear",
  }),
  skill({
    id: "storm_lance",
    name: "Storm Lance",
    kind: "linear",
    asset: "bolt",
    school: "lightning",
    speed: 34,
    desc: "Original linear thunder — bolt that travels the ground arrow.",
    book: "linear",
  }),
  skill({
    id: "cinder_fall",
    name: "Cinder Fall",
    kind: "path",
    asset: "fire",
    school: "fire",
    explosion: "fire",
    path: "arc",
    speed: 18,
    desc: "Original meteor — cinder fall along the aim line.",
    book: "linear",
  }),
  skill({
    id: "nova_beam",
    name: "Nova Beam",
    kind: "beam",
    asset: "bolt",
    school: "holy",
    length: 18,
    desc: "Original linear beam — sustained nova ray down the arrow.",
    book: "linear",
  }),
  skill({
    id: "voltaic_snare",
    name: "Voltaic Snare",
    kind: "nova",
    asset: "bolt",
    school: "lightning",
    radius: 3.2,
    desc: "Original far-cast electric snare — circle on the ground, then the cage.",
    book: "linear",
  }),
  skill({
    id: "glacial_crown",
    name: "Glacial Crown",
    kind: "ritual",
    asset: "ice",
    school: "frost",
    explosion: "ice",
    radius: 3.4,
    desc: "Original far-cast ice crown — circle, then the glacier.",
    book: "linear",
  }),
  skill({
    id: "shadow_clones",
    name: "Shadow Clones",
    kind: "ritual",
    school: "shadow",
    desc: "Two silhouettes step out of you, settle, then hunt the nearest marks.",
    book: "samurai",
  }),
  skill({
    id: "blade_storm",
    name: "Floating Blades",
    kind: "volley",
    school: "physical",
    asset: "spear",
    count: 6,
    desc: "Orbiting katanas forge around you, then fly and plant through marks.",
    book: "samurai",
  }),
  skill({
    id: "judgement_fist",
    name: "Judgement",
    kind: "nova",
    school: "shadow",
    radius: 2.2,
    desc: "A seal opens over a mark and a fist comes down through it.",
    book: "samurai",
  }),
];

export const DEFAULT_BINDINGS: Record<string, string> = {
  Digit1: "x-arrow",
  Digit2: "r-spear",
  Digit3: "slash",
  Digit4: "flintlock",
  Digit5: "q-firebolt",
  Digit6: "magic_flame",
  KeyR: "electrical_sphere",
  KeyF: "earthen_spire",
  KeyV: "kraken_crown",
  KeyT: "pyre_crown",
  KeyG: "z-icenova",
  KeyB: "electric_boost",
};

/** Weapon skill bank — sandbox + editor assign any catalog skill onto 1–6. */
export const WEAPON_KEYS = [
  "Digit1",
  "Digit2",
  "Digit3",
  "Digit4",
  "Digit5",
  "Digit6",
] as const;

/** Class ability bank. */
export const CLASS_KEYS = ["KeyR", "KeyF", "KeyV", "KeyT", "KeyG", "KeyB"] as const;

export const PLAY_KEYS = [...WEAPON_KEYS, ...CLASS_KEYS] as const;

export const HOTBAR_KEYS = WEAPON_KEYS;

export function isWeaponKey(code: string) {
  return (WEAPON_KEYS as readonly string[]).includes(code);
}

export function isClassKey(code: string) {
  return (CLASS_KEYS as readonly string[]).includes(code);
}

export function isPlayKey(code: string) {
  return (PLAY_KEYS as readonly string[]).includes(code);
}

export function skillGlyph(name: string) {
  const t = name.replace(/[^A-Za-z]/g, "");
  return (t.slice(0, 1) || "·").toUpperCase();
}

export const KEY_BINDINGS = DEFAULT_BINDINGS;

export function defaultCustomSkill(): SkillDef {
  return structuredClone(BOOK_SKILLS.find((s) => s.id === "custom") ?? BOOK_SKILLS[0]!);
}

export type SkillSave = {
  v: number;
  custom?: SkillDef;
  bindings?: Record<string, string>;
  patches?: Record<string, Partial<SkillDef>>;
};

export function loadSkills(): {
  catalog: SkillDef[];
  custom: SkillDef;
  bindings: Record<string, string>;
} {
  const catalog = BOOK_SKILLS.map((s) => ({ ...s }));
  let custom = defaultCustomSkill();
  let bindings = { ...DEFAULT_BINDINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SkillSave;
      if (parsed.custom?.id) custom = { ...custom, ...parsed.custom, id: "custom" };
      if (parsed.bindings) bindings = { ...bindings, ...parsed.bindings };
      if (parsed.patches) {
        for (const s of catalog) {
          const p = parsed.patches[s.id];
          if (p) Object.assign(s, p, { id: s.id });
        }
      }
    }
  } catch {
    /* keep */
  }
  const idx = catalog.findIndex((s) => s.id === "custom");
  if (idx >= 0) catalog[idx] = custom;
  return { catalog, custom, bindings };
}

export function saveSkillState(state: {
  custom: SkillDef;
  bindings: Record<string, string>;
  catalog: SkillDef[];
}) {
  const patches: Record<string, Partial<SkillDef>> = {};
  for (const s of state.catalog) {
    const base = BOOK_SKILLS.find((b) => b.id === s.id);
    if (!base) continue;
    const diff: Partial<SkillDef> = {};
    (Object.keys(s) as (keyof SkillDef)[]).forEach((k) => {
      if (k === "id") return;
      if (s[k] !== base[k]) (diff as Record<string, unknown>)[k] = s[k];
    });
    if (Object.keys(diff).length) patches[s.id] = diff;
  }
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: 5, custom: state.custom, bindings: state.bindings, patches }),
    );
  } catch {
    /* quota */
  }
}

export function skillById(catalog: SkillDef[], custom: SkillDef, id: string): SkillDef {
  if (id === "custom") return custom;
  return catalog.find((s) => s.id === id) ?? custom;
}

export function keyLabel(code: string): string {
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Key")) return code.slice(3);
  return code;
}

export function bindingForSkill(bindings: Record<string, string>, id: string): string | undefined {
  return Object.entries(bindings).find(([, sid]) => sid === id)?.[0];
}

export function isFarAoe(kind: SkillKind) {
  return kind === "nova" || kind === "ritual" || kind === "portal";
}

export function showsMeshEditor(kind: SkillKind) {
  return (
    kind === "linear" ||
    kind === "weapon" ||
    kind === "path" ||
    kind === "volley" ||
    kind === "slash" ||
    kind === "beam"
  );
}

export type EditorMeterKey =
  | "speed"
  | "length"
  | "trail"
  | "size"
  | "impact"
  | "force"
  | "radius"
  | "cone"
  | "pierce"
  | "count";

export type EditorMeter = {
  k: EditorMeterKey;
  label: string;
  min: number;
  max: number;
  step: number;
};

export function editorMeters(kind: SkillKind): EditorMeter[] {
  switch (kind) {
    case "nova":
    case "ritual":
      return [
        { k: "radius", label: "AOE radius", min: 1, max: 10, step: 0.1 },
        { k: "impact", label: "Impact", min: 0.4, max: 4, step: 0.1 },
        { k: "force", label: "Force", min: 4, max: 40, step: 1 },
        { k: "speed", label: "Expand", min: 6, max: 40, step: 1 },
      ];
    case "portal":
      return [
        { k: "radius", label: "Span", min: 1, max: 8, step: 0.1 },
        { k: "length", label: "Height", min: 0.6, max: 4, step: 0.05 },
        { k: "impact", label: "Break force", min: 0.4, max: 4, step: 0.1 },
      ];
    case "cone":
      return [
        { k: "radius", label: "Reach", min: 1, max: 8, step: 0.1 },
        { k: "cone", label: "Cone °", min: 10, max: 140, step: 1 },
        { k: "force", label: "Force", min: 4, max: 40, step: 1 },
        { k: "impact", label: "Impact", min: 0.4, max: 4, step: 0.1 },
      ];
    case "beam":
      return [
        { k: "length", label: "Beam length", min: 0.5, max: 4, step: 0.05 },
        { k: "size", label: "Width", min: 0.08, max: 0.7, step: 0.02 },
        { k: "impact", label: "Impact", min: 0.4, max: 4, step: 0.1 },
      ];
    case "dash":
      return [
        { k: "radius", label: "Distance", min: 2, max: 12, step: 0.1 },
        { k: "force", label: "Knock", min: 4, max: 40, step: 1 },
      ];
    case "buff":
      return [
        { k: "impact", label: "Potency", min: 0.4, max: 4, step: 0.1 },
        { k: "radius", label: "Aura", min: 0.8, max: 6, step: 0.1 },
      ];
    case "volley":
      return [
        { k: "count", label: "Count", min: 1, max: 8, step: 1 },
        { k: "cone", label: "Fan °", min: 8, max: 90, step: 1 },
        { k: "speed", label: "Speed", min: 6, max: 55, step: 1 },
        { k: "size", label: "Size", min: 0.08, max: 0.7, step: 0.02 },
        { k: "trail", label: "Trail", min: 0, max: 1, step: 0.05 },
      ];
    case "slash":
      return [
        { k: "speed", label: "Speed", min: 8, max: 50, step: 1 },
        { k: "length", label: "Blade length", min: 0.6, max: 3.5, step: 0.05 },
        { k: "pierce", label: "Pierce", min: 0, max: 8, step: 1 },
        { k: "force", label: "Force", min: 4, max: 40, step: 1 },
        { k: "size", label: "Thickness", min: 0.08, max: 0.7, step: 0.02 },
      ];
    default:
      return [
        { k: "speed", label: "Speed", min: 6, max: 55, step: 1 },
        { k: "length", label: "Length / wave", min: 0.3, max: 3, step: 0.05 },
        { k: "trail", label: "Trail", min: 0, max: 1, step: 0.05 },
        { k: "size", label: "Size", min: 0.08, max: 0.7, step: 0.02 },
        { k: "impact", label: "Impact", min: 0.4, max: 4, step: 0.1 },
        { k: "force", label: "Force", min: 4, max: 40, step: 1 },
        { k: "pierce", label: "Pierce", min: 0, max: 5, step: 1 },
      ];
  }
}

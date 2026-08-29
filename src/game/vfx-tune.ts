import { settings as extSettings, DEFAULT_SETTINGS as extDefaults } from "@/ext/config/settings.js";
import { settings as bendSettings, DEFAULT_SETTINGS as bendDefaults } from "@/bending/config/settings.js";
import { settings as linSettings, DEFAULT_SETTINGS as linDefaults } from "@/linear/config/settings.js";
import { settings as samSettings } from "@/samurai/config/settings.js";
import { COLOR_SLOTS, SHADER_PRESETS, type ShaderPreset } from "./color-shaders";

export type TuneKnob = {
  key: string;
  block: string;
  source: "ext" | "bend" | "lin" | "sam";
  label: string;
  min: number;
  max: number;
  step: number;
};

function knobs(
  source: TuneKnob["source"],
  block: string,
  rows: Omit<TuneKnob, "source" | "block">[],
): TuneKnob[] {
  return rows.map((r) => ({ ...r, source, block }));
}

const PYRE = knobs("ext", "pyre", [
  { key: "zoneRadius", label: "AOE radius", min: 1.4, max: 8, step: 0.1 },
  { key: "lifetime", label: "Burn time", min: 1, max: 12, step: 0.1 },
  { key: "speed", label: "Travel", min: 10, max: 80, step: 1 },
  { key: "snapTime", label: "Crater snap", min: 0.05, max: 1.2, step: 0.01 },
]);
const KRAKEN = knobs("ext", "kraken", [
  { key: "zoneRadius", label: "Rift radius", min: 1.6, max: 8, step: 0.1 },
  { key: "lifetime", label: "Hold", min: 1.5, max: 12, step: 0.1 },
  { key: "speed", label: "Travel", min: 10, max: 70, step: 1 },
]);
const ORB = knobs("ext", "electrical", [
  { key: "zoneRadius", label: "Orb radius", min: 0.8, max: 5, step: 0.05 },
  { key: "lifetime", label: "Hold", min: 1, max: 10, step: 0.1 },
  { key: "speed", label: "Travel", min: 12, max: 70, step: 1 },
]);
const EARTH = knobs("ext", "earth", [
  { key: "range", label: "Length", min: 4, max: 24, step: 0.5 },
  { key: "speed", label: "Travel", min: 8, max: 50, step: 1 },
  { key: "lifetime", label: "Stand", min: 1, max: 10, step: 0.1 },
]);
const PORTAL = knobs("ext", "portal", [
  { key: "holdTime", label: "Hold (break)", min: 4, max: 60, step: 1 },
  { key: "gateWidth", label: "Span", min: 1.6, max: 6, step: 0.05 },
  { key: "gateHeight", label: "Height", min: 1.4, max: 5, step: 0.05 },
  { key: "openTime", label: "Open", min: 0.2, max: 2.4, step: 0.05 },
  { key: "closeTime", label: "Break", min: 0.3, max: 3, step: 0.05 },
]);
const AETHER = knobs("ext", "aether", [
  { key: "holdTime", label: "Hold (break)", min: 4, max: 60, step: 1 },
  { key: "ringRadius", label: "Radius", min: 1, max: 4.5, step: 0.05 },
  { key: "openTime", label: "Open", min: 0.15, max: 2, step: 0.05 },
  { key: "closeTime", label: "Break", min: 0.3, max: 3, step: 0.05 },
]);
const FIRE_PORTAL = knobs("ext", "firePortal", [
  { key: "holdTime", label: "Hold (break)", min: 4, max: 60, step: 1 },
  { key: "ringRadius", label: "Radius", min: 0.8, max: 4.2, step: 0.05 },
  { key: "scribeTime", label: "Scribe", min: 0.2, max: 2, step: 0.02 },
  { key: "closeTime", label: "Break", min: 0.3, max: 3, step: 0.05 },
]);
const FIRE_BEND = knobs("bend", "fire", [
  { key: "speed", label: "Speed", min: 4, max: 28, step: 0.5 },
  { key: "flameWidth", label: "Trail width", min: 0.08, max: 0.7, step: 0.01 },
  { key: "headSize", label: "Head", min: 0.8, max: 3.2, step: 0.02 },
  { key: "streamLength", label: "Trail length", min: 2, max: 18, step: 0.2 },
  { key: "flightHeight", label: "Flight height", min: 0.2, max: 2.4, step: 0.05 },
  { key: "glow", label: "Glow", min: 0.4, max: 6, step: 0.05 },
  { key: "explosionSize", label: "Impact size", min: 0.6, max: 8, step: 0.1 },
  { key: "explosionBrightness", label: "Impact flash", min: 0.2, max: 4, step: 0.05 },
  { key: "lifetime", label: "Life", min: 0.8, max: 6, step: 0.1 },
]);
const WATER_BEND = knobs("bend", "water", [
  { key: "speed", label: "Speed", min: 4, max: 28, step: 0.5 },
  { key: "radius", label: "Trail radius", min: 0.04, max: 0.4, step: 0.01 },
  { key: "streamLength", label: "Trail length", min: 2, max: 20, step: 0.2 },
  { key: "height", label: "Flight height", min: 0.2, max: 2.4, step: 0.05 },
  { key: "surge", label: "Surge", min: 0, max: 0.8, step: 0.02 },
  { key: "splashSize", label: "Impact splash", min: 0.6, max: 6, step: 0.1 },
  { key: "splashIntensity", label: "Splash glow", min: 0.1, max: 2, step: 0.05 },
  { key: "rippleSize", label: "Ripple", min: 1, max: 12, step: 0.2 },
  { key: "lifetime", label: "Life", min: 0.8, max: 6, step: 0.1 },
]);
const EARTH_BEND = knobs("bend", "earth", [
  { key: "speed", label: "Speed", min: 4, max: 24, step: 0.5 },
  { key: "crustWidth", label: "Trail crust", min: 0.2, max: 1.6, step: 0.05 },
  { key: "plateSize", label: "Plate size", min: 0.4, max: 2.4, step: 0.05 },
  { key: "towerHeight", label: "Impact spike", min: 1.2, max: 12, step: 0.1 },
  { key: "towerWidth", label: "Spike width", min: 0.3, max: 2, step: 0.05 },
  { key: "towerRocks", label: "Impact rocks", min: 4, max: 32, step: 1 },
  { key: "lifetime", label: "Life", min: 0.8, max: 6, step: 0.1 },
]);
const WIND_BEND = knobs("bend", "wind", [
  { key: "speed", label: "Speed", min: 6, max: 32, step: 0.5 },
  { key: "ribbonWidth", label: "Trail width", min: 0.4, max: 4, step: 0.05 },
  { key: "ribbonLength", label: "Trail length", min: 4, max: 36, step: 0.5 },
  { key: "spiralRadius", label: "Spiral", min: 0.2, max: 2.4, step: 0.05 },
  { key: "tornadoHeight", label: "Impact funnel", min: 2, max: 14, step: 0.1 },
  { key: "tornadoRadius", label: "Funnel radius", min: 0.6, max: 5, step: 0.05 },
  { key: "burstIntensity", label: "Impact burst", min: 0.3, max: 3, step: 0.05 },
  { key: "lifetime", label: "Life", min: 0.8, max: 6, step: 0.1 },
]);
const BOOST = knobs("ext", "boost", [{ key: "duration", label: "Duration", min: 4, max: 30, step: 0.5 }]);
const MAGIC = knobs("ext", "magic", [{ key: "duration", label: "Duration", min: 4, max: 30, step: 0.5 }]);
const FIREBUFF = knobs("ext", "fire", [{ key: "duration", label: "Duration", min: 4, max: 30, step: 0.5 }]);
const ICE_LIN = knobs("lin", "ice", [
  { key: "range", label: "Length", min: 4, max: 28, step: 0.5 },
  { key: "speed", label: "Travel", min: 8, max: 50, step: 1 },
  { key: "lifetime", label: "Stand", min: 1, max: 10, step: 0.1 },
  { key: "width", label: "Width", min: 0.6, max: 5, step: 0.05 },
  { key: "height", label: "Height", min: 0.8, max: 6, step: 0.05 },
]);
const THUNDER_LIN = knobs("lin", "thunder", [
  { key: "range", label: "Length", min: 4, max: 28, step: 0.5 },
  { key: "speed", label: "Travel", min: 10, max: 70, step: 1 },
  { key: "lifetime", label: "Life", min: 0.6, max: 8, step: 0.1 },
]);
const METEOR_LIN = knobs("lin", "meteor", [
  { key: "range", label: "Length", min: 4, max: 28, step: 0.5 },
  { key: "speed", label: "Travel", min: 8, max: 40, step: 1 },
  { key: "zoneRadius", label: "Impact", min: 1, max: 6, step: 0.1 },
]);
const BEAM_LIN = knobs("lin", "beam", [
  { key: "range", label: "Length", min: 6, max: 32, step: 0.5 },
  { key: "lifetime", label: "Hold", min: 0.4, max: 6, step: 0.05 },
]);
const SNARE_LIN = knobs("lin", "snare", [
  { key: "zoneRadius", label: "Cage", min: 1.2, max: 6, step: 0.1 },
  { key: "lifetime", label: "Hold", min: 1, max: 10, step: 0.1 },
]);
const GLACIER_LIN = knobs("lin", "glacier", [
  { key: "zoneRadius", label: "Crown", min: 1.4, max: 7, step: 0.1 },
  { key: "lifetime", label: "Stand", min: 1.2, max: 12, step: 0.1 },
]);
const SHADOW_SAM = knobs("sam", "shadowCharacter", [
  { key: "offset", label: "Step out", min: 0.6, max: 3.2, step: 0.05 },
  { key: "emerge", label: "Emerge", min: 0.12, max: 1.6, step: 0.02 },
]);
const BLADE_SAM = knobs("sam", "flight", [{ key: "max", label: "Blades", min: 1, max: 8, step: 1 }]);
const JUDGE_SAM = knobs("sam", "judgement", [{ key: "height", label: "Seal height", min: 1.6, max: 6, step: 0.1 }]);

const EXT_MAP: Record<string, TuneKnob[]> = {
  pyre: PYRE,
  kraken: KRAKEN,
  electrical: ORB,
  earth: EARTH,
  portal: PORTAL,
  aether: AETHER,
  firePortal: FIRE_PORTAL,
  boost: BOOST,
  magic: MAGIC,
  firebuff: FIREBUFF,
};
const BEND_MAP: Record<string, TuneKnob[]> = { fire: FIRE_BEND, water: WATER_BEND, earth: EARTH_BEND, wind: WIND_BEND };
const LIN_MAP: Record<string, TuneKnob[]> = {
  ice: ICE_LIN,
  thunder: THUNDER_LIN,
  meteor: METEOR_LIN,
  beam: BEAM_LIN,
  snare: SNARE_LIN,
  glacier: GLACIER_LIN,
};
const SAM_MAP: Record<string, TuneKnob[]> = { shadows: SHADOW_SAM, blades: BLADE_SAM, judgement: JUDGE_SAM };

export type KitMode = "sandbox" | "bending" | "shot" | "linear" | "samurai";

export function knobsFor(mode: KitMode, element: string): TuneKnob[] {
  if (mode === "bending") return BEND_MAP[element] ?? FIRE_BEND;
  if (mode === "linear") return LIN_MAP[element] ?? ICE_LIN;
  if (mode === "samurai") return SAM_MAP[element] ?? SHADOW_SAM;
  return EXT_MAP[element] ?? PYRE;
}

function bagOf(source: TuneKnob["source"], block: string): Record<string, unknown> | null {
  const root =
    source === "ext" ? extSettings : source === "bend" ? bendSettings : source === "lin" ? linSettings : samSettings;
  const bag = (root as Record<string, unknown>)[block];
  if (bag && typeof bag === "object") return bag as Record<string, unknown>;
  return null;
}

function defaultsOf(source: TuneKnob["source"]): Record<string, unknown> | null {
  if (source === "bend") return bendDefaults as Record<string, unknown>;
  if (source === "lin") return linDefaults as Record<string, unknown>;
  if (source === "ext") return extDefaults as Record<string, unknown>;
  return null;
}

export function readTune(knob: TuneKnob): number {
  const bag = bagOf(knob.source, knob.block);
  if (knob.source === "sam" && knob.block === "flight" && knob.key === "max") {
    const blades = (bag as { blades?: { max?: number } } | null)?.blades;
    return typeof blades?.max === "number" ? blades.max : 6;
  }
  const v = bag?.[knob.key];
  return typeof v === "number" ? v : 0;
}

export function writeTune(knob: TuneKnob, value: number) {
  const bag = bagOf(knob.source, knob.block);
  if (!bag) return;
  if (knob.source === "sam" && knob.block === "flight" && knob.key === "max") {
    const blades = (bag as { blades?: { max?: number } }).blades;
    if (blades) blades.max = value;
    return;
  }
  bag[knob.key] = value;
}

export function snapshotTunes(mode: KitMode, element: string) {
  return knobsFor(mode, element).map((k) => ({ ...k, value: readTune(k) }));
}

export function snapshotColors(source: TuneKnob["source"], block: string) {
  const bag = bagOf(source, block);
  const slots = COLOR_SLOTS[block] ?? [];
  return slots.map((s) => ({
    key: s.key,
    label: s.label,
    value: typeof bag?.[s.key] === "string" ? (bag[s.key] as string) : "#ffffff",
  }));
}

export function writeColor(source: TuneKnob["source"], block: string, key: string, hex: string) {
  const bag = bagOf(source, block);
  if (bag) bag[key] = hex;
}

export function applyShaderPreset(source: TuneKnob["source"], block: string, preset: ShaderPreset) {
  const bag = bagOf(source, block);
  if (!bag) return;
  const slots = COLOR_SLOTS[block] ?? [];
  const src = Object.values(preset.colors);
  if (preset.block === block) {
    for (const [k, v] of Object.entries(preset.colors)) bag[k] = v;
    return;
  }
  slots.forEach((slot, i) => {
    bag[slot.key] = src[i] ?? src[src.length - 1] ?? bag[slot.key];
  });
}

export function resetShaderBlock(source: TuneKnob["source"], block: string) {
  const bag = bagOf(source, block);
  const defs = defaultsOf(source)?.[block] as Record<string, unknown> | undefined;
  if (!bag || !defs) return;
  for (const k of Object.keys(defs)) {
    if (typeof defs[k] === "number" || typeof defs[k] === "string") bag[k] = defs[k];
  }
}

export function presetsFor(mode: KitMode, element: string): ShaderPreset[] {
  const kit = mode === "bending" ? "bend" : mode === "linear" ? "lin" : "ext";
  const match = SHADER_PRESETS.filter((p) => p.kit === kit && p.block === element);
  return match.length ? [...match, ...SHADER_PRESETS.filter((p) => p !== match[0])] : SHADER_PRESETS;
}

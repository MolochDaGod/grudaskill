import { settings as extSettings } from "@/ext/config/settings.js";
import { settings as bendSettings } from "@/bending/config/settings.js";
import { settings as linSettings } from "@/linear/config/settings.js";
import { settings as samSettings } from "@/samurai/config/settings.js";

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
  { key: "flameWidth", label: "Width", min: 0.08, max: 0.7, step: 0.01 },
  { key: "headSize", label: "Head", min: 0.8, max: 3.2, step: 0.02 },
  { key: "streamLength", label: "Trail length", min: 2, max: 18, step: 0.2 },
  { key: "glow", label: "Glow", min: 0.4, max: 6, step: 0.05 },
  { key: "lifetime", label: "Life", min: 0.8, max: 6, step: 0.1 },
]);

const WATER_BEND = knobs("bend", "water", [
  { key: "speed", label: "Speed", min: 4, max: 28, step: 0.5 },
  { key: "height", label: "Height", min: 0.2, max: 2.4, step: 0.05 },
  { key: "surge", label: "Surge", min: 0, max: 0.8, step: 0.02 },
  { key: "lifetime", label: "Life", min: 0.8, max: 6, step: 0.1 },
]);

const EARTH_BEND = knobs("bend", "earth", [
  { key: "speed", label: "Speed", min: 4, max: 24, step: 0.5 },
  { key: "lifetime", label: "Life", min: 0.8, max: 6, step: 0.1 },
]);

const WIND_BEND = knobs("bend", "wind", [
  { key: "speed", label: "Speed", min: 6, max: 32, step: 0.5 },
  { key: "lifetime", label: "Life", min: 0.8, max: 6, step: 0.1 },
]);

const BOOST = knobs("ext", "boost", [
  { key: "duration", label: "Duration", min: 4, max: 30, step: 0.5 },
]);
const MAGIC = knobs("ext", "magic", [
  { key: "duration", label: "Duration", min: 4, max: 30, step: 0.5 },
]);
const FIREBUFF = knobs("ext", "fire", [
  { key: "duration", label: "Duration", min: 4, max: 30, step: 0.5 },
]);

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
const BLADE_SAM = knobs("sam", "flight", [
  { key: "max", label: "Blades", min: 1, max: 8, step: 1 },
]);
const JUDGE_SAM = knobs("sam", "judgement", [
  { key: "height", label: "Seal height", min: 1.6, max: 6, step: 0.1 },
]);

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

const BEND_MAP: Record<string, TuneKnob[]> = {
  fire: FIRE_BEND,
  water: WATER_BEND,
  earth: EARTH_BEND,
  wind: WIND_BEND,
};

const LIN_MAP: Record<string, TuneKnob[]> = {
  ice: ICE_LIN,
  thunder: THUNDER_LIN,
  meteor: METEOR_LIN,
  beam: BEAM_LIN,
  snare: SNARE_LIN,
  glacier: GLACIER_LIN,
};

const SAM_MAP: Record<string, TuneKnob[]> = {
  shadows: SHADOW_SAM,
  blades: BLADE_SAM,
  judgement: JUDGE_SAM,
};

export type KitMode = "sandbox" | "bending" | "shot" | "linear" | "samurai";

export function knobsFor(mode: KitMode, element: string): TuneKnob[] {
  if (mode === "bending") return BEND_MAP[element] ?? FIRE_BEND;
  if (mode === "linear") return LIN_MAP[element] ?? ICE_LIN;
  if (mode === "samurai") return SAM_MAP[element] ?? SHADOW_SAM;
  return EXT_MAP[element] ?? PYRE;
}

function bagOf(source: TuneKnob["source"], block: string): Record<string, unknown> | null {
  const root =
    source === "ext"
      ? extSettings
      : source === "bend"
        ? bendSettings
        : source === "lin"
          ? linSettings
          : samSettings;
  const bag = (root as Record<string, unknown>)[block];
  if (bag && typeof bag === "object") return bag as Record<string, unknown>;
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

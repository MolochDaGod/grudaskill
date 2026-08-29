import type { SkillDef, ProjectileAsset, SkillKind } from "./skills";

/** CDN clips under assets.grudge-studio.com/models/grudge6/anims/*.glb */
export const WEAPON_CLIPS = ["slash", "shoot", "bow", "staff", "spear", "gun", "fire", "magic"] as const;
export const CORE_SHOTS = ["attack", "cast"] as const;
export const SHOT_CLIPS = [...CORE_SHOTS, ...WEAPON_CLIPS] as const;

export type ShotClip = (typeof SHOT_CLIPS)[number];

export type WeaponClass = "sword" | "bow" | "spear" | "staff" | "gun" | "magic";

export function weaponClass(asset: ProjectileAsset, kind?: SkillKind): WeaponClass {
  if (asset === "arrow") return "bow";
  if (asset === "spear") return "spear";
  if (asset === "bullet") return "gun";
  if (asset === "fire" || asset === "ice" || asset === "bolt") return kind === "slash" ? "sword" : "staff";
  if (kind === "buff" || kind === "ritual" || kind === "portal") return "magic";
  return "sword";
}

/** Primary clip, then fallbacks already on the mixer. */
export function clipsForClass(cls: WeaponClass): ShotClip[] {
  switch (cls) {
    case "bow":
      return ["bow", "shoot", "attack"];
    case "spear":
      return ["spear", "attack"];
    case "staff":
      return ["staff", "cast", "magic"];
    case "gun":
      return ["gun", "shoot", "attack"];
    case "magic":
      return ["magic", "cast", "fire"];
    default:
      return ["slash", "attack"];
  }
}

export function clipForSkill(skill: SkillDef): ShotClip {
  if (skill.kind === "buff" || skill.kind === "ritual" || skill.kind === "portal" || skill.kind === "nova") {
    return pick(["magic", "cast", "fire"]);
  }
  if (skill.kind === "beam" || skill.kind === "path") return pick(["staff", "cast"]);
  if (skill.kind === "slash") return pick(["slash", "attack"]);
  const cls = weaponClass(skill.asset, skill.kind);
  if (cls === "staff") {
    if (skill.school === "fire" || skill.asset === "fire") return pick(["fire", "staff", "cast"]);
    return pick(["staff", "cast", "magic"]);
  }
  return clipsForClass(cls)[0]!;
}

function pick(names: ShotClip[]): ShotClip {
  return names[0]!;
}

export type AnimQueue = {
  playing: string | null;
  pending: string[];
};

export function makeAnimQueue(): AnimQueue {
  return { playing: null, pending: [] };
}

/** Buffer one overlay. Same clip already playing is ignored (no restart jitter). */
export function enqueueShot(q: AnimQueue, clip: string) {
  if (q.playing === clip || q.pending[q.pending.length - 1] === clip) return;
  if (q.pending.length >= 2) q.pending[q.pending.length - 1] = clip;
  else q.pending.push(clip);
}

export function takeShot(q: AnimQueue): string | null {
  if (q.playing) return null;
  const next = q.pending.shift() ?? null;
  q.playing = next;
  return next;
}

export function releaseShot(q: AnimQueue, clip: string) {
  if (q.playing === clip) q.playing = null;
}

export const FLEET = {
  vfxApi: "https://grudge-vfx-api.grudge.workers.dev",
  vfxAssets: "https://vfx.grudge.studio/assets",
  cdn: "https://assets.grudge-studio.com",
  github: "https://molochdagod.github.io/ObjectStore",
  objectStore: "https://objectstore.grudge-studio.com/api/v1",
  d1Assets: "https://api.grudge-studio.com/assets",
} as const;

export type VfxEntry = {
  id: string;
  name: string;
  category: string;
  pack?: string;
  vfx?: string;
  colors?: { primary?: string; secondary?: string };
  tags?: string[];
  style?: string;
};

export type D1SpellParams = Record<string, Record<string, number | string>>;

export type FleetSnapshot = {
  d1: D1SpellParams;
  effects: VfxEntry[];
  loaded: boolean;
  error?: string;
};

const CDN_MODELS = {
  warlord: `${FLEET.cdn}/models/characters/kaykit/Barbarian.glb`,
  dummy: `${FLEET.cdn}/models/characters/kaykit/Knight.glb`,
  ranger: `${FLEET.cdn}/models/characters/kaykit/Ranger.glb`,
  arrow: `${FLEET.cdn}/models/weapons/bow/_arrow_b_1.glb`,
  bow: `${FLEET.cdn}/models/weapons/bow/Bow.glb`,
  axe: `${FLEET.cdn}/models/weapons/axe/Axe.glb`,
} as const;

export const MODEL_URLS = CDN_MODELS;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return (await res.json()) as T;
}

export async function loadFleet(): Promise<FleetSnapshot> {
  const snap: FleetSnapshot = { d1: {}, effects: [], loaded: false };
  const jobs = [
    getJson<{ ok: boolean; spellParams?: D1SpellParams; storage?: string }>(
      `${FLEET.vfxApi}/api/spells`,
    )
      .then((r) => {
        snap.d1 = r.spellParams ?? {};
      })
      .catch((e: Error) => {
        snap.error = e.message;
      }),
    getJson<{ effects?: VfxEntry[] }>("/api/vfx-catalog")
      .then((r) => {
        snap.effects = (r.effects ?? []).filter((e) => e.id && e.id !== "shared_guy");
      })
      .catch((e: Error) => {
        snap.error = e.message;
      }),
  ];
  await Promise.all(jobs);
  snap.loaded = true;
  return snap;
}

export function vfxJsonUrl(entry: VfxEntry): string | null {
  if (!entry.vfx) return null;
  return `${FLEET.vfxAssets}/${entry.vfx}`;
}

export const SKILL_VFX: Record<string, { fly: string; hit: string; cast?: string }> = {
  "q-firebolt": {
    fly: "elemental_magic_vfx_fire_projectile_01",
    hit: "hit_vfx_big_impact_01",
    cast: "elemental_magic_vfx_fire_cast_01",
  },
  "e-iceshard": {
    fly: "magic_projectile_mprojectile_basic_vfx_02",
    hit: "slash_frost",
    cast: "status_vfx_status_shatter",
  },
  "r-spear": {
    fly: "magic_projectile_mprojectile_javelin_vfx_01",
    hit: "hit_vfx_impact_01",
  },
  "f-fireorb": {
    fly: "flame_vfx_basic_fire_01",
    hit: "elemental_magic_vfx_fire_area_01",
    cast: "elemental_magic_vfx_fire_cast_01",
  },
  "v-bolt": {
    fly: "electric_vfx_zap_lightning_01",
    hit: "electric_vfx_ball_lightning_01",
  },
  "x-arrow": {
    fly: "magic_projectile_mprojectile_javelin_vfx_02",
    hit: "hit_vfx_hit_01",
  },
  "z-icenova": {
    fly: "magic_projectile_mprojectile_wave_vfx_01",
    hit: "slash_frost",
  },
  custom: {
    fly: "elemental_magic_vfx_fire_projectile_01",
    hit: "hit_vfx_big_impact_02",
  },
  "y-cleave": {
    fly: "slash_fire",
    hit: "hit_vfx_big_impact_01",
  },
  "n-frostaoe": {
    fly: "magic_projectile_mprojectile_wave_vfx_02",
    hit: "slash_frost",
  },
};

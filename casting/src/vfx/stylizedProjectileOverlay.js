/**
 * Stylized Projectiles overlay on SkillProjectileSystem.
 * Orbs stay orb-*.glb. This pack is trail / head / hit textures only.
 * Catalog: ObjectStore api/v1/stylized-projectiles.json (VFX-*).
 */
import {
  AdditiveBlending,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RepeatWrapping,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TextureLoader
} from 'three';

export const STYLIZED_VFX_BASE = './models/vfx/stylized-projectiles';

const LOOKS = Object.freeze({
  card: { id: 'styproj.card', vfxRef: 'VFX-STY-CARD', head: 'Card01.png', trail: 'Trail01.png', hit: 'Glow01.png', muzzle: 'Flash01.png', spin: 5, headSize: 0.72, trailLen: 1.7, trailWidth: 0.32 },
  shadow: { id: 'styproj.shadow', vfxRef: 'VFX-STY-SHADOW', head: 'Mask01.png', trail: 'Trail08.png', hit: 'Smoke_3.png', muzzle: 'Flare01.png', spin: 0, headSize: 0.82, trailLen: 2.0, trailWidth: 0.36 },
  triangle: { id: 'styproj.triangle', vfxRef: 'VFX-STY-TRIANGLE', head: 'Shape01.png', trail: 'Trail04.png', hit: 'Flash01.png', muzzle: 'Flash01.png', spin: 10, headSize: 0.5, trailLen: 1.55, trailWidth: 0.24 },
  heart: { id: 'styproj.heart', vfxRef: 'VFX-STY-HEART', head: 'Glow01.png', trail: 'Trail07.png', hit: 'Flare01.png', muzzle: 'Glow01.png', spin: 1.2, headSize: 0.78, trailLen: 1.8, trailWidth: 0.34 },
  leaf: { id: 'styproj.leaf', vfxRef: 'VFX-STY-LEAF', head: 'Leaf_1.png', trail: 'Trail06.png', hit: 'Smoke_3.png', muzzle: 'Flare01.png', spin: 7, headSize: 0.58, trailLen: 1.7, trailWidth: 0.28 },
  diamond: { id: 'styproj.diamond', vfxRef: 'VFX-STY-DIAMOND', head: 'Shape02.png', trail: 'Trail02.png', hit: 'Snowflakes_1.png', muzzle: 'Glow01.png', spin: 12, headSize: 0.52, trailLen: 1.85, trailWidth: 0.26 },
  diamond2: { id: 'styproj.diamond2', vfxRef: 'VFX-STY-DIAMOND2', head: 'Shape02-hollow.png', trail: 'Trail05.png', hit: 'Snow.png', muzzle: 'Glow01.png', spin: 9, headSize: 0.62, trailLen: 1.6, trailWidth: 0.3 },
  angelic: { id: 'styproj.angelic', vfxRef: 'VFX-STY-ANGELIC', head: 'Flare01.png', trail: 'Trail09.png', hit: 'Glow01.png', muzzle: 'Flare01.png', spin: 2, headSize: 0.88, trailLen: 2.0, trailWidth: 0.38 },
  laser: { id: 'styproj.laser', vfxRef: 'VFX-STY-LASER', head: 'Thin01.png', trail: 'Trail01.png', hit: 'Flash01.png', muzzle: 'Flash01.png', spin: 0, headSize: 0.38, trailLen: 2.45, trailWidth: 0.16 },
  laser2: { id: 'styproj.laser2', vfxRef: 'VFX-STY-LASER2', head: 'Thin02.png', trail: 'Trail02.png', hit: 'Lightning01.png', muzzle: 'Flash01.png', spin: 0, headSize: 0.34, trailLen: 2.6, trailWidth: 0.14 },
  dagger: { id: 'styproj.dagger', vfxRef: 'VFX-STY-DAGGER', head: 'Dagger.png', trail: 'Trail04.png', hit: 'Slash01.png', muzzle: 'Flash01.png', spin: 14, headSize: 0.48, trailLen: 1.45, trailWidth: 0.2 },
  dagger2: { id: 'styproj.dagger2', vfxRef: 'VFX-STY-DAGGER2', head: 'Dagger.png', trail: 'Trail08.png', hit: 'Slash02.png', muzzle: 'Flash01.png', spin: 16, headSize: 0.48, trailLen: 1.55, trailWidth: 0.2 },
  frost: { id: 'styproj.frost', vfxRef: 'VFX-STY-FROST', head: 'Snowflakes_1.png', trail: 'Trail05.png', hit: 'Glow01.png', muzzle: 'Glow01.png', spin: 3, headSize: 0.74, trailLen: 1.75, trailWidth: 0.32 },
  flower: { id: 'styproj.flower', vfxRef: 'VFX-STY-FLOWER', head: 'Flower.png', trail: 'Trail06.png', hit: 'Leaf_4.png', muzzle: 'Flare01.png', spin: 2.4, headSize: 0.64, trailLen: 1.5, trailWidth: 0.28 },
  star: { id: 'styproj.star', vfxRef: 'VFX-STY-STAR', head: 'Star_1.png', trail: 'Trail09.png', hit: 'Flare01.png', muzzle: 'Glow01.png', spin: 8, headSize: 0.68, trailLen: 1.9, trailWidth: 0.3 },
  elecshadow: { id: 'styproj.electric_shadow', vfxRef: 'VFX-STY-ELECSHADOW', head: 'Lightning01.png', trail: 'Trail08.png', hit: 'Flash01.png', muzzle: 'Flash01.png', spin: 0, headSize: 0.86, trailLen: 2.1, trailWidth: 0.28 },
  electric: { id: 'styproj.electric', vfxRef: 'VFX-STY-ELECTRIC', head: 'Lightning01.png', trail: 'Trail02.png', hit: 'Flash01.png', muzzle: 'Flash01.png', spin: 0, headSize: 0.9, trailLen: 2.3, trailWidth: 0.26 },
  shuriken: { id: 'styproj.shuriken', vfxRef: 'VFX-STY-SHURIKEN', head: 'Shape03.png', trail: 'Trail04.png', hit: 'Slash01.png', muzzle: 'Flash01.png', spin: 20, headSize: 0.5, trailLen: 1.4, trailWidth: 0.22 },
  smoke: { id: 'styproj.smoke', vfxRef: 'VFX-STY-SMOKE', head: 'Smoke_1.png', trail: 'Trail09.png', hit: 'Smoke_3.png', muzzle: 'Smoke_2.png', spin: 0, headSize: 0.92, trailLen: 1.55, trailWidth: 0.4 },
  arrow: { id: 'styproj.arrow', vfxRef: 'VFX-STY-ARROW', head: 'Arrow01.png', trail: 'Trail04.png', hit: 'Slash01.png', muzzle: 'Flash01.png', spin: 0, headSize: 0.7, trailLen: 1.9, trailWidth: 0.16 }
});

const BY_SKILL = Object.freeze({
  staff_arcane_bolt: LOOKS.card,
  tome_arcane_burst: LOOKS.card,
  t0_tome_practice_cantrip: LOOKS.card,
  staff_void_bolt: LOOKS.shadow,
  gun_shadow_shot: LOOKS.shadow,
  gun_crimson_blast: LOOKS.shadow,
  bow_phantom_arrows: LOOKS.shadow,
  staff_arcane_missile: LOOKS.triangle,
  t0_wand_arcane_ping: LOOKS.triangle,
  staff_holy_light: LOOKS.heart,
  staff_radiant_heal: LOOKS.heart,
  t0_tome_minor_heal: LOOKS.heart,
  staff_natures_fury: LOOKS.leaf,
  t0_staff_vine_lash: LOOKS.leaf,
  bow_poison_arrow: LOOKS.leaf,
  staff_frost_bolt: LOOKS.diamond,
  t0_wand_frost_spark: LOOKS.diamond,
  staff_ice_nova: LOOKS.diamond2,
  staff_glacial_shield: LOOKS.diamond2,
  staff_crusaders_light: LOOKS.angelic,
  staff_retribution: LOOKS.angelic,
  staff_fire_bolt: LOOKS.laser,
  staff_flame_wave: LOOKS.laser,
  gun_explosive_round: LOOKS.laser,
  gun_flame_burst: LOOKS.laser,
  gun_hellfire_barrage: LOOKS.laser,
  gun_demon_blast: LOOKS.laser,
  staff_chain_lightning: LOOKS.laser2,
  staff_storm_call: LOOKS.laser2,
  gun_grudge_shot: LOOKS.laser2,
  gun_sniper_round: LOOKS.laser2,
  gun_cannon_execute: LOOKS.laser2,
  dagger_crimson_stab: LOOKS.dagger,
  spear_javelin: LOOKS.dagger,
  gs_giant_reach: LOOKS.dagger,
  dagger_phantom_dash: LOOKS.dagger2,
  dagger_shadow_stab: LOOKS.dagger2,
  staff_blizzard: LOOKS.frost,
  staff_absolute_zero: LOOKS.frost,
  t0_staff_healing_sprout: LOOKS.flower,
  staff_divine_wave: LOOKS.star,
  staff_holy_beacon: LOOKS.star,
  spear_phantom: LOOKS.elecshadow,
  staff_thundergods_judgment: LOOKS.electric,
  staff_thunder_cataclysm: LOOKS.electric,
  dagger_raging_blades: LOOKS.shuriken,
  t0_wand_practice_bolt: LOOKS.smoke,
  t0_bow_practice_shot: LOOKS.arrow,
  t0_bow_pinning_arrow: LOOKS.arrow,
  t0_bow_rapid_fire: LOOKS.arrow,
  bow_quick_shot: LOOKS.arrow,
  bow_multishot: LOOKS.arrow,
  bow_piercing: LOOKS.arrow
});

const BY_ELEMENT = Object.freeze({
  fire: LOOKS.laser,
  frost: LOOKS.diamond,
  ice: LOOKS.diamond,
  nature: LOOKS.leaf,
  holy: LOOKS.heart,
  shadow: LOOKS.shadow,
  lightning: LOOKS.electric,
  storm: LOOKS.electric,
  arcane: LOOKS.card,
  physical: LOOKS.arrow
});

function fromPatterns(id, element) {
  const s = String(id || '');
  if (/bow_|_arrow|quick_shot|multishot|piercing|pinning/.test(s)) return LOOKS.arrow;
  if (/gun_|sniper|cannon/.test(s)) {
    if (element === 'fire') return LOOKS.laser;
    if (element === 'shadow') return LOOKS.shadow;
    return LOOKS.laser2;
  }
  if (/javelin|giant_reach/.test(s)) return LOOKS.dagger;
  if (/frost|ice|glacial|blizzard|spark/.test(s)) return LOOKS.diamond;
  if (/holy|radiant|heal|beacon|divine|crusader/.test(s)) return LOOKS.heart;
  if (/nature|vine|leaf|poison|sprout/.test(s)) return LOOKS.leaf;
  if (/lightning|thunder|storm/.test(s)) return LOOKS.electric;
  if (/fire|flame|inferno|meteor|hell/.test(s)) return LOOKS.laser;
  if (/shadow|void|phantom/.test(s)) return LOOKS.shadow;
  if (/arcane|wand|cantrip|card/.test(s)) return LOOKS.card;
  return null;
}

export function overlayForSkill(skill) {
  if (!skill) return null;
  if (skill.overlay?.head || skill.overlay?.trail) return skill.overlay;
  const id = skill.id || skill.catalogSkillId;
  if (id && BY_SKILL[id]) return BY_SKILL[id];
  const el = String(skill.element || skill.labElement || skill.damageType || '').toLowerCase();
  return fromPatterns(id, el) || BY_ELEMENT[el] || BY_ELEMENT.arcane;
}

const _loader = new TextureLoader();
const _tex = new Map();

export function loadStylizedTex(name) {
  if (!name) return Promise.resolve(null);
  if (_tex.has(name)) return Promise.resolve(_tex.get(name));
  return new Promise((resolve) => {
    _loader.load(
      `${STYLIZED_VFX_BASE}/${name}`,
      (t) => {
        t.colorSpace = SRGBColorSpace;
        t.wrapS = RepeatWrapping;
        t.wrapT = RepeatWrapping;
        t.needsUpdate = true;
        _tex.set(name, t);
        resolve(t);
      },
      undefined,
      () => resolve(null)
    );
  });
}

export async function attachOverlayToMesh(mesh, overlay, color) {
  if (!mesh || !overlay) return {};
  const [trailMap, headMap] = await Promise.all([
    loadStylizedTex(overlay.trail),
    loadStylizedTex(overlay.head)
  ]);
  const bits = {};
  const tw = overlay.trailWidth || 0.28;
  const tl = overlay.trailLen || 1.5;
  if (trailMap) {
    const mat = new MeshBasicMaterial({
      map: trailMap,
      color: color ?? 0xffffff,
      transparent: true,
      opacity: 0.94,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
    const ribbon = new Mesh(new PlaneGeometry(tw, tl), mat);
    ribbon.rotation.x = Math.PI / 2;
    ribbon.position.set(0, 0.02, -tl * 0.42);
    ribbon.name = 'sty-trail';
    mesh.add(ribbon);
    bits.trail = ribbon;
  }
  if (headMap) {
    const mat = new SpriteMaterial({
      map: headMap,
      color: color ?? 0xffffff,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
    const head = new Sprite(mat);
    const hs = overlay.headSize || 0.7;
    head.scale.set(hs, hs, 1);
    head.name = 'sty-head';
    head.userData.spin = overlay.spin || 0;
    mesh.add(head);
    bits.head = head;
  }
  return bits;
}

export async function spawnOverlayHit(scene, at, overlay, color) {
  if (!scene || !overlay?.hit) return null;
  const map = await loadStylizedTex(overlay.hit);
  if (!map) return null;
  const mat = new SpriteMaterial({
    map,
    color: color ?? 0xffffff,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  const s = new Sprite(mat);
  s.scale.set(1.2, 1.2, 1);
  s.position.copy(at);
  s.name = 'sty-hit';
  scene.add(s);
  const born = performance.now();
  const tick = () => {
    const k = 1 - (performance.now() - born) / 280;
    if (k <= 0) {
      scene.remove(s);
      mat.dispose();
      return;
    }
    s.scale.setScalar(1.2 + (1 - k) * 1.1);
    mat.opacity = k;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return s;
}

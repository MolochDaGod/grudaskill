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

const BY_SKILL = Object.freeze({
  staff_arcane_bolt: { id: 'styproj.card', vfxRef: 'VFX-STY-CARD', head: 'Card01.png', trail: 'Trail01.png', hit: 'Glow01.png' },
  tome_arcane_burst: { id: 'styproj.card', vfxRef: 'VFX-STY-CARD', head: 'Card01.png', trail: 'Trail01.png', hit: 'Glow01.png' },
  staff_void_bolt: { id: 'styproj.shadow', vfxRef: 'VFX-STY-SHADOW', head: 'Mask01.png', trail: 'Trail08.png', hit: 'Smoke_3.png' },
  gun_shadow_shot: { id: 'styproj.shadow', vfxRef: 'VFX-STY-SHADOW', head: 'Mask01.png', trail: 'Trail08.png', hit: 'Smoke_3.png' },
  staff_holy_light: { id: 'styproj.heart', vfxRef: 'VFX-STY-HEART', head: 'Glow01.png', trail: 'Trail07.png', hit: 'Flare01.png' },
  staff_radiant_heal: { id: 'styproj.heart', vfxRef: 'VFX-STY-HEART', head: 'Glow01.png', trail: 'Trail07.png', hit: 'Flare01.png' },
  staff_natures_fury: { id: 'styproj.leaf', vfxRef: 'VFX-STY-LEAF', head: 'Leaf_1.png', trail: 'Trail06.png', hit: 'Smoke_3.png' },
  t0_staff_vine_lash: { id: 'styproj.leaf', vfxRef: 'VFX-STY-LEAF', head: 'Leaf_1.png', trail: 'Trail06.png', hit: 'Smoke_3.png' },
  staff_frost_bolt: { id: 'styproj.diamond', vfxRef: 'VFX-STY-DIAMOND', head: 'Shape02.png', trail: 'Trail02.png', hit: 'Snowflakes_1.png' },
  staff_ice_nova: { id: 'styproj.diamond2', vfxRef: 'VFX-STY-DIAMOND2', head: 'Shape02-hollow.png', trail: 'Trail05.png', hit: 'Snow.png' },
  staff_crusaders_light: { id: 'styproj.angelic', vfxRef: 'VFX-STY-ANGELIC', head: 'Flare01.png', trail: 'Trail09.png', hit: 'Glow01.png' },
  staff_fire_bolt: { id: 'styproj.laser', vfxRef: 'VFX-STY-LASER', head: 'Thin01.png', trail: 'Trail01.png', hit: 'Flash01.png' },
  staff_chain_lightning: { id: 'styproj.laser2', vfxRef: 'VFX-STY-LASER2', head: 'Thin02.png', trail: 'Trail02.png', hit: 'Lightning01.png' },
  staff_storm_call: { id: 'styproj.laser2', vfxRef: 'VFX-STY-LASER2', head: 'Thin02.png', trail: 'Trail02.png', hit: 'Lightning01.png' },
  dagger_crimson_stab: { id: 'styproj.dagger', vfxRef: 'VFX-STY-DAGGER', head: 'Dagger.png', trail: 'Trail04.png', hit: 'Slash01.png' },
  dagger_phantom_dash: { id: 'styproj.dagger2', vfxRef: 'VFX-STY-DAGGER2', head: 'Dagger.png', trail: 'Trail08.png', hit: 'Slash02.png' },
  dagger_shadow_stab: { id: 'styproj.dagger2', vfxRef: 'VFX-STY-DAGGER2', head: 'Dagger.png', trail: 'Trail08.png', hit: 'Slash02.png' },
  staff_blizzard: { id: 'styproj.frost', vfxRef: 'VFX-STY-FROST', head: 'Snowflakes_1.png', trail: 'Trail05.png', hit: 'Glow01.png' },
  t0_staff_healing_sprout: { id: 'styproj.flower', vfxRef: 'VFX-STY-FLOWER', head: 'Flower.png', trail: 'Trail06.png', hit: 'Leaf_4.png' },
  staff_divine_wave: { id: 'styproj.star', vfxRef: 'VFX-STY-STAR', head: 'Star_1.png', trail: 'Trail09.png', hit: 'Flare01.png' },
  staff_thundergods_judgment: { id: 'styproj.electric', vfxRef: 'VFX-STY-ELECTRIC', head: 'Lightning01.png', trail: 'Trail02.png', hit: 'Flash01.png' },
  dagger_raging_blades: { id: 'styproj.shuriken', vfxRef: 'VFX-STY-SHURIKEN', head: 'Shape03.png', trail: 'Trail04.png', hit: 'Slash01.png' },
  t0_wand_practice_bolt: { id: 'styproj.smoke', vfxRef: 'VFX-STY-SMOKE', head: 'Smoke_1.png', trail: 'Trail09.png', hit: 'Smoke_3.png' }
});

const BY_ELEMENT = Object.freeze({
  fire: BY_SKILL.staff_fire_bolt,
  frost: BY_SKILL.staff_frost_bolt,
  ice: BY_SKILL.staff_frost_bolt,
  nature: BY_SKILL.staff_natures_fury,
  holy: BY_SKILL.staff_holy_light,
  shadow: BY_SKILL.staff_void_bolt,
  lightning: BY_SKILL.staff_chain_lightning,
  storm: BY_SKILL.staff_chain_lightning,
  arcane: BY_SKILL.staff_arcane_bolt,
  physical: BY_SKILL.dagger_crimson_stab
});

export function overlayForSkill(skill) {
  if (!skill) return null;
  if (skill.overlay?.head || skill.overlay?.trail) return skill.overlay;
  const id = skill.id || skill.catalogSkillId;
  if (id && BY_SKILL[id]) return BY_SKILL[id];
  const el = String(skill.element || skill.labElement || skill.damageType || '').toLowerCase();
  return BY_ELEMENT[el] || BY_ELEMENT.arcane;
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
  if (trailMap) {
    const mat = new MeshBasicMaterial({
      map: trailMap,
      color: color ?? 0xffffff,
      transparent: true,
      opacity: 0.88,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
    const ribbon = new Mesh(new PlaneGeometry(0.28, 1.5), mat);
    ribbon.rotation.x = Math.PI / 2;
    ribbon.position.set(0, 0.02, -0.62);
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
    head.scale.set(0.7, 0.7, 1);
    head.name = 'sty-head';
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

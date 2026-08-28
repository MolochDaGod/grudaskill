import * as THREE from "three";

const CDN = "/api/sprite";

export type SheetDef = {
  id: string;
  frames: number;
  cols?: number;
  fps?: number;
};

export type ActorKit = {
  id: string;
  name: string;
  folder: string;
  sheets: Record<string, SheetDef>;
  worldH: number;
};

export const WARLORD_KITS: ActorKit[] = [
  {
    id: "barbarian-warrior",
    name: "Barbarian Warrior",
    folder: "/sprites/characters/barbarian-warrior",
    worldH: 2.45,
    sheets: {
      idle: { id: "idle", frames: 16, fps: 10 },
      walk: { id: "walk", frames: 8, fps: 12 },
      attack: { id: "attack", frames: 30, fps: 22 },
    },
  },
  {
    id: "human-mage",
    name: "Human Mage",
    folder: "/sprites/characters/human-mage",
    worldH: 1.9,
    sheets: {
      idle: { id: "idle", frames: 8, fps: 8 },
      walk: { id: "walk", frames: 8, fps: 10 },
      attack: { id: "attack1", frames: 8, fps: 14 },
    },
  },
  {
    id: "hero-ranger",
    name: "Ranger",
    folder: "/sprites/characters/hero-ranger",
    worldH: 1.9,
    sheets: {
      idle: { id: "idle", frames: 6, fps: 8 },
      walk: { id: "walk", frames: 8, fps: 10 },
      attack: { id: "attack1", frames: 9, fps: 14 },
    },
  },
  {
    id: "hero-knight",
    name: "Knight",
    folder: "/sprites/characters/hero-knight",
    worldH: 2.0,
    sheets: {
      idle: { id: "idle", frames: 8, fps: 8 },
      walk: { id: "walk", frames: 8, fps: 10 },
      attack: { id: "attack1", frames: 8, fps: 14 },
    },
  },
  {
    id: "hero-assassin",
    name: "Thief",
    folder: "/sprites/characters/hero-assassin",
    worldH: 1.85,
    sheets: {
      idle: { id: "idle", frames: 8, fps: 8 },
      walk: { id: "walk", frames: 8, fps: 12 },
      attack: { id: "attack1", frames: 8, fps: 16 },
    },
  },
];

export const DUMMY_KITS: ActorKit[] = [
  {
    id: "armored-orc",
    name: "Armored Orc",
    folder: "/sprites/enemies/armored-orc",
    worldH: 1.85,
    sheets: {
      idle: { id: "idle", frames: 6, fps: 7 },
      walk: { id: "walk", frames: 8, fps: 10 },
      attack: { id: "attack1", frames: 7, fps: 12 },
    },
  },
  {
    id: "armored-skeleton",
    name: "Armored Skeleton",
    folder: "/sprites/enemies/armored-skeleton",
    worldH: 1.85,
    sheets: {
      idle: { id: "idle", frames: 6, fps: 7 },
      walk: { id: "walk", frames: 8, fps: 10 },
      attack: { id: "attack1", frames: 8, fps: 12 },
    },
  },
  {
    id: "elite-orc",
    name: "Elite Orc",
    folder: "/sprites/characters/elite-orc",
    worldH: 1.9,
    sheets: {
      idle: { id: "idle", frames: 6, fps: 7 },
      walk: { id: "walk", frames: 8, fps: 10 },
      attack: { id: "attack1", frames: 8, fps: 12 },
    },
  },
];

const loader = new THREE.TextureLoader();
loader.setCrossOrigin("anonymous");

function loadTex(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (t) => {
        t.magFilter = THREE.NearestFilter;
        t.minFilter = THREE.NearestFilter;
        t.generateMipmaps = false;
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = THREE.RepeatWrapping;
        t.wrapT = THREE.ClampToEdgeWrapping;
        resolve(t);
      },
      undefined,
      reject,
    );
  });
}

export class SpriteActor {
  readonly group = new THREE.Group();
  readonly sprite: THREE.Sprite;
  kit: ActorKit;
  private mats = new Map<string, THREE.SpriteMaterial>();
  private sheets = new Map<string, SheetDef>();
  private anim = "";
  private time = 0;
  private frame = 0;
  private flip = 1;
  private ready = false;
  private w = 1.2;
  private h = 1.9;

  constructor(kit: ActorKit) {
    this.kit = kit;
    this.sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        transparent: true,
        depthWrite: false,
        alphaTest: 0.05,
      }),
    );
    this.group.add(this.sprite);
  }

  async load() {
    const jobs = Object.entries(this.kit.sheets).map(async ([key, sheet]) => {
      const url = `${CDN}${this.kit.folder}/${sheet.id}.png`;
      const tex = await loadTex(url);
      const cols = sheet.cols ?? sheet.frames;
      tex.repeat.set(1 / cols, 1);
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        alphaTest: 0.05,
      });
      this.mats.set(key, mat);
      this.sheets.set(key, { ...sheet, cols });
      const img = tex.image as { width?: number; height?: number } | undefined;
      const aspect = (img?.width ?? cols * 100) / cols / (img?.height ?? 100);
      this.h = this.kit.worldH;
      this.w = this.h * aspect;
    });
    await Promise.allSettled(jobs);
    this.ready = this.mats.size > 0;
    this.setAnim("idle");
    this.applyScale();
  }

  setAnim(name: string) {
    const key = this.mats.has(name) ? name : "idle";
    if (key === this.anim) return;
    const mat = this.mats.get(key);
    if (!mat) return;
    this.anim = key;
    this.sprite.material = mat;
    this.time = 0;
    this.frame = 0;
    this.applyFrame();
  }

  setFlip(sign: number) {
    this.flip = sign >= 0 ? 1 : -1;
    this.applyScale();
  }

  update(dt: number) {
    if (!this.ready) return;
    const sheet = this.sheets.get(this.anim);
    if (!sheet) return;
    const fps = sheet.fps ?? 10;
    this.time += dt;
    const next = Math.floor(this.time * fps) % sheet.frames;
    if (next !== this.frame) {
      this.frame = next;
      this.applyFrame();
    }
  }

  private applyScale() {
    this.sprite.center.set(0.5, 0);
    this.sprite.position.y = 0;
    this.sprite.scale.set(this.w * this.flip, this.h, 1);
  }

  private applyFrame() {
    const sheet = this.sheets.get(this.anim);
    const mat = this.mats.get(this.anim);
    const map = mat?.map;
    if (!sheet || !map) return;
    const cols = sheet.cols ?? sheet.frames;
    map.offset.x = (this.frame % cols) / cols;
    map.needsUpdate = true;
  }
}

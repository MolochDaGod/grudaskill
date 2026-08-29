/** Named colour palettes harvested from the original bending / linear / ext shaders. */

export type ShaderPreset = {
  id: string;
  name: string;
  kit: "bend" | "lin" | "ext";
  block: string;
  colors: Record<string, string>;
};

export type ColorSlot = { key: string; label: string };

export const COLOR_SLOTS: Record<string, ColorSlot[]> = {
  fire: [
    { key: "colorCore", label: "Core" },
    { key: "colorMid", label: "Mid" },
    { key: "colorEdge", label: "Edge" },
    { key: "colorSmoke", label: "Smoke" },
  ],
  water: [
    { key: "colorDeep", label: "Deep" },
    { key: "colorShallow", label: "Shallow" },
    { key: "colorFoam", label: "Foam" },
  ],
  earth: [
    { key: "colorRock", label: "Rock" },
    { key: "colorRockDark", label: "Dark" },
    { key: "colorMoss", label: "Moss" },
  ],
  wind: [
    { key: "colorInner", label: "Inner" },
    { key: "colorOuter", label: "Outer" },
  ],
  ice: [
    { key: "colorCore", label: "Core" },
    { key: "colorDeep", label: "Deep" },
  ],
  thunder: [
    { key: "colorCore", label: "Core" },
    { key: "colorInner", label: "Inner" },
  ],
  meteor: [
    { key: "colorCore", label: "Core" },
    { key: "colorInner", label: "Inner" },
  ],
  beam: [
    { key: "colorCore", label: "Core" },
    { key: "colorInner", label: "Inner" },
  ],
  snare: [
    { key: "colorCore", label: "Core" },
    { key: "colorInner", label: "Inner" },
  ],
  glacier: [
    { key: "colorCore", label: "Core" },
  ],
  pyre: [
    { key: "colorCore", label: "Core" },
    { key: "colorMid", label: "Mid" },
  ],
  kraken: [
    { key: "colorCore", label: "Core" },
    { key: "colorMid", label: "Mid" },
  ],
  electrical: [
    { key: "colorCore", label: "Core" },
    { key: "colorInner", label: "Inner" },
  ],
  portal: [
    { key: "colorCore", label: "Lip" },
    { key: "colorMid", label: "Gate" },
    { key: "colorDeep", label: "Fog" },
  ],
  aether: [
    { key: "colorCore", label: "Lip" },
    { key: "colorMid", label: "Water" },
    { key: "colorDeep", label: "Deep" },
  ],
  firePortal: [
    { key: "colorCore", label: "Core" },
    { key: "colorInner", label: "Inner" },
    { key: "colorMid", label: "Mid" },
  ],
};

/** Frozen defaults from the original GitHub settings — Reset uses these. */
export const SHADER_PRESETS: ShaderPreset[] = [
  {
    id: "bend-fire",
    name: "Fire volume",
    kit: "bend",
    block: "fire",
    colors: { colorCore: "#fff6d8", colorMid: "#ffb02e", colorEdge: "#ff3d10", colorSmoke: "#181616" },
  },
  {
    id: "bend-water",
    name: "Water volume",
    kit: "bend",
    block: "water",
    colors: { colorDeep: "#052a45", colorShallow: "#2ec4d6", colorFoam: "#eaf9ff" },
  },
  {
    id: "bend-earth",
    name: "Earth crust",
    kit: "bend",
    block: "earth",
    colors: { colorRock: "#6b5744", colorRockDark: "#3a2e24", colorMoss: "#4f6b33" },
  },
  {
    id: "bend-wind",
    name: "Air silk",
    kit: "bend",
    block: "wind",
    colors: { colorInner: "#f4fcff", colorOuter: "#b6d8ea" },
  },
  {
    id: "lin-ice",
    name: "Frost lance",
    kit: "lin",
    block: "ice",
    colors: { colorCore: "#638797", colorDeep: "#3e737a" },
  },
  {
    id: "lin-thunder",
    name: "Storm lance",
    kit: "lin",
    block: "thunder",
    colors: { colorCore: "#ffffff", colorInner: "#c9ecff" },
  },
  {
    id: "lin-beam",
    name: "Nova beam",
    kit: "lin",
    block: "beam",
    colors: { colorCore: "#ffffff", colorInner: "#d3f4ff" },
  },
  {
    id: "lin-snare",
    name: "Voltaic snare",
    kit: "lin",
    block: "snare",
    colors: { colorCore: "#ffffff", colorInner: "#dcd0ff" },
  },
  {
    id: "lin-glacier",
    name: "Glacial crown",
    kit: "lin",
    block: "glacier",
    colors: { colorCore: "#a8f4ff" },
  },
  {
    id: "ext-pyre",
    name: "Pyre crown",
    kit: "ext",
    block: "pyre",
    colors: { colorCore: "#fff0bd", colorMid: "#ff7a20" },
  },
  {
    id: "ext-kraken",
    name: "Kraken rift",
    kit: "ext",
    block: "kraken",
    colors: { colorCore: "#eafcff", colorMid: "#3fe0c8" },
  },
  {
    id: "ext-orb",
    name: "Electric orb",
    kit: "ext",
    block: "electrical",
    colors: { colorCore: "#ffffff", colorInner: "#ff7a30" },
  },
  {
    id: "ext-portal",
    name: "Verdant gate",
    kit: "ext",
    block: "portal",
    colors: { colorCore: "#f4ffd6", colorMid: "#86e02a", colorDeep: "#3b5138" },
  },
  {
    id: "ext-aether",
    name: "Tidewrought",
    kit: "ext",
    block: "aether",
    colors: { colorCore: "#e6ffff", colorMid: "#31d9ff", colorDeep: "#03142c" },
  },
  {
    id: "ext-fireportal",
    name: "Fire portal",
    kit: "ext",
    block: "firePortal",
    colors: { colorCore: "#fff7d6", colorInner: "#ffd166", colorMid: "#ff7a20" },
  },
];

export function swatchOf(preset: ShaderPreset) {
  return preset.colors.colorCore || preset.colors.colorMid || preset.colors.colorInner || preset.colors.colorShallow || "#fff";
}

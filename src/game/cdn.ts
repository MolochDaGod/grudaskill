/**
 * Cloudflare delivery SSOT for this lab.
 *
 *   D1         → rows only: spell params + play-kit index (r2Key, cdnUrl, size)
 *   R2 + Worker→ mesh / Draco / ktx2 / wasm bytes on assets.grudge-studio.com
 *   Workers    → JSON catalogs (vfx api), not binary
 *   localStorage → editor saves (skills, binds) — not SQL
 *   PGlite/Neon  → auth scaffold only; never GLBs or VFX
 *
 * Do not PUT heavy systems (GLB, grass, shaders, Rapier wasm) into D1.
 * Query `?purpose=play` (~53 rows) — never the 6k catalog dump.
 */
function env(key: string, fallback: string) {
  try {
    const v = (import.meta as { env?: Record<string, string> }).env?.[key];
    if (!v) return fallback;
    return String(v).replace(/\/+$/, "");
  } catch {
    return fallback;
  }
}

export const ASSETS_URL = env("VITE_ASSETS_URL", "https://assets.grudge-studio.com");
export const VFX_ASSETS_URL = env("VITE_VFX_ASSETS_URL", "https://vfx.grudge.studio/assets");
export const VFX_API_URL = env("VITE_VFX_API_URL", "https://grudge-vfx-api.grudge.workers.dev");
export const OBJECTSTORE_URL = env("VITE_OBJECTSTORE_URL", "https://objectstore.grudge-studio.com");
export const D1_ASSETS_URL = env("VITE_D1_ASSETS_URL", "https://api.grudge-studio.com/assets");

export function assetUrl(key: string) {
  const path = key.replace(/^\/+/, "");
  return `${ASSETS_URL}/${path}`;
}

/** Same-origin R2 proxy — Cloudflare hotlink-blocks grok preview / grok.me Origins. */
export function r2Path(key: string) {
  return `/api/r2/${key.replace(/^\/+/, "")}`;
}

export function viaR2(url: string) {
  if (!url) return url;
  if (url.startsWith("/api/r2/") || url.startsWith("/api/")) return url;
  if (url.startsWith("/")) return url;
  try {
    const u = new URL(url);
    if (u.hostname === "assets.grudge-studio.com" || (u.hostname.endsWith(".grudge-studio.com") && u.hostname.includes("assets"))) {
      return r2Path(u.pathname.replace(/^\/+/, ""));
    }
  } catch {
    /* keep */
  }
  if (url.startsWith(ASSETS_URL)) return r2Path(url.slice(ASSETS_URL.length));
  return url;
}

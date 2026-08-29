/**
 * Cloudflare delivery SSOT for this lab.
 *
 *   R2 bucket  → Worker + custom domain assets.grudge-studio.com (proxied)
 *   D1         → search index only, never the mesh bytes
 *   Workers    → JSON catalogs (vfx api), not binary
 *
 * Probe (2026-08-29): GLBs return Cache-Control + CF-Cache-Tag but NO
 * CF-Cache-Status — Worker responses are DYNAMIC and .glb is not in
 * Cloudflare's default cached-extension list. Fix:
 *   Caching → Cache Rules  (cloudflare/assets-cache-rules.json)
 *   CF_API_TOKEN + CF_ZONE_ID  node scripts/apply-r2-cache-rules.mjs
 * Purge: 3d-model  /  models
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

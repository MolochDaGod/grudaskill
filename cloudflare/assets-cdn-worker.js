/**
 * Drop-in front for the R2 custom domain (assets.grudge-studio.com).
 *
 * Worker responses are DYNAMIC unless we:
 *   1. fetch origin/R2 with cf.cacheEverything + cacheTtl
 *   2. AND a zone Cache Rule marks GLB Eligible for cache
 *
 * Bind R2 bucket as `ASSETS`. Deploy on assets.grudge-studio.com/*.
 */
const MESH = /\.(glb|gltf|bin|ktx2|ktx|basis|hdr|exr|wasm|fbx|drc)$/i;
const MEDIA = /\.(png|jpe?g|webp|avif|svg|ico|mp3|ogg|wav)$/i;
const JSON_EXT = /\.json$/i;

function ttlFor(path) {
  if (MESH.test(path) || MEDIA.test(path)) return 2592000;
  if (JSON_EXT.test(path)) return 120;
  return 60;
}

function cors(req) {
  const origin = req.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Range, If-None-Match",
    "Access-Control-Expose-Headers": "ETag, Content-Length, Content-Range, Accept-Ranges, CF-Cache-Tag, Age",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    "Cross-Origin-Resource-Policy": "cross-origin",
  };
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(request) });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method", { status: 405, headers: cors(request) });
    }

    const url = new URL(request.url);
    const key = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    if (!key || key.includes("..")) return new Response("bad path", { status: 400, headers: cors(request) });

    const ttl = ttlFor(key);
    const cacheKey = new Request(`https://assets.grudge-studio.com/${key}`, request);
    const hit = await caches.default.match(cacheKey);
    if (hit) {
      const headers = new Headers(hit.headers);
      Object.entries(cors(request)).forEach(([k, v]) => headers.set(k, v));
      headers.set("X-Asset-Source", "edge");
      return new Response(hit.body, { status: hit.status, headers });
    }

    const obj = await env.ASSETS.get(key);
    if (!obj) return new Response("not found", { status: 404, headers: cors(request) });

    const headers = new Headers(cors(request));
    headers.set("Content-Type", obj.httpMetadata?.contentType || guessType(key));
    headers.set("ETag", obj.httpEtag || obj.etag);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", `public, max-age=${ttl}, stale-while-revalidate=86400`);
    headers.set("CF-Cache-Tag", MESH.test(key) ? "3d-model,models" : JSON_EXT.test(key) ? "catalog" : "media");
    headers.set("X-Asset-Source", "r2");
    if (obj.size != null) headers.set("Content-Length", String(obj.size));

    const body = request.method === "HEAD" ? null : obj.body;
    const res = new Response(body, { status: 200, headers });
    ctx.waitUntil(caches.default.put(cacheKey, res.clone()));
    return res;
  },
};

function guessType(key) {
  if (key.endsWith(".glb")) return "model/gltf-binary";
  if (key.endsWith(".gltf")) return "model/gltf+json";
  if (key.endsWith(".ktx2")) return "image/ktx2";
  if (key.endsWith(".hdr")) return "image/vnd.radiance";
  if (key.endsWith(".wasm")) return "application/wasm";
  if (key.endsWith(".drc")) return "application/octet-stream";
  if (key.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

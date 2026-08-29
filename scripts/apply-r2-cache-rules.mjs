#!/usr/bin/env node
/**
 * Apply Cache Rules for assets.grudge-studio.com.
 *
 *   CF_API_TOKEN  zone.cache_rules edit (or cache_rules write) + zone read
 *   CF_ZONE_ID    grudge-studio.com  (or pass --zone)
 *
 * Without a token, prints the dashboard recipe and curls CF-Cache-Status.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RULES = JSON.parse(readFileSync(resolve(ROOT, "cloudflare/assets-cache-rules.json"), "utf8"));
const HOST = "assets.grudge-studio.com";
const SAMPLE = `https://${HOST}/asset-packs/toon-rts-characters/glb/characters/human.glb`;
const API = "https://api.cloudflare.com/client/v4";

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

async function cf(token, path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    const err = body.errors?.[0]?.message || res.statusText;
    throw new Error(`${path} ${res.status}: ${err}`);
  }
  return body;
}

async function probe() {
  const res = await fetch(SAMPLE, { method: "HEAD", headers: { Origin: "https://casting.grudge.studio" } });
  const pick = (n) => res.headers.get(n);
  return {
    status: res.status,
    cacheStatus: pick("cf-cache-status") || "(missing — GLB is DYNAMIC)",
    cacheControl: pick("cache-control"),
    age: pick("age"),
    tag: pick("cf-cache-tag"),
    source: pick("x-asset-source"),
    bytes: pick("content-length"),
  };
}

function dashboard() {
  return `
Dashboard (Caching → Cache Rules on grudge-studio.com), order top → bottom:

1. If Hostname eq assets.grudge-studio.com AND File extension in
     glb, gltf, bin, ktx2, ktx, basis, hdr, exr, wasm, fbx, drc, mp3, ogg, wav
   Then Eligible for cache
        Edge TTL: ignore origin, 30 days
        Browser TTL: respect origin
        Cache key: ignore query string

2. Same host AND File extension in png, jpg, jpeg, webp, avif, svg, ico
   Then Eligible for cache · Edge TTL 30 days · ignore query string

3. Same host AND File extension eq json
   Then Eligible for cache · Edge TTL 2 minutes

Also: Caching → Tiered Cache → Smart. Purge by tag: 3d-model / models.
`.trim();
}

async function apply(token, zoneId) {
  const phase = "http_request_cache_settings";
  const current = await cf(token, `/zones/${zoneId}/rulesets/phases/${phase}/entrypoint`);
  const existing = current.result?.rules ?? [];
  const ours = new Map(RULES.rules.map((r) => [r.ref, r]));
  const merged = [];
  const seen = new Set();
  for (const rule of existing) {
    const ref = rule.ref;
    if (ref && ours.has(ref)) {
      merged.push({ ...rule, ...ours.get(ref), id: rule.id });
      seen.add(ref);
    } else {
      merged.push(rule);
    }
  }
  for (const rule of RULES.rules) {
    if (!seen.has(rule.ref)) merged.push(rule);
  }
  const body = {
    description: RULES.description,
    rules: merged.map(({ id, ref, description, expression, action, enabled, action_parameters }) => ({
      ...(id ? { id } : {}),
      ref,
      description,
      expression,
      action,
      enabled,
      action_parameters,
    })),
  };
  const saved = await cf(token, `/zones/${zoneId}/rulesets/phases/${phase}/entrypoint`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return saved.result?.rules?.filter((r) => String(r.ref || "").startsWith("r2-")).map((r) => r.ref);
}

const token = process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || "";
const zone = arg("zone", process.env.CF_ZONE_ID || "");

const before = await probe();
console.log("before", before);
console.log("\n" + dashboard() + "\n");

if (!token || !zone) {
  console.log("Set CF_API_TOKEN + CF_ZONE_ID to apply. Rules file: cloudflare/assets-cache-rules.json");
  process.exit(0);
}

const refs = await apply(token, zone);
console.log("applied", refs);
const after = await probe();
console.log("after", after);
if (after.cacheStatus === "DYNAMIC" || after.cacheStatus.startsWith("(")) {
  console.log("Still DYNAMIC — Worker in front of R2 may need cacheEverything, or wait ~30s and re-probe.");
  process.exit(2);
}

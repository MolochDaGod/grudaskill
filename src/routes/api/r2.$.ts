import { createFileRoute } from "@tanstack/react-router";

const UPSTREAM = "https://assets.grudge-studio.com/";
const HOTLINK = {
  Origin: "https://casting.grudge.studio",
  Referer: "https://casting.grudge.studio/",
  "User-Agent": "GrudgeAbilityLab/1.0",
};
const OK_EXT = /\.(glb|gltf|bin|png|webp|jpg|jpeg|ktx2|wasm|json|drc)$/i;

export const Route = createFileRoute("/api/r2/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const splat = ((params as { _splat?: string })._splat ?? "").replace(/^\/+/, "");
        if (!splat || splat.includes("..") || splat.includes("://") || !OK_EXT.test(splat)) {
          return new Response("bad path", { status: 400 });
        }
        const res = await fetch(UPSTREAM + splat, { headers: HOTLINK });
        if (!res.ok) {
          return new Response(`upstream ${res.status}`, { status: res.status === 404 ? 404 : 502 });
        }
        const buf = await res.arrayBuffer();
        const type = res.headers.get("content-type") || "application/octet-stream";
        return new Response(buf, {
          headers: {
            "content-type": type,
            "cache-control": "public, max-age=604800, immutable",
          },
        });
      },
    },
  },
});

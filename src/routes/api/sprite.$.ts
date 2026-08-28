import { createFileRoute } from "@tanstack/react-router";

const UPSTREAMS = [
  "https://assets.grudge-studio.com/",
  "https://molochdagod.github.io/ObjectStore/",
];

export const Route = createFileRoute("/api/sprite/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const splat = (params as { _splat?: string })._splat ?? "";
        if (!splat || splat.includes("..")) {
          return new Response("bad path", { status: 400 });
        }
        for (const root of UPSTREAMS) {
          const res = await fetch(root + splat);
          if (!res.ok) continue;
          const buf = await res.arrayBuffer();
          const type = res.headers.get("content-type") || "image/png";
          return new Response(buf, {
            headers: {
              "content-type": type,
              "cache-control": "public, max-age=86400",
            },
          });
        }
        return new Response("not found", { status: 404 });
      },
    },
  },
});

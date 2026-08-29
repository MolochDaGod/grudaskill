import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/d1-play")({
  server: {
    handlers: {
      GET: async () => {
        const res = await fetch("https://api.grudge-studio.com/assets?purpose=play&limit=100", {
          headers: {
            Accept: "application/json",
            Origin: "https://casting.grudge.studio",
            Referer: "https://casting.grudge.studio/",
          },
        });
        if (!res.ok) {
          return Response.json({ assets: [], error: res.status }, { status: 502 });
        }
        const data = await res.json();
        return Response.json(data, {
          headers: { "cache-control": "public, max-age=300" },
        });
      },
    },
  },
});

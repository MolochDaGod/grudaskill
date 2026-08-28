import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/vfx-catalog")({
  server: {
    handlers: {
      GET: async () => {
        const res = await fetch("https://vfx.grudge.studio/assets/catalog.json", {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) {
          return Response.json({ effects: [], error: res.status }, { status: 502 });
        }
        const data = await res.json();
        return Response.json(data);
      },
    },
  },
});

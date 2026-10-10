import { Hono } from "hono";
import type { ShipmentTracker } from "./tracker.ts";

export function createApp(tracker: ShipmentTracker) {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/shipments/:code/track", async (c) => {
    return c.json(await tracker.track(c.req.param("code")), 201);
  });

  app.post("/shipments/:code/sync", async (c) => {
    return c.json(await tracker.sync(c.req.param("code")));
  });

  app.get("/shipments/:code", (c) => {
    const view = tracker.status(c.req.param("code"));
    if (!view) return c.json({ error: "rastreio não encontrado" }, 404);
    return c.json(view);
  });

  return app;
}

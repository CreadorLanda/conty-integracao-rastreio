import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { systemClock } from "./clock.ts";
import { FakeTrackingAggregator } from "./fake-aggregator.ts";
import { ShipmentTracker } from "./tracker.ts";

const aggregator = new FakeTrackingAggregator();
aggregator.emit("BR123", { id: "e1", status: "POSTED", occurredAt: new Date(Date.now() - 2 * 86_400_000).toISOString() });
aggregator.emit("BR123", { id: "e2", status: "IN_TRANSIT", occurredAt: new Date(Date.now() - 86_400_000).toISOString() });

const tracker = new ShipmentTracker(aggregator, systemClock);
const port = Number(process.env.PORT ?? 3007);

serve({ fetch: createApp(tracker).fetch, port }, (info) => {
  console.log(`rastreio de produto em http://127.0.0.1:${info.port}`);
});

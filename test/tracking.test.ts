import { describe, expect, it } from "vitest";
import type { RawTrackingEvent, TrackingAggregator } from "../src/aggregator.ts";
import type { Clock } from "../src/clock.ts";
import { FakeTrackingAggregator } from "../src/fake-aggregator.ts";
import { normalizeStatus } from "../src/status.ts";
import { ShipmentTracker } from "../src/tracker.ts";

const DAY = 24 * 60 * 60 * 1000;

function clockAt(iso: string): Clock {
  const at = new Date(iso);
  return () => at;
}

describe("normalização de status", () => {
  it("traduz o dialeto da transportadora para o conjunto estável", () => {
    expect(normalizeStatus("POSTED")).toBe("postado");
    expect(normalizeStatus("in_transit")).toBe("em_transito");
    expect(normalizeStatus("OUT_FOR_DELIVERY")).toBe("saiu_para_entrega");
    expect(normalizeStatus("DELIVERED")).toBe("entregue");
  });

  it("um status inventado pela transportadora não vira entregue", () => {
    expect(normalizeStatus("TELEPORTADO")).toBe("excecao");
  });
});

describe("status desconhecido", () => {
  it("não vira entregue no rastreio", async () => {
    const aggregator = new FakeTrackingAggregator();
    aggregator.emit("BR1", { id: "e1", status: "POSTED", occurredAt: "2026-06-01T10:00:00.000Z" });
    aggregator.emit("BR1", { id: "e2", status: "TELEPORTADO", occurredAt: "2026-06-02T10:00:00.000Z" });
    const tracker = new ShipmentTracker(aggregator, clockAt("2026-06-02T12:00:00.000Z"), DAY * 30);
    const view = await tracker.track("BR1");
    expect(view.status).toBe("excecao");
  });
});

describe("eventos fora de ordem", () => {
  it("um evento antigo que chega depois não faz o status voltar", async () => {
    const aggregator = new FakeTrackingAggregator();
    aggregator.emit("BR1", { id: "e1", status: "IN_TRANSIT", occurredAt: "2026-06-02T10:00:00.000Z" });
    aggregator.emit("BR1", { id: "e2", status: "DELIVERED", occurredAt: "2026-06-03T10:00:00.000Z" });
    const tracker = new ShipmentTracker(aggregator, clockAt("2026-06-03T12:00:00.000Z"), DAY * 30);
    expect((await tracker.track("BR1")).status).toBe("entregue");

    aggregator.emit("BR1", { id: "e3", status: "EXCEPTION", occurredAt: "2026-06-01T10:00:00.000Z" });
    expect((await tracker.sync("BR1")).status).toBe("entregue");
  });

  it("não regride de saiu para entrega quando um em trânsito antigo chega atrasado", async () => {
    const aggregator = new FakeTrackingAggregator();
    aggregator.emit("BR1", { id: "e1", status: "POSTED", occurredAt: "2026-06-01T10:00:00.000Z" });
    aggregator.emit("BR1", { id: "e2", status: "OUT_FOR_DELIVERY", occurredAt: "2026-06-03T10:00:00.000Z" });
    const tracker = new ShipmentTracker(aggregator, clockAt("2026-06-03T12:00:00.000Z"), DAY * 30);
    expect((await tracker.track("BR1")).status).toBe("saiu_para_entrega");

    aggregator.emit("BR1", { id: "e3", status: "IN_TRANSIT", occurredAt: "2026-06-02T10:00:00.000Z" });
    expect((await tracker.sync("BR1")).status).toBe("saiu_para_entrega");
  });
});

describe("idempotência do histórico", () => {
  it("consultar o mesmo código de novo não duplica o histórico", async () => {
    const aggregator = new FakeTrackingAggregator();
    aggregator.emit("BR1", { id: "e1", status: "POSTED", occurredAt: "2026-06-01T10:00:00.000Z" });
    aggregator.emit("BR1", { id: "e2", status: "IN_TRANSIT", occurredAt: "2026-06-02T10:00:00.000Z" });
    const tracker = new ShipmentTracker(aggregator, clockAt("2026-06-02T12:00:00.000Z"), DAY * 30);
    await tracker.track("BR1");
    const view = await tracker.sync("BR1");
    expect(view.events).toHaveLength(2);
  });
});

describe("regra de atraso", () => {
  it("marca atraso quando o tempo em trânsito passa do limite sem entrega", async () => {
    const aggregator = new FakeTrackingAggregator();
    aggregator.emit("BR1", { id: "e1", status: "POSTED", occurredAt: "2026-06-01T10:00:00.000Z" });
    aggregator.emit("BR1", { id: "e2", status: "IN_TRANSIT", occurredAt: "2026-06-02T10:00:00.000Z" });
    const tracker = new ShipmentTracker(aggregator, clockAt("2026-06-05T10:00:00.000Z"), DAY);
    expect((await tracker.track("BR1")).late).toBe(true);
  });

  it("não marca atraso numa entrega normal dentro do limite", async () => {
    const aggregator = new FakeTrackingAggregator();
    aggregator.emit("BR1", { id: "e1", status: "POSTED", occurredAt: "2026-06-01T10:00:00.000Z" });
    aggregator.emit("BR1", { id: "e2", status: "DELIVERED", occurredAt: "2026-06-01T18:00:00.000Z" });
    const tracker = new ShipmentTracker(aggregator, clockAt("2026-06-10T10:00:00.000Z"), DAY);
    const view = await tracker.track("BR1");
    expect(view.status).toBe("entregue");
    expect(view.late).toBe(false);
  });
});

describe("troca do agregador", () => {
  it("funciona com outro agregador sem vazar o formato dele", async () => {
    const other: TrackingAggregator = {
      async register() {},
      async fetchEvents(): Promise<RawTrackingEvent[]> {
        return [{ id: "x", status: "ARRIVED", occurredAt: "2026-06-02T10:00:00.000Z" }];
      },
    };
    const tracker = new ShipmentTracker(other, clockAt("2026-06-02T12:00:00.000Z"), DAY * 30);
    expect((await tracker.track("ZZ9")).status).toBe("em_transito");
  });
});

import type { RawTrackingEvent, TrackingAggregator } from "./aggregator.ts";
import type { Clock } from "./clock.ts";
import {
  type CanonicalStatus,
  type NormalizedEvent,
  currentStatus,
  isLate,
  normalizeStatus,
} from "./status.ts";

export type ShipmentView = {
  code: string;
  status: CanonicalStatus | null;
  late: boolean;
  events: NormalizedEvent[];
};

type Shipment = {
  code: string;
  events: Map<string, NormalizedEvent>;
};

export const DEFAULT_MAX_TRANSIT_MS = 7 * 24 * 60 * 60 * 1000;

export class ShipmentTracker {
  private readonly shipments = new Map<string, Shipment>();

  constructor(
    private readonly aggregator: TrackingAggregator,
    private readonly clock: Clock,
    private readonly maxTransitMs: number = DEFAULT_MAX_TRANSIT_MS,
  ) {}

  async track(code: string): Promise<ShipmentView> {
    if (!this.shipments.has(code)) {
      await this.aggregator.register(code);
      this.shipments.set(code, { code, events: new Map() });
    }
    return this.sync(code);
  }

  async sync(code: string): Promise<ShipmentView> {
    const shipment = this.shipments.get(code) ?? { code, events: new Map() };
    this.shipments.set(code, shipment);
    const raw = await this.aggregator.fetchEvents(code);
    for (const event of raw) this.ingest(shipment, event);
    return this.view(shipment);
  }

  status(code: string): ShipmentView | undefined {
    const shipment = this.shipments.get(code);
    return shipment ? this.view(shipment) : undefined;
  }

  private ingest(shipment: Shipment, raw: RawTrackingEvent): void {
    const normalized: NormalizedEvent = {
      status: normalizeStatus(raw.status),
      rawStatus: raw.status,
      occurredAt: raw.occurredAt,
    };
    const key = raw.id ?? `${raw.status}\u0000${raw.occurredAt}`;
    if (!shipment.events.has(key)) shipment.events.set(key, normalized);
  }

  private view(shipment: Shipment): ShipmentView {
    const events = [...shipment.events.values()].sort(
      (left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime(),
    );
    return {
      code: shipment.code,
      status: currentStatus(events),
      late: isLate(events, this.clock(), this.maxTransitMs),
      events,
    };
  }
}

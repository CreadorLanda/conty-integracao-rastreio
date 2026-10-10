import type { RawTrackingEvent, TrackingAggregator } from "./aggregator.ts";

export class FakeTrackingAggregator implements TrackingAggregator {
  private readonly events = new Map<string, RawTrackingEvent[]>();
  private readonly registered = new Set<string>();

  async register(code: string): Promise<void> {
    this.registered.add(code);
    if (!this.events.has(code)) this.events.set(code, []);
  }

  async fetchEvents(code: string): Promise<RawTrackingEvent[]> {
    return [...(this.events.get(code) ?? [])];
  }

  emit(code: string, event: RawTrackingEvent): void {
    const list = this.events.get(code) ?? [];
    list.push(event);
    this.events.set(code, list);
  }
}

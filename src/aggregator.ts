export type RawTrackingEvent = {
  id?: string;
  status: string;
  occurredAt: string;
};

export interface TrackingAggregator {
  register(code: string): Promise<void>;
  fetchEvents(code: string): Promise<RawTrackingEvent[]>;
}

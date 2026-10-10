export type CanonicalStatus =
  | "postado"
  | "em_transito"
  | "saiu_para_entrega"
  | "entregue"
  | "excecao";

const RANK: Record<Exclude<CanonicalStatus, "excecao">, number> = {
  postado: 1,
  em_transito: 2,
  saiu_para_entrega: 3,
  entregue: 4,
};

const CARRIER_DIALECT: Record<string, CanonicalStatus> = {
  POSTED: "postado",
  CREATED: "postado",
  ACCEPTED: "postado",
  LABEL_CREATED: "postado",
  IN_TRANSIT: "em_transito",
  TRANSIT: "em_transito",
  DEPARTED: "em_transito",
  ARRIVED: "em_transito",
  OUT_FOR_DELIVERY: "saiu_para_entrega",
  DELIVERED: "entregue",
  EXCEPTION: "excecao",
  FAILED_ATTEMPT: "excecao",
  RETURNED: "excecao",
};

export function normalizeStatus(rawStatus: string): CanonicalStatus {
  return CARRIER_DIALECT[rawStatus.trim().toUpperCase()] ?? "excecao";
}

export type NormalizedEvent = {
  status: CanonicalStatus;
  rawStatus: string;
  occurredAt: string;
};

export function currentStatus(events: NormalizedEvent[]): CanonicalStatus | null {
  if (events.length === 0) return null;
  if (events.some((event) => event.status === "entregue")) return "entregue";

  const latest = [...events].sort(byRecency)[0];
  if (latest && latest.status === "excecao") return "excecao";

  let best: CanonicalStatus | null = null;
  for (const event of events) {
    if (event.status === "excecao") continue;
    if (best === null || RANK[event.status] > RANK[best as Exclude<CanonicalStatus, "excecao">]) {
      best = event.status;
    }
  }
  return best ?? "excecao";
}

export function transitStart(events: NormalizedEvent[]): Date | null {
  let start: Date | null = null;
  for (const event of events) {
    const at = new Date(event.occurredAt);
    if (start === null || at.getTime() < start.getTime()) start = at;
  }
  return start;
}

export function deliveredAt(events: NormalizedEvent[]): Date | null {
  let delivered: Date | null = null;
  for (const event of events) {
    if (event.status !== "entregue") continue;
    const at = new Date(event.occurredAt);
    if (delivered === null || at.getTime() > delivered.getTime()) delivered = at;
  }
  return delivered;
}

export function isLate(events: NormalizedEvent[], now: Date, maxTransitMs: number): boolean {
  const start = transitStart(events);
  if (start === null) return false;
  const end = deliveredAt(events) ?? now;
  return end.getTime() - start.getTime() > maxTransitMs;
}

function byRecency(left: NormalizedEvent, right: NormalizedEvent): number {
  const delta = new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime();
  if (delta !== 0) return delta;
  return rankOf(right.status) - rankOf(left.status);
}

function rankOf(status: CanonicalStatus): number {
  return status === "excecao" ? 0 : RANK[status];
}

import { describe, expect, it } from "vitest";
import { ObservedReputationReader, type OrderLister } from "./reputation.js";
import type { AvalStore } from "./aval.js";
import type { Aval, Candidate } from "./types.js";
import type { Order } from "./cap/client.js";

const candidate: Candidate = {
  serviceId: "svc-good",
  agentId: "agent-good",
  priceUsdc: 0.5,
  slaSeconds: 120,
  deliverableType: "schema",
};

function fakeOrders(): Order[] {
  return [
    { status: "completed", createdAt: "2026-07-01T00:00:00Z", deliveredAt: "2026-07-01T00:01:00Z", slaDeadline: "2026-07-01T00:02:00Z" } as Order,
    { status: "completed", createdAt: "2026-07-01T00:00:00Z", deliveredAt: "2026-07-01T00:00:30Z", slaDeadline: "2026-07-01T00:02:00Z" } as Order,
    { status: "rejected", createdAt: "2026-07-01T00:00:00Z" } as Order,
  ];
}

describe("ObservedReputationReader", () => {
  it("computes completion/reject rate, latency ratio, and aval score from history", async () => {
    const orderLister: OrderLister = { listOrders: async () => fakeOrders() };
    const avalHistory: Aval[] = [
      { outcome: "positive" } as Aval,
      { outcome: "positive" } as Aval,
      { outcome: "negative" } as Aval,
    ];
    const avalStore: AvalStore = {
      write: async () => {},
      history: async () => avalHistory,
    };

    const reader = new ObservedReputationReader(orderLister, avalStore);
    const signal = await reader.read(candidate);

    expect(signal.serviceId).toBe("svc-good");
    expect(signal.sampleSize).toBe(3);
    expect(signal.completionRate).toBeCloseTo(2 / 3);
    expect(signal.rejectRate).toBeCloseTo(1 / 3);
    expect(signal.avalScore).toBeCloseTo(2 / 3);
    expect(signal.latencyRatio).toBeGreaterThan(0);
    expect(signal.latencyRatio).toBeLessThan(1);
  });

  it("falls back to neutral defaults when there is no order history", async () => {
    const orderLister: OrderLister = { listOrders: async () => [] };
    const avalStore: AvalStore = { write: async () => {}, history: async () => [] };

    const reader = new ObservedReputationReader(orderLister, avalStore);
    const signal = await reader.read(candidate);

    expect(signal.sampleSize).toBe(0);
    expect(signal.completionRate).toBe(0.5);
    expect(signal.rejectRate).toBe(0);
    expect(signal.avalScore).toBe(0.5);
  });
});

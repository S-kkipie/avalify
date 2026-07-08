import { describe, expect, it } from "vitest";
import { filterByGuardrails, SpendTracker, DEFAULT_GUARDRAILS } from "./guardrails.js";
import type { JobSpec, RankedCandidate } from "./types.js";

const job: JobSpec = { capability: "dataset-summary", input: {}, acceptSchema: {} as JobSpec["acceptSchema"], maxPriceUsdc: 1 };

function candidate(serviceId: string, priceUsdc: number, score: number): RankedCandidate {
  return { serviceId, agentId: `agent-${serviceId}`, priceUsdc, slaSeconds: 60, deliverableType: "schema", score, reasons: [] };
}

describe("filterByGuardrails", () => {
  it("drops candidates on the denylist", () => {
    const ranked = [candidate("a", 0.5, 0.9), candidate("b", 0.5, 0.8)];
    const filtered = filterByGuardrails(ranked, job, { ...DEFAULT_GUARDRAILS, denylist: ["a"] });
    expect(filtered.map((c) => c.serviceId)).toEqual(["b"]);
  });

  it("keeps only allowlisted candidates when an allowlist is set", () => {
    const ranked = [candidate("a", 0.5, 0.9), candidate("b", 0.5, 0.8)];
    const filtered = filterByGuardrails(ranked, job, { ...DEFAULT_GUARDRAILS, allowlist: ["b"] });
    expect(filtered.map((c) => c.serviceId)).toEqual(["b"]);
  });

  it("drops candidates priced above the job's max price even if ranking missed it", () => {
    const ranked = [candidate("a", 5, 0.9)];
    const filtered = filterByGuardrails(ranked, job, DEFAULT_GUARDRAILS);
    expect(filtered).toEqual([]);
  });

  it("truncates the list to maxRouteArounds", () => {
    const ranked = [candidate("a", 0.5, 0.9), candidate("b", 0.5, 0.8), candidate("c", 0.5, 0.7)];
    const filtered = filterByGuardrails(ranked, job, { ...DEFAULT_GUARDRAILS, maxRouteArounds: 2 });
    expect(filtered).toHaveLength(2);
  });
});

describe("SpendTracker", () => {
  it("allows spend within budget and accumulates it", () => {
    const tracker = new SpendTracker(1);
    tracker.reserve(0.4);
    tracker.reserve(0.4);
    expect(tracker.spent).toBeCloseTo(0.8);
  });

  it("throws when a reservation would exceed the budget", () => {
    const tracker = new SpendTracker(1);
    tracker.reserve(0.9);
    expect(() => tracker.reserve(0.2)).toThrow();
  });
});

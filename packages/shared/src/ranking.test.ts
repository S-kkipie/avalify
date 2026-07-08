import { describe, expect, it } from "vitest";
import { rank, DEFAULT_WEIGHTS } from "./ranking.js";
import type { Candidate, JobSpec, ReputationSignal } from "./types.js";

const job: JobSpec = {
  capability: "dataset-summary",
  input: {},
  acceptSchema: {} as JobSpec["acceptSchema"],
  maxPriceUsdc: 1,
};

describe("rank", () => {
  it("puts trust ahead of price — a cheaper but less-trusted candidate never outranks a trusted one within budget", () => {
    const cheapUntrusted: Candidate = { serviceId: "cheap", agentId: "a1", priceUsdc: 0.1, slaSeconds: 60, deliverableType: "schema" };
    const pricierTrusted: Candidate = { serviceId: "trusted", agentId: "a2", priceUsdc: 0.9, slaSeconds: 60, deliverableType: "schema" };

    const signals = new Map<string, ReputationSignal>([
      ["cheap", { serviceId: "cheap", completionRate: 0.2, rejectRate: 0.7, latencyRatio: 1.5, avalScore: 0.1, sampleSize: 10 }],
      ["trusted", { serviceId: "trusted", completionRate: 0.98, rejectRate: 0.01, latencyRatio: 0.5, avalScore: 0.95, sampleSize: 10 }],
    ]);

    const ranked = rank([cheapUntrusted, pricierTrusted], signals, job);

    expect(ranked[0].serviceId).toBe("trusted");
  });

  it("excludes a candidate priced above the job budget", () => {
    const tooExpensive: Candidate = { serviceId: "over-budget", agentId: "a3", priceUsdc: 5, slaSeconds: 60, deliverableType: "schema" };
    const signals = new Map<string, ReputationSignal>([
      ["over-budget", { serviceId: "over-budget", completionRate: 1, rejectRate: 0, latencyRatio: 0.5, avalScore: 1, sampleSize: 10 }],
    ]);

    const ranked = rank([tooExpensive], signals, job);
    expect(ranked).toEqual([]);
  });

  it("excludes a candidate with no reputation signal at all", () => {
    const noSignal: Candidate = { serviceId: "unknown", agentId: "a4", priceUsdc: 0.5, slaSeconds: 60, deliverableType: "schema" };
    const ranked = rank([noSignal], new Map(), job);
    expect(ranked).toEqual([]);
  });

  it("records the composite score and human-readable reasons for the winner", () => {
    const only: Candidate = { serviceId: "solo", agentId: "a5", priceUsdc: 0.5, slaSeconds: 60, deliverableType: "schema" };
    const signals = new Map<string, ReputationSignal>([
      ["solo", { serviceId: "solo", completionRate: 0.9, rejectRate: 0.05, latencyRatio: 0.8, avalScore: 0.8, sampleSize: 10 }],
    ]);

    const ranked = rank([only], signals, job, DEFAULT_WEIGHTS);
    expect(ranked[0].score).toBeGreaterThan(0);
    expect(ranked[0].reasons.length).toBeGreaterThan(0);
  });
});

import { describe, expect, it, vi } from "vitest";
import { Broker, NoAcceptableProviderError } from "./broker.js";
import type { Aval, Candidate, CandidateSource, JobSpec, ReputationReader, ReputationSignal, Verdict } from "@avalify/shared";

const job: JobSpec = {
  capability: "dataset-summary",
  input: { dataset: "demo.csv" },
  acceptSchema: {} as JobSpec["acceptSchema"],
  maxPriceUsdc: 1,
};

const goodCandidate: Candidate = { serviceId: "svc-good", agentId: "agent-good", priceUsdc: 0.5, slaSeconds: 120, deliverableType: "schema" };
const badCandidate: Candidate = { serviceId: "svc-bad", agentId: "agent-bad", priceUsdc: 0.4, slaSeconds: 60, deliverableType: "schema" };

function makeDeps(candidates: Candidate[], verdicts: Record<string, Verdict>) {
  const candidateSource: CandidateSource = { find: async () => candidates };

  const signals: Record<string, ReputationSignal> = {
    "svc-good": { serviceId: "svc-good", completionRate: 0.95, rejectRate: 0.02, latencyRatio: 0.6, avalScore: 0.9, sampleSize: 10 },
    "svc-bad": { serviceId: "svc-bad", completionRate: 0.4, rejectRate: 0.3, latencyRatio: 1.2, avalScore: 0.2, sampleSize: 10 },
  };
  const reputation: ReputationReader = { read: async (c) => signals[c.serviceId] };

  const hire = vi.fn(async (candidate: Candidate) => ({
    orderId: `order-${candidate.serviceId}`,
    deliverableType: "schema" as const,
    deliverableText: "",
    deliverableSchema: "{}",
    payTxHash: `0xpay-${candidate.serviceId}`,
    deliverTxHash: `0xdeliver-${candidate.serviceId}`,
  }));
  const tryReject = vi.fn(async () => true);
  const requester = { hire, tryReject };

  const verifier = { verify: (delivery: { orderId: string }, _job: JobSpec): Verdict => {
    const serviceId = delivery.orderId.replace("order-", "");
    return verdicts[serviceId];
  } };

  const written: Aval[] = [];
  const avalStore = { write: async (aval: Aval) => { written.push(aval); }, history: async () => [] };

  return { candidateSource, reputation, requester, verifier, avalStore, written, hire, tryReject };
}

describe("Broker.run", () => {
  it("Run 1 (happy path): hires the highest-ranked (most trusted) candidate and returns a positive aval", async () => {
    const deps = makeDeps([goodCandidate, badCandidate], {
      "svc-good": { ok: true, checks: [] },
      "svc-bad": { ok: true, checks: [] },
    });
    const broker = new Broker(deps);

    const aval = await broker.run(job);

    expect(aval.outcome).toBe("positive");
    expect(aval.chosen.serviceId).toBe("svc-good");
    expect(deps.hire).toHaveBeenCalledTimes(1);
    expect(deps.written).toHaveLength(1);
  });

  it("Run 2 (adversarial): routes around a candidate that fails verification and still completes with a negative aval on record", async () => {
    const deps = makeDeps([goodCandidate, badCandidate], {
      "svc-good": { ok: false, checks: [{ name: "matches-accept-schema", pass: false }] },
      "svc-bad": { ok: true, checks: [] },
    });
    const broker = new Broker(deps);

    const aval = await broker.run(job);

    expect(deps.hire).toHaveBeenCalledTimes(2);
    expect(deps.tryReject).toHaveBeenCalledTimes(1);
    expect(deps.written).toHaveLength(2);
    expect(deps.written[0].outcome).toBe("negative");
    expect(deps.written[0].chosen.serviceId).toBe("svc-good");
    expect(aval.outcome).toBe("positive");
    expect(aval.reroutedFrom).toBe("svc-good");
  });

  it("throws NoAcceptableProviderError when every candidate fails verification", async () => {
    const deps = makeDeps([goodCandidate], { "svc-good": { ok: false, checks: [] } });
    const broker = new Broker(deps);
    await expect(broker.run(job)).rejects.toThrow(NoAcceptableProviderError);
  });

  it("throws NoAcceptableProviderError when there are no candidates at all", async () => {
    const deps = makeDeps([], {});
    const broker = new Broker(deps);
    await expect(broker.run(job)).rejects.toThrow(NoAcceptableProviderError);
  });
});

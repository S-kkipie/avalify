import type { z } from "zod";

export interface JobSpec {
  capability: string;
  input: unknown;
  acceptSchema: z.ZodTypeAny;
  maxPriceUsdc: number;
  candidateServiceIds?: string[];
}

export interface Candidate {
  serviceId: string;
  agentId: string;
  priceUsdc: number;
  slaSeconds: number;
  deliverableType: "text" | "schema";
}

export interface ReputationSignal {
  serviceId: string;
  completionRate: number;
  rejectRate: number;
  latencyRatio: number;
  avalScore: number;
  onchainMerit?: number;
  sampleSize: number;
}

export interface RankedCandidate extends Candidate {
  score: number;
  reasons: string[];
}

export interface VerdictCheck {
  name: string;
  pass: boolean;
  detail?: string;
}

export interface Verdict {
  ok: boolean;
  checks: VerdictCheck[];
}

export interface Aval {
  jobCapability: string;
  chosen: { serviceId: string; agentId: string };
  considered: RankedCandidate[];
  verdict: Verdict;
  orderId: string;
  settlementTxHash?: string;
  outcome: "positive" | "negative";
  reroutedFrom?: string;
  timestampMs: number;
}

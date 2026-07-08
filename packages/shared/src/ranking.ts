import type { Candidate, JobSpec, RankedCandidate, ReputationSignal } from "./types.js";

export interface RankingWeights {
  trust: number;
  price: number;
  sla: number;
  minSampleSize: number;
}

export const DEFAULT_WEIGHTS: RankingWeights = {
  trust: 0.8,
  price: 0.1,
  sla: 0.1,
  minSampleSize: 3,
};

function trustScore(sig: ReputationSignal): number {
  const merit = sig.onchainMerit ?? 0.5;
  return 0.4 * sig.completionRate + 0.3 * (1 - sig.rejectRate) + 0.2 * sig.avalScore + 0.1 * merit;
}

function priceFit(priceUsdc: number, maxPriceUsdc: number): number {
  if (maxPriceUsdc <= 0) return 0;
  return Math.max(0, 1 - priceUsdc / maxPriceUsdc);
}

function slaFit(latencyRatio: number): number {
  return Math.max(0, 1 - Math.min(latencyRatio, 2) / 2);
}

export function rank(
  candidates: Candidate[],
  signals: Map<string, ReputationSignal>,
  job: JobSpec,
  weights: RankingWeights = DEFAULT_WEIGHTS
): RankedCandidate[] {
  const scored = candidates.map((candidate) => {
    const sig = signals.get(candidate.serviceId);
    const reasons: string[] = [];

    if (!sig) {
      reasons.push("no reputation signal available — treated as untrusted");
      return { ...candidate, score: Number.NEGATIVE_INFINITY, reasons };
    }

    if (candidate.priceUsdc > job.maxPriceUsdc) {
      reasons.push(`price ${candidate.priceUsdc} exceeds job budget ${job.maxPriceUsdc}`);
      return { ...candidate, score: Number.NEGATIVE_INFINITY, reasons };
    }

    if (sig.sampleSize < weights.minSampleSize) {
      reasons.push(`sample size ${sig.sampleSize} below minimum ${weights.minSampleSize} — reduced confidence`);
    }

    const trust = trustScore(sig);
    const price = priceFit(candidate.priceUsdc, job.maxPriceUsdc);
    const sla = slaFit(sig.latencyRatio);
    const score = weights.trust * trust + weights.price * price + weights.sla * sla;

    reasons.push(`trust=${trust.toFixed(3)} (completion=${sig.completionRate.toFixed(2)}, reject=${sig.rejectRate.toFixed(2)}, aval=${sig.avalScore.toFixed(2)})`);
    reasons.push(`price fit=${price.toFixed(3)}, sla fit=${sla.toFixed(3)}`);
    reasons.push(`composite score=${score.toFixed(3)}`);

    return { ...candidate, score, reasons };
  });

  return scored
    .filter((c) => c.score > Number.NEGATIVE_INFINITY)
    .sort((a, b) => b.score - a.score);
}

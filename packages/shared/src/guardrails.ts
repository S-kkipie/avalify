import type { JobSpec, RankedCandidate } from "./types.js";

export interface GuardrailConfig {
  allowlist?: string[];
  denylist?: string[];
  maxRouteArounds: number;
}

export const DEFAULT_GUARDRAILS: GuardrailConfig = {
  maxRouteArounds: 3,
};

export function filterByGuardrails(
  ranked: RankedCandidate[],
  job: JobSpec,
  config: GuardrailConfig = DEFAULT_GUARDRAILS
): RankedCandidate[] {
  return ranked
    .filter((candidate) => candidate.priceUsdc <= job.maxPriceUsdc)
    .filter((candidate) => !config.denylist?.includes(candidate.serviceId))
    .filter((candidate) => !config.allowlist || config.allowlist.length === 0 || config.allowlist.includes(candidate.serviceId))
    .slice(0, config.maxRouteArounds);
}

export class SpendTracker {
  private spentUsdc = 0;

  constructor(private budgetUsdc: number) {}

  reserve(amountUsdc: number): void {
    if (this.spentUsdc + amountUsdc > this.budgetUsdc) {
      throw new Error(`Spend cap exceeded: ${this.spentUsdc + amountUsdc} > budget ${this.budgetUsdc}`);
    }
    this.spentUsdc += amountUsdc;
  }

  get spent(): number {
    return this.spentUsdc;
  }
}

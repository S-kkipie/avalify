import {
  buildAval,
  filterByGuardrails,
  rank,
  DEFAULT_GUARDRAILS,
  DEFAULT_WEIGHTS,
  type Aval,
  type AvalStore,
  type Candidate,
  type CandidateSource,
  type GuardrailConfig,
  type HireResult,
  type JobSpec,
  type RankingWeights,
  type ReputationReader,
  type Verifier,
} from "@avalify/shared";

export class NoAcceptableProviderError extends Error {}

export interface HireRequester {
  hire(candidate: Candidate, job: JobSpec): Promise<HireResult>;
  tryReject(orderId: string, reason: string): Promise<boolean>;
}

export interface BrokerDeps {
  candidateSource: CandidateSource;
  reputation: ReputationReader;
  requester: HireRequester;
  verifier: Verifier;
  avalStore: AvalStore;
  weights?: RankingWeights;
  guardrails?: GuardrailConfig;
}

export class Broker {
  constructor(private deps: BrokerDeps) {}

  async run(job: JobSpec): Promise<Aval> {
    const candidates = await this.deps.candidateSource.find(job.capability, job.candidateServiceIds);
    if (candidates.length === 0) {
      throw new NoAcceptableProviderError(`no candidates for capability ${job.capability}`);
    }

    const signals = new Map();
    for (const candidate of candidates) {
      signals.set(candidate.serviceId, await this.deps.reputation.read(candidate));
    }

    const ranked = rank(candidates, signals, job, this.deps.weights ?? DEFAULT_WEIGHTS);
    const eligible = filterByGuardrails(ranked, job, this.deps.guardrails ?? DEFAULT_GUARDRAILS);
    if (eligible.length === 0) {
      throw new NoAcceptableProviderError("no candidate passed guardrails");
    }

    let reroutedFrom: string | undefined;

    for (const candidate of eligible) {
      const hire = await this.deps.requester.hire(candidate, job);
      const verdict = this.deps.verifier.verify(hire, job);
      const aval = buildAval(job, candidate, ranked, verdict, hire.orderId, hire.deliverTxHash, reroutedFrom);
      await this.deps.avalStore.write(aval);

      if (verdict.ok) return aval;

      await this.deps.requester.tryReject(hire.orderId, "failed post-delivery verification");
      reroutedFrom = candidate.serviceId;
    }

    throw new NoAcceptableProviderError("all candidates failed verification");
  }
}

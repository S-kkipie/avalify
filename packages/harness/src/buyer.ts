import { z } from "zod";
import { CapClient, Requester, loadAgentEnv, type Aval, type Candidate, type JobSpec } from "@avalify/shared";

export interface HireAvalifyOptions {
  buyerEnvPrefix: string;
  avalifyServiceId: string;
  avalifyAgentId: string;
  priceUsdc: number;
  slaSeconds: number;
  capability: string;
  input: unknown;
  maxPriceUsdc: number;
  candidateServiceIds?: string[];
}

export async function hireAvalify(opts: HireAvalifyOptions): Promise<Aval> {
  const env = loadAgentEnv(opts.buyerEnvPrefix);
  const cap = new CapClient(env);
  const requester = new Requester(cap);

  const avalifyAsCandidate: Candidate = {
    serviceId: opts.avalifyServiceId,
    agentId: opts.avalifyAgentId,
    priceUsdc: opts.priceUsdc,
    slaSeconds: opts.slaSeconds,
    deliverableType: "schema",
  };

  // Requester.hire() serializes job.input (only) as the CAP negotiation
  // requirements. Avalify's own service expects the full job request shape
  // on the wire (agent.ts's decodeJobRequest parses exactly this object),
  // so that shape has to be nested inside `input` here rather than spread
  // across JobSpec's top-level fields, which never get transmitted.
  const job: JobSpec = {
    capability: opts.capability,
    input: {
      capability: opts.capability,
      input: opts.input,
      maxPriceUsdc: opts.maxPriceUsdc,
      candidateServiceIds: opts.candidateServiceIds,
    },
    acceptSchema: z.any(),
    maxPriceUsdc: opts.maxPriceUsdc,
    candidateServiceIds: opts.candidateServiceIds,
  };

  const hire = await requester.hire(avalifyAsCandidate, job);
  return JSON.parse(hire.deliverableSchema) as Aval;
}

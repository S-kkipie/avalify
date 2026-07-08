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

  const job: JobSpec = {
    capability: opts.capability,
    input: opts.input,
    acceptSchema: z.any(),
    maxPriceUsdc: opts.maxPriceUsdc,
    candidateServiceIds: opts.candidateServiceIds,
  };

  const hire = await requester.hire(avalifyAsCandidate, job);
  return JSON.parse(hire.deliverableSchema) as Aval;
}

import { serve, type CapClient, type JobSpec } from "@avalify/shared";
import type { Broker } from "./broker.js";

interface RawJobRequest {
  capability: string;
  input: unknown;
  maxPriceUsdc: number;
  candidateServiceIds?: string[];
}

export function decodeJobRequest(requirements: string, acceptSchemaFor: (capability: string) => JobSpec["acceptSchema"]): JobSpec {
  const parsed = JSON.parse(requirements) as RawJobRequest;
  return {
    capability: parsed.capability,
    input: parsed.input,
    maxPriceUsdc: parsed.maxPriceUsdc,
    candidateServiceIds: parsed.candidateServiceIds,
    acceptSchema: acceptSchemaFor(parsed.capability),
  };
}

export async function startAvalifyService(
  cap: CapClient,
  broker: Broker,
  acceptSchemaFor: (capability: string) => JobSpec["acceptSchema"]
) {
  return serve(cap, async (ctx) => {
    const job = decodeJobRequest(ctx.requirements, acceptSchemaFor);
    const aval = await broker.run(job);
    return { deliverableType: "schema", content: JSON.stringify(aval) };
  });
}

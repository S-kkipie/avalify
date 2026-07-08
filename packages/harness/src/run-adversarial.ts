import { pathToFileURL } from "node:url";
import { hireAvalify } from "./buyer.js";
import type { Aval } from "@avalify/shared";

export async function runAdversarial(): Promise<Aval> {
  const aval = await hireAvalify({
    buyerEnvPrefix: "BUYER1",
    avalifyServiceId: process.env.AVALIFY_SERVICE_ID!,
    avalifyAgentId: process.env.AVALIFY_AGENT_ID!,
    priceUsdc: Number(process.env.AVALIFY_PRICE_USDC ?? "0.50"),
    slaSeconds: Number(process.env.AVALIFY_SLA_SECONDS ?? "120"),
    capability: "dataset-summary",
    input: { dataset: "demo-sales-2026-q2.csv" },
    maxPriceUsdc: Number(process.env.JOB_MAX_PRICE_USDC ?? "1.00"),
    // Puts the bad provider ahead of the good one in the candidate hint so
    // Run 2 exercises the broker's route-around instead of relying on
    // ranking alone to pick the bad candidate first.
    candidateServiceIds: [process.env.BAD_PROVIDER_SERVICE_ID!, process.env.GOOD_PROVIDER_SERVICE_ID!],
  });

  console.log("=== Run 2 (adversarial) ===");
  console.log(`Chosen provider: ${aval.chosen.serviceId}`);
  console.log(`Routed away from: ${aval.reroutedFrom ?? "n/a"}`);
  console.log(`Outcome: ${aval.outcome}`);
  console.log(`Settlement tx: ${aval.settlementTxHash ?? "not settled"}`);
  return aval;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAdversarial().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

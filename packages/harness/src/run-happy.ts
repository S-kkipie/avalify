import { pathToFileURL } from "node:url";
import { hireAvalify } from "./buyer.js";
import type { Aval } from "@avalify/shared";

export async function runHappy(): Promise<Aval> {
  const aval = await hireAvalify({
    buyerEnvPrefix: "BUYER1",
    avalifyServiceId: process.env.AVALIFY_SERVICE_ID!,
    avalifyAgentId: process.env.AVALIFY_AGENT_ID!,
    priceUsdc: Number(process.env.AVALIFY_PRICE_USDC ?? "0.50"),
    slaSeconds: Number(process.env.AVALIFY_SLA_SECONDS ?? "120"),
    capability: "dataset-summary",
    input: { dataset: "demo-sales-2026-q2.csv" },
    maxPriceUsdc: Number(process.env.JOB_MAX_PRICE_USDC ?? "1.00"),
  });

  console.log("=== Run 1 (happy path) ===");
  console.log(`Chosen provider: ${aval.chosen.serviceId}`);
  console.log(`Outcome: ${aval.outcome}`);
  console.log(`Settlement tx: ${aval.settlementTxHash ?? "not settled"}`);
  return aval;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runHappy().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

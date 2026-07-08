import { readFileSync } from "node:fs";
import { z } from "zod";
import {
  CapClient,
  ConfiguredRegistrySource,
  JsonFileAvalStore,
  ObservedReputationReader,
  Requester,
  SchemaVerifier,
  loadAgentEnv,
  type RegistryEntry,
} from "@avalify/shared";
import { Broker } from "./broker.js";
import { startAvalifyService } from "./agent.js";
import { guardrails, rankingWeights } from "./config.js";

const DATASET_SUMMARY_SCHEMA = z.object({
  status: z.literal("ok"),
  summary: z.string(),
  rowCount: z.number(),
});

function acceptSchemaFor(capability: string) {
  if (capability === "dataset-summary") return DATASET_SUMMARY_SCHEMA;
  throw new Error(`no accept schema registered for capability ${capability}`);
}

async function main() {
  const env = loadAgentEnv("AVALIFY");
  const cap = new CapClient(env);

  const registryPath = process.env.AVALIFY_REGISTRY_PATH ?? "./registry.json";
  const registry = JSON.parse(readFileSync(registryPath, "utf8")) as RegistryEntry[];
  const avalLogPath = process.env.AVALIFY_AVAL_LOG ?? "./avals.log";
  const avalStore = new JsonFileAvalStore(avalLogPath);

  const broker = new Broker({
    candidateSource: new ConfiguredRegistrySource(registry),
    reputation: new ObservedReputationReader(cap, avalStore),
    requester: new Requester(cap),
    verifier: new SchemaVerifier(),
    avalStore,
    weights: rankingWeights,
    guardrails,
  });

  await startAvalifyService(cap, broker, acceptSchemaFor);
  console.log("avalify: listening for hires");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

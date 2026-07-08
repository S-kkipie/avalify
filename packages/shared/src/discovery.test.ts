import { describe, expect, it } from "vitest";
import { ConfiguredRegistrySource, type RegistryEntry } from "./discovery.js";

const registry: RegistryEntry[] = [
  { capability: "dataset-summary", serviceId: "svc-good", agentId: "agent-good", priceUsdc: 0.5, slaSeconds: 120, deliverableType: "schema" },
  { capability: "dataset-summary", serviceId: "svc-bad", agentId: "agent-bad", priceUsdc: 0.3, slaSeconds: 60, deliverableType: "schema" },
  { capability: "other-capability", serviceId: "svc-other", agentId: "agent-other", priceUsdc: 1, slaSeconds: 30, deliverableType: "text" },
];

describe("ConfiguredRegistrySource", () => {
  it("finds only candidates matching the requested capability", async () => {
    const source = new ConfiguredRegistrySource(registry);
    const found = await source.find("dataset-summary");
    expect(found.map((c) => c.serviceId).sort()).toEqual(["svc-bad", "svc-good"]);
  });

  it("filters by hinted serviceIds when provided", async () => {
    const source = new ConfiguredRegistrySource(registry);
    const found = await source.find("dataset-summary", ["svc-bad"]);
    expect(found.map((c) => c.serviceId)).toEqual(["svc-bad"]);
  });

  it("returns an empty array for an unknown capability", async () => {
    const source = new ConfiguredRegistrySource(registry);
    const found = await source.find("unknown-capability");
    expect(found).toEqual([]);
  });
});

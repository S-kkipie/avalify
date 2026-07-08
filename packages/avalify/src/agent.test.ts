import { describe, expect, it } from "vitest";
import { z } from "zod";
import { decodeJobRequest } from "./agent.js";

describe("decodeJobRequest", () => {
  it("decodes a raw requirements JSON string into a JobSpec using the capability's accept schema", () => {
    const requirements = JSON.stringify({
      capability: "dataset-summary",
      input: { dataset: "demo.csv" },
      maxPriceUsdc: 0.75,
      candidateServiceIds: ["svc-good", "svc-bad"],
    });

    const schema = z.object({ status: z.literal("ok") });
    const job = decodeJobRequest(requirements, () => schema);

    expect(job.capability).toBe("dataset-summary");
    expect(job.input).toEqual({ dataset: "demo.csv" });
    expect(job.maxPriceUsdc).toBe(0.75);
    expect(job.candidateServiceIds).toEqual(["svc-good", "svc-bad"]);
    expect(job.acceptSchema).toBe(schema);
  });
});

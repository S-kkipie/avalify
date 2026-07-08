import { describe, expect, it } from "vitest";
import { z } from "zod";
import { SchemaVerifier } from "./verify.js";
import type { JobSpec } from "./types.js";
import type { HireResult } from "./cap/requester.js";

const acceptSchema = z.object({
  status: z.literal("ok"),
  summary: z.string(),
  rowCount: z.number(),
});

const job: JobSpec = {
  capability: "dataset-summary",
  input: {},
  acceptSchema,
  maxPriceUsdc: 1,
};

function delivery(schema: string): HireResult {
  return {
    orderId: "order-1",
    deliverableType: "schema",
    deliverableText: "",
    deliverableSchema: schema,
    payTxHash: "0xpay",
    deliverTxHash: "0xdeliver",
  };
}

describe("SchemaVerifier", () => {
  it("passes a deliverable matching the accept schema", () => {
    const verifier = new SchemaVerifier();
    const verdict = verifier.verify(delivery(JSON.stringify({ status: "ok", summary: "done", rowCount: 128 })), job);
    expect(verdict.ok).toBe(true);
  });

  it("fails a deliverable with the wrong shape", () => {
    const verifier = new SchemaVerifier();
    const verdict = verifier.verify(delivery(JSON.stringify({ status: "lol", garbage: true })), job);
    expect(verdict.ok).toBe(false);
    expect(verdict.checks.find((c) => c.name === "matches-accept-schema")?.pass).toBe(false);
  });

  it("fails a deliverable that isn't valid JSON", () => {
    const verifier = new SchemaVerifier();
    const verdict = verifier.verify(delivery("not json at all"), job);
    expect(verdict.ok).toBe(false);
    expect(verdict.checks.find((c) => c.name === "content-is-valid-json")?.pass).toBe(false);
  });
});

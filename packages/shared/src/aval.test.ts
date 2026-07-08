import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildAval, JsonFileAvalStore } from "./aval.js";
import type { JobSpec, RankedCandidate, Verdict } from "./types.js";

const job: JobSpec = {
  capability: "dataset-summary",
  input: { dataset: "demo.csv" },
  acceptSchema: { safeParse: () => ({ success: true }) } as unknown as JobSpec["acceptSchema"],
  maxPriceUsdc: 1,
};

const chosen: RankedCandidate = {
  serviceId: "svc-good",
  agentId: "agent-good",
  priceUsdc: 0.5,
  slaSeconds: 120,
  deliverableType: "schema",
  score: 0.9,
  reasons: ["trusted"],
};

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("buildAval", () => {
  it("builds a positive aval from an ok verdict", () => {
    const verdict: Verdict = { ok: true, checks: [] };
    const aval = buildAval(job, chosen, [chosen], verdict, "order-1", "0xsettle", undefined, () => 1000);

    expect(aval.outcome).toBe("positive");
    expect(aval.chosen).toEqual({ serviceId: "svc-good", agentId: "agent-good" });
    expect(aval.settlementTxHash).toBe("0xsettle");
    expect(aval.timestampMs).toBe(1000);
  });

  it("builds a negative aval from a failing verdict", () => {
    const verdict: Verdict = { ok: false, checks: [{ name: "schema", pass: false, detail: "bad shape" }] };
    const aval = buildAval(job, chosen, [chosen], verdict, "order-2", undefined, "svc-bad", () => 2000);

    expect(aval.outcome).toBe("negative");
    expect(aval.reroutedFrom).toBe("svc-bad");
    expect(aval.settlementTxHash).toBeUndefined();
  });
});

describe("JsonFileAvalStore", () => {
  it("appends avals and reads back history filtered by serviceId", async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "avalify-test-"));
    const store = new JsonFileAvalStore(join(tmpDir, "avals.log"));

    const positive = buildAval(job, chosen, [chosen], { ok: true, checks: [] }, "order-1", "0xsettle", undefined, () => 1000);
    const negative = buildAval(job, chosen, [chosen], { ok: false, checks: [] }, "order-2", undefined, undefined, () => 2000);

    await store.write(positive);
    await store.write(negative);

    const history = await store.history("svc-good");
    expect(history).toHaveLength(2);
    expect(history[0].outcome).toBe("positive");
    expect(history[1].outcome).toBe("negative");
  });

  it("returns an empty history when the log file does not exist yet", async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "avalify-test-"));
    const store = new JsonFileAvalStore(join(tmpDir, "nonexistent.log"));
    const history = await store.history("svc-good");
    expect(history).toEqual([]);
  });
});

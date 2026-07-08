import { promises as fs } from "node:fs";
import type { Aval, JobSpec, RankedCandidate, Verdict } from "./types.js";

export function buildAval(
  job: JobSpec,
  chosen: RankedCandidate,
  considered: RankedCandidate[],
  verdict: Verdict,
  orderId: string,
  settlementTxHash: string | undefined,
  reroutedFrom?: string,
  now: () => number = Date.now
): Aval {
  return {
    jobCapability: job.capability,
    chosen: { serviceId: chosen.serviceId, agentId: chosen.agentId },
    considered,
    verdict,
    orderId,
    settlementTxHash,
    outcome: verdict.ok ? "positive" : "negative",
    reroutedFrom,
    timestampMs: now(),
  };
}

export interface AvalStore {
  write(aval: Aval): Promise<void>;
  history(serviceId: string): Promise<Aval[]>;
}

export class JsonFileAvalStore implements AvalStore {
  constructor(private filePath: string) {}

  async write(aval: Aval): Promise<void> {
    await fs.appendFile(this.filePath, JSON.stringify(aval) + "\n", "utf8");
  }

  async history(serviceId: string): Promise<Aval[]> {
    let raw: string;
    try {
      raw = await fs.readFile(this.filePath, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
    return raw
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as Aval)
      .filter((aval) => aval.chosen.serviceId === serviceId);
  }
}

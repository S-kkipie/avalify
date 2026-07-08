import type { JobSpec, Verdict, VerdictCheck } from "./types.js";
import type { HireResult } from "./cap/requester.js";

export interface Verifier {
  verify(delivery: HireResult, job: JobSpec): Verdict;
}

export class SchemaVerifier implements Verifier {
  verify(delivery: HireResult, job: JobSpec): Verdict {
    const checks: VerdictCheck[] = [];

    const typeKnown = delivery.deliverableType === "schema" || delivery.deliverableType === "text";
    checks.push({ name: "deliverable-type-known", pass: typeKnown });

    const raw = delivery.deliverableType === "schema" ? delivery.deliverableSchema : delivery.deliverableText;
    let parsed: unknown;
    let parseOk = true;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parseOk = false;
    }
    checks.push({ name: "content-is-valid-json", pass: parseOk });

    let schemaOk = false;
    let schemaDetail: string | undefined;
    if (parseOk) {
      const result = job.acceptSchema.safeParse(parsed);
      schemaOk = result.success;
      schemaDetail = result.success ? undefined : result.error.issues.map((i) => i.message).join("; ");
    }
    checks.push({ name: "matches-accept-schema", pass: schemaOk, detail: schemaDetail });

    return { ok: checks.every((c) => c.pass), checks };
  }
}

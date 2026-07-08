# Avalify Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Avalify monorepo scaffold — `shared`, `avalify`, `providers`, `harness` — implementing the full trust-broker loop (discover → compose reputation → rank trust-first → hire → verify → write aval → route-around on failure) so it compiles against the real `@croo-network/sdk` and is fully unit-tested with fakes, ready for real CAP credentials to be dropped in per the Day-1 runbook.

**Architecture:** pnpm workspace, 4 TypeScript packages. All `@croo-network/sdk` contact is isolated in `packages/shared/src/cap/client.ts`; every other module depends on `shared`'s typed interfaces, never on the SDK directly. Pure decision logic (ranking, verification, guardrails, aval-building) is dependency-injected and unit-tested with fakes — no network or Dashboard account needed to prove the loop works. Only the harness demo scripts (`run-happy`, `run-adversarial`, `demo`) require real CAP credentials to execute, per `docs/superpowers/specs/2026-07-06-avalify-scaffold-design.md` §10.

**Tech Stack:** Node ≥20, pnpm workspaces, TypeScript 5 (strict, NodeNext), `@croo-network/sdk` 0.2.x (confirmed real package, verified against its shipped `.d.ts` — see Global Constraints), `zod` 3.x, `vitest` 2.x, `tsx` for running TS entrypoints without a build step.

## Global Constraints

- Node ≥ 20, pnpm workspaces, TypeScript strict mode, `moduleResolution: NodeNext` — internal relative imports use explicit `.js` extensions (spec §2).
- All `@croo-network/sdk` imports live **only** in `packages/shared/src/cap/client.ts` (spec §2 boundary rule). No other file imports `@croo-network/sdk` directly.
- `shared` has zero dependency on `avalify`/`providers`/`harness`. The three app packages depend on `shared`, never on each other (spec §2).
- No secrets in code — every credential comes from env, validated once via `loadAgentEnv` (spec §2, §3).
- Real confirmed `@croo-network/sdk@0.2.1` surface (verified by extracting the published tarball's `.d.ts` files, not assumed from docs):
  - `AgentClient(config: { baseURL, wsURL?, rpcURL?, logger? }, sdkKey: string)`.
  - Methods used here: `negotiateOrder`, `payOrder`, `acceptNegotiation`, `deliverOrder`, `rejectOrder`, `getOrder`, `listOrders`, `getDelivery`, `getNegotiation`, `connectWebSocket`.
  - `connectWebSocket()` returns an already-connected `EventStream` with `.on(eventType, handler)`, `.onAny(handler)`, `.close()`.
  - `EventType` values are real strings like `"order_negotiation_created"`, `"order_paid"`, etc. (not guessed).
  - `Order` has `status`, `payTxHash`, `deliverTxHash`, `createdAt`, `deliveredAt`, `slaDeadline` as string fields — used for latency-ratio computation.
  - `Delivery` has `deliverableType`, `deliverableText`, `deliverableSchema` as plain strings (no generic content field).
  - `negotiateOrder` returns only a `Negotiation` (no order yet) — the order is created by the **provider's** `acceptNegotiation`, surfaced to the requester via the `OrderCreated` websocket event. This is why `Requester.hire()` must listen on the event stream rather than trust `negotiateOrder`'s return value for an order id.
- Never fabricate a settlement tx hash — `Aval.settlementTxHash` is either the real value from `DeliverOrderResult`/`Order.deliverTxHash` or `undefined`, printed as "not settled" (spec §8, README "Honesty").
- Trust-first ranking: composite score weights must keep `trust ≫ price, sla` so a cheaper-but-less-trusted candidate never outranks a trusted one within budget (spec §3, ranking-spec doc).
- Deliverable prices in any wired demo config are $0.10–$1.00 (spec §0) — this plan doesn't hardcode a mainnet transaction, but any example/registry values must respect this range.

---

## File Structure

```
avalify/
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ tsconfig.json                       # root orchestrator (tsc -b references)
├─ vitest.config.ts
├─ package.json
├─ .env.example                        # extended with per-agent keys
└─ packages/
   ├─ shared/
   │  ├─ package.json
   │  ├─ tsconfig.json
   │  └─ src/
   │     ├─ index.ts                   # barrel export
   │     ├─ types.ts                   # domain types
   │     ├─ env.ts                     # loadAgentEnv()
   │     ├─ cap/
   │     │  ├─ client.ts               # ONLY file that imports @croo-network/sdk
   │     │  ├─ client.test.ts
   │     │  ├─ requester.ts            # hire() / tryReject()
   │     │  ├─ requester.test.ts
   │     │  ├─ provider.ts             # serve() — shared provider event loop
   │     │  └─ provider.test.ts
   │     ├─ discovery.ts               # CandidateSource + ConfiguredRegistrySource
   │     ├─ discovery.test.ts
   │     ├─ aval.ts                    # buildAval() + JsonFileAvalStore
   │     ├─ aval.test.ts
   │     ├─ reputation.ts              # ObservedReputationReader
   │     ├─ reputation.test.ts
   │     ├─ ranking.ts                 # rank() — the differentiator
   │     ├─ ranking.test.ts
   │     ├─ verify.ts                  # SchemaVerifier
   │     ├─ verify.test.ts
   │     ├─ guardrails.ts              # filterByGuardrails() + SpendTracker
   │     └─ guardrails.test.ts
   ├─ avalify/
   │  ├─ package.json
   │  ├─ tsconfig.json
   │  ├─ registry.json.example
   │  └─ src/
   │     ├─ broker.ts                  # core loop with route-around
   │     ├─ broker.test.ts
   │     ├─ config.ts                  # default weights + guardrails
   │     ├─ agent.ts                   # decodeJobRequest() + startAvalifyService()
   │     ├─ agent.test.ts
   │     └─ main.ts                    # entrypoint
   ├─ providers/
   │  ├─ package.json
   │  ├─ tsconfig.json
   │  └─ src/
   │     ├─ good-provider.ts
   │     └─ bad-provider.ts
   └─ harness/
      ├─ package.json
      ├─ tsconfig.json
      └─ src/
         ├─ buyer.ts                   # hireAvalify()
         ├─ run-happy.ts               # exports runHappy() + CLI guard
         ├─ run-adversarial.ts         # exports runAdversarial() + CLI guard
         └─ demo.ts                    # runs both, prints tx hashes + narrative
```

**Deviation from the original scaffold spec, noted deliberately:** the spec's §5 lists a `packages/providers/src/serve.ts` in addition to `shared/cap/provider.ts` in §3 — these would be the same event-loop logic duplicated in two places. This plan keeps a single implementation in `shared/cap/provider.ts` (already the "loop building blocks" package per the spec's own architecture rule in §2) and has `good-provider.ts` / `bad-provider.ts` import `serve()` from `@avalify/shared` directly. No behavior is lost; `agent.ts` (Avalify's own provider loop) reuses the exact same `serve()`.

---

## Task 1: Monorepo scaffold

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `package.json`
- Modify: `.gitignore`
- Create: `.env.example`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/index.ts`
- Create: `packages/avalify/package.json`, `packages/avalify/tsconfig.json`, `packages/avalify/src/main.ts` (stub)
- Create: `packages/providers/package.json`, `packages/providers/tsconfig.json`, `packages/providers/src/good-provider.ts` (stub)
- Create: `packages/harness/package.json`, `packages/harness/tsconfig.json`, `packages/harness/src/demo.ts` (stub)

**Interfaces:**
- Produces: a working `pnpm install && pnpm -r build` and `pnpm test` at the root, which every later task builds on.

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 2: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "composite": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

- [ ] **Step 3: Create root `tsconfig.json`**

```json
{
  "files": [],
  "references": [
    { "path": "packages/shared" },
    { "path": "packages/avalify" },
    { "path": "packages/providers" },
    { "path": "packages/harness" }
  ]
}
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Create root `package.json`**

```json
{
  "name": "avalify",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "tsc -b",
    "typecheck": "tsc -b --force --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@types/node": "^20.14.10",
    "dotenv": "^16.4.5",
    "tsx": "^4.16.2",
    "typescript": "^5.5.4",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 6: Append to `.gitignore`**

Add these lines if not already present:

```
node_modules/
dist/
*.tsbuildinfo
avals.log
.env
```

- [ ] **Step 7: Create `.env.example`**

```
CROO_API_URL=https://api.croo.network
CROO_WS_URL=wss://api.croo.network/ws
CROO_RPC_URL=

# One SDK-Key + signer key per Dashboard-registered agent (see docs/superpowers/specs/2026-07-06-avalify-scaffold-design.md §10)
AVALIFY_SDK_KEY=croo_sk_...
AVALIFY_PRIVATE_KEY=0x...
GOOD_PROVIDER_SDK_KEY=croo_sk_...
GOOD_PROVIDER_PRIVATE_KEY=0x...
BAD_PROVIDER_SDK_KEY=croo_sk_...
BAD_PROVIDER_PRIVATE_KEY=0x...
BUYER1_SDK_KEY=croo_sk_...
BUYER1_PRIVATE_KEY=0x...

# Demo wiring
AVALIFY_SERVICE_ID=
AVALIFY_AGENT_ID=
GOOD_PROVIDER_SERVICE_ID=
BAD_PROVIDER_SERVICE_ID=
AVALIFY_REGISTRY_PATH=./packages/avalify/registry.json
AVALIFY_AVAL_LOG=./avals.log
```

- [ ] **Step 8: Create `packages/shared/package.json`**

```json
{
  "name": "@avalify/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -b"
  },
  "dependencies": {
    "@croo-network/sdk": "^0.2.1",
    "zod": "^3.23.8"
  }
}
```

- [ ] **Step 9: Create `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 10: Create stub `packages/shared/src/index.ts`**

```ts
export {};
```

- [ ] **Step 11: Create `packages/avalify/package.json`**

```json
{
  "name": "@avalify/avalify",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/main.js",
  "scripts": {
    "build": "tsc -b",
    "start": "tsx src/main.ts"
  },
  "dependencies": {
    "@avalify/shared": "workspace:*",
    "zod": "^3.23.8"
  }
}
```

- [ ] **Step 12: Create `packages/avalify/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "references": [{ "path": "../shared" }]
}
```

- [ ] **Step 13: Create stub `packages/avalify/src/main.ts`**

```ts
console.log("avalify: not yet wired");
```

- [ ] **Step 14: Create `packages/providers/package.json`**

```json
{
  "name": "@avalify/providers",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/good-provider.js",
  "scripts": {
    "build": "tsc -b",
    "start:good": "tsx src/good-provider.ts",
    "start:bad": "tsx src/bad-provider.ts"
  },
  "dependencies": {
    "@avalify/shared": "workspace:*"
  }
}
```

- [ ] **Step 15: Create `packages/providers/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "references": [{ "path": "../shared" }]
}
```

- [ ] **Step 16: Create stub `packages/providers/src/good-provider.ts`**

```ts
console.log("good-provider: not yet wired");
```

- [ ] **Step 17: Create `packages/harness/package.json`**

```json
{
  "name": "@avalify/harness",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/demo.js",
  "scripts": {
    "build": "tsc -b",
    "run:happy": "tsx src/run-happy.ts",
    "run:adversarial": "tsx src/run-adversarial.ts",
    "run:demo": "tsx src/demo.ts"
  },
  "dependencies": {
    "@avalify/shared": "workspace:*",
    "zod": "^3.23.8"
  }
}
```

- [ ] **Step 18: Create `packages/harness/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "references": [{ "path": "../shared" }]
}
```

- [ ] **Step 19: Create stub `packages/harness/src/demo.ts`**

```ts
console.log("demo: not yet wired");
```

- [ ] **Step 20: Install and verify the build**

Run: `pnpm install && pnpm -r build`
Expected: all 4 packages compile with zero type errors (stubs only).

- [ ] **Step 21: Commit**

```bash
git add pnpm-workspace.yaml tsconfig.base.json tsconfig.json vitest.config.ts package.json .gitignore .env.example packages
git commit -m "chore: scaffold pnpm workspace with 4 packages"
```

---

## Task 2: `shared/types.ts` — domain types

**Files:**
- Create: `packages/shared/src/types.ts`

**Interfaces:**
- Produces: `JobSpec`, `Candidate`, `ReputationSignal`, `RankedCandidate`, `VerdictCheck`, `Verdict`, `Aval` — used by every later shared and app-package task.

- [ ] **Step 1: Write `packages/shared/src/types.ts`**

```ts
import type { z } from "zod";

export interface JobSpec {
  capability: string;
  input: unknown;
  acceptSchema: z.ZodTypeAny;
  maxPriceUsdc: number;
  candidateServiceIds?: string[];
}

export interface Candidate {
  serviceId: string;
  agentId: string;
  priceUsdc: number;
  slaSeconds: number;
  deliverableType: "text" | "schema";
}

export interface ReputationSignal {
  serviceId: string;
  completionRate: number;
  rejectRate: number;
  latencyRatio: number;
  avalScore: number;
  onchainMerit?: number;
  sampleSize: number;
}

export interface RankedCandidate extends Candidate {
  score: number;
  reasons: string[];
}

export interface VerdictCheck {
  name: string;
  pass: boolean;
  detail?: string;
}

export interface Verdict {
  ok: boolean;
  checks: VerdictCheck[];
}

export interface Aval {
  jobCapability: string;
  chosen: { serviceId: string; agentId: string };
  considered: RankedCandidate[];
  verdict: Verdict;
  orderId: string;
  settlementTxHash?: string;
  outcome: "positive" | "negative";
  reroutedFrom?: string;
  timestampMs: number;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm --filter @avalify/shared build`
Expected: no errors (no test — this file is pure type declarations, exercised transitively by every later test).

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): add domain types"
```

---

## Task 3: `shared/env.ts` — validated per-agent env loader

**Files:**
- Create: `packages/shared/src/env.ts`
- Create: `packages/shared/src/env.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `AgentEnv` type, `loadAgentEnv(prefix: string, env?: NodeJS.ProcessEnv): AgentEnv` — used by `cap/client.ts` (Task 4) and every `main.ts` / harness script.

- [ ] **Step 1: Write the failing test `packages/shared/src/env.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { loadAgentEnv } from "./env.js";

describe("loadAgentEnv", () => {
  it("parses a valid agent env under a prefix", () => {
    const fakeEnv = {
      CROO_API_URL: "https://api.croo.network",
      CROO_WS_URL: "wss://api.croo.network/ws",
      AVALIFY_SDK_KEY: "croo_sk_test",
      AVALIFY_PRIVATE_KEY: "0x" + "1".repeat(64),
    };

    const result = loadAgentEnv("AVALIFY", fakeEnv as unknown as NodeJS.ProcessEnv);

    expect(result).toEqual({
      apiUrl: "https://api.croo.network",
      wsUrl: "wss://api.croo.network/ws",
      rpcUrl: undefined,
      sdkKey: "croo_sk_test",
      privateKey: "0x" + "1".repeat(64),
    });
  });

  it("throws when the sdk key is missing", () => {
    const fakeEnv = {
      CROO_API_URL: "https://api.croo.network",
      CROO_WS_URL: "wss://api.croo.network/ws",
    };

    expect(() => loadAgentEnv("AVALIFY", fakeEnv as unknown as NodeJS.ProcessEnv)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @avalify/shared exec vitest run src/env.test.ts`
Expected: FAIL — `env.js` does not exist yet.

- [ ] **Step 3: Write `packages/shared/src/env.ts`**

```ts
import { z } from "zod";

const AgentEnvSchema = z.object({
  apiUrl: z.string().url(),
  wsUrl: z.string().url(),
  rpcUrl: z.string().url().optional(),
  sdkKey: z.string().min(1),
  privateKey: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
});

export type AgentEnv = z.infer<typeof AgentEnvSchema>;

export function loadAgentEnv(prefix: string, env: NodeJS.ProcessEnv = process.env): AgentEnv {
  const get = (key: string) => env[`${prefix}_${key}`];
  return AgentEnvSchema.parse({
    apiUrl: env.CROO_API_URL,
    wsUrl: env.CROO_WS_URL,
    rpcUrl: env.CROO_RPC_URL || undefined,
    sdkKey: get("SDK_KEY"),
    privateKey: get("PRIVATE_KEY") || undefined,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @avalify/shared exec vitest run src/env.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/env.ts packages/shared/src/env.test.ts
git commit -m "feat(shared): add validated per-agent env loader"
```

---

## Task 4: `shared/cap/client.ts` — the only file that touches `@croo-network/sdk`

**Files:**
- Create: `packages/shared/src/cap/client.ts`
- Create: `packages/shared/src/cap/client.test.ts`

**Interfaces:**
- Consumes: `AgentEnv` from `../env.js` (Task 3).
- Produces: `CapClient` class with methods `negotiateOrder`, `payOrder`, `acceptNegotiation`, `deliverOrder`, `rejectOrder`, `getOrder`, `listOrders`, `getDelivery`, `getNegotiation`, `connectWebSocket`; re-exports `EventType` from the SDK. Used by `requester.ts` (Task 11), `provider.ts` (Task 12), `reputation.ts` (Task 7), and every `main.ts`.

- [ ] **Step 1: Write the failing test `packages/shared/src/cap/client.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import { CapClient, type AgentClientFactory } from "./client.js";
import type { AgentEnv } from "../env.js";

const fakeEnv: AgentEnv = {
  apiUrl: "https://api.croo.network",
  wsUrl: "wss://api.croo.network/ws",
  rpcUrl: undefined,
  sdkKey: "croo_sk_test",
  privateKey: undefined,
};

function fakeUnderlyingClient() {
  return {
    negotiateOrder: vi.fn().mockResolvedValue({ negotiationId: "neg-1" }),
    payOrder: vi.fn().mockResolvedValue({ order: { orderId: "order-1" }, txHash: "0xpay" }),
    acceptNegotiation: vi.fn().mockResolvedValue({ negotiation: {}, order: { orderId: "order-1" } }),
    deliverOrder: vi.fn().mockResolvedValue({ order: {}, delivery: {}, txHash: "0xdeliver" }),
    rejectOrder: vi.fn().mockResolvedValue(undefined),
    getOrder: vi.fn().mockResolvedValue({ orderId: "order-1", status: "completed" }),
    listOrders: vi.fn().mockResolvedValue([]),
    getDelivery: vi.fn().mockResolvedValue({ orderId: "order-1", deliverableType: "schema" }),
    getNegotiation: vi.fn().mockResolvedValue({ negotiationId: "neg-1", requirements: "{}" }),
    connectWebSocket: vi.fn().mockResolvedValue({ on: vi.fn(), onAny: vi.fn(), close: vi.fn() }),
  };
}

describe("CapClient", () => {
  it("delegates each method to the underlying AgentClient built by the factory", async () => {
    const underlying = fakeUnderlyingClient();
    const factory: AgentClientFactory = vi.fn().mockReturnValue(underlying);

    const cap = new CapClient(fakeEnv, factory);

    expect(factory).toHaveBeenCalledWith(
      { baseURL: fakeEnv.apiUrl, wsURL: fakeEnv.wsUrl, rpcURL: fakeEnv.rpcUrl },
      fakeEnv.sdkKey
    );

    await cap.negotiateOrder("service-1", '{"task":"x"}');
    expect(underlying.negotiateOrder).toHaveBeenCalledWith({ serviceId: "service-1", requirements: '{"task":"x"}' });

    await cap.payOrder("order-1");
    expect(underlying.payOrder).toHaveBeenCalledWith("order-1");

    await cap.deliverOrder("order-1", "schema", '{"ok":true}');
    expect(underlying.deliverOrder).toHaveBeenCalledWith("order-1", {
      deliverableType: "schema",
      deliverableText: undefined,
      deliverableSchema: '{"ok":true}',
    });

    await cap.getNegotiation("neg-1");
    expect(underlying.getNegotiation).toHaveBeenCalledWith("neg-1");

    await cap.connectWebSocket();
    expect(underlying.connectWebSocket).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @avalify/shared exec vitest run src/cap/client.test.ts`
Expected: FAIL — `client.ts` does not exist yet.

- [ ] **Step 3: Write `packages/shared/src/cap/client.ts`**

```ts
import { AgentClient, EventType, DeliverableType } from "@croo-network/sdk";
import type { Config, Order, Delivery, Negotiation, AcceptNegotiationResult, PayOrderResult, DeliverOrderResult, ListOptions } from "@croo-network/sdk";
import type { AgentEnv } from "../env.js";

export { EventType, DeliverableType };
export type { Order, Delivery, Negotiation };

export type AgentClientFactory = (config: Config, sdkKey: string) => AgentClient;

const defaultFactory: AgentClientFactory = (config, sdkKey) => new AgentClient(config, sdkKey);

export class CapClient {
  private client: AgentClient;

  constructor(env: AgentEnv, factory: AgentClientFactory = defaultFactory) {
    this.client = factory({ baseURL: env.apiUrl, wsURL: env.wsUrl, rpcURL: env.rpcUrl }, env.sdkKey);
  }

  async negotiateOrder(serviceId: string, requirements: string): Promise<Negotiation> {
    return this.client.negotiateOrder({ serviceId, requirements });
  }

  async acceptNegotiation(negotiationId: string): Promise<AcceptNegotiationResult> {
    return this.client.acceptNegotiation(negotiationId);
  }

  async payOrder(orderId: string): Promise<PayOrderResult> {
    return this.client.payOrder(orderId);
  }

  async deliverOrder(orderId: string, deliverableType: "text" | "schema", content: string): Promise<DeliverOrderResult> {
    return this.client.deliverOrder(orderId, {
      deliverableType,
      deliverableText: deliverableType === "text" ? content : undefined,
      deliverableSchema: deliverableType === "schema" ? content : undefined,
    });
  }

  async rejectOrder(orderId: string, reason: string): Promise<void> {
    return this.client.rejectOrder(orderId, reason);
  }

  async getOrder(orderId: string): Promise<Order> {
    return this.client.getOrder(orderId);
  }

  async listOrders(opts?: ListOptions): Promise<Order[]> {
    return this.client.listOrders(opts);
  }

  async getDelivery(orderId: string): Promise<Delivery> {
    return this.client.getDelivery(orderId);
  }

  async getNegotiation(negotiationId: string): Promise<Negotiation> {
    return this.client.getNegotiation(negotiationId);
  }

  async connectWebSocket() {
    return this.client.connectWebSocket();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @avalify/shared exec vitest run src/cap/client.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/cap/client.ts packages/shared/src/cap/client.test.ts
git commit -m "feat(shared): add CapClient wrapper isolating all @croo-network/sdk contact"
```

---

## Task 5: `shared/discovery.ts` — candidate source

**Files:**
- Create: `packages/shared/src/discovery.ts`
- Create: `packages/shared/src/discovery.test.ts`

**Interfaces:**
- Consumes: `Candidate` from `./types.js` (Task 2).
- Produces: `CandidateSource` interface, `RegistryEntry` type, `ConfiguredRegistrySource` class — used by `broker.ts` (Task 14).

- [ ] **Step 1: Write the failing test `packages/shared/src/discovery.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @avalify/shared exec vitest run src/discovery.test.ts`
Expected: FAIL — `discovery.ts` does not exist yet.

- [ ] **Step 3: Write `packages/shared/src/discovery.ts`**

```ts
import type { Candidate } from "./types.js";

export interface CandidateSource {
  find(capability: string, hint?: string[]): Promise<Candidate[]>;
}

export interface RegistryEntry extends Candidate {
  capability: string;
}

export class ConfiguredRegistrySource implements CandidateSource {
  constructor(private registry: RegistryEntry[]) {}

  async find(capability: string, hint?: string[]): Promise<Candidate[]> {
    const matches = this.registry.filter((entry) => entry.capability === capability);
    const filtered = hint && hint.length > 0 ? matches.filter((entry) => hint.includes(entry.serviceId)) : matches;
    return filtered.map(({ capability: _capability, ...candidate }) => candidate);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @avalify/shared exec vitest run src/discovery.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/discovery.ts packages/shared/src/discovery.test.ts
git commit -m "feat(shared): add curated-registry candidate source"
```

---

## Task 6: `shared/aval.ts` — build + append-only store

**Files:**
- Create: `packages/shared/src/aval.ts`
- Create: `packages/shared/src/aval.test.ts`

**Interfaces:**
- Consumes: `Aval`, `JobSpec`, `RankedCandidate`, `Verdict` from `./types.js` (Task 2).
- Produces: `buildAval(...)`, `AvalStore` interface, `JsonFileAvalStore` class — used by `reputation.ts` (Task 7) and `broker.ts` (Task 14).

- [ ] **Step 1: Write the failing test `packages/shared/src/aval.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @avalify/shared exec vitest run src/aval.test.ts`
Expected: FAIL — `aval.ts` does not exist yet.

- [ ] **Step 3: Write `packages/shared/src/aval.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @avalify/shared exec vitest run src/aval.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/aval.ts packages/shared/src/aval.test.ts
git commit -m "feat(shared): add aval builder and append-only JSON store"
```

---

## Task 7: `shared/reputation.ts` — composed reputation reader

**Files:**
- Create: `packages/shared/src/reputation.ts`
- Create: `packages/shared/src/reputation.test.ts`

**Interfaces:**
- Consumes: `Candidate`, `ReputationSignal` from `./types.js` (Task 2); `AvalStore` from `./aval.js` (Task 6); `Order` type from `./cap/client.js` (Task 4).
- Produces: `ReputationReader` interface, `OrderLister` interface, `ObservedReputationReader` class — used by `broker.ts` (Task 14).

- [ ] **Step 1: Write the failing test `packages/shared/src/reputation.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { ObservedReputationReader, type OrderLister } from "./reputation.js";
import type { AvalStore } from "./aval.js";
import type { Aval, Candidate } from "./types.js";
import type { Order } from "./cap/client.js";

const candidate: Candidate = {
  serviceId: "svc-good",
  agentId: "agent-good",
  priceUsdc: 0.5,
  slaSeconds: 120,
  deliverableType: "schema",
};

function fakeOrders(): Order[] {
  return [
    { status: "completed", createdAt: "2026-07-01T00:00:00Z", deliveredAt: "2026-07-01T00:01:00Z", slaDeadline: "2026-07-01T00:02:00Z" } as Order,
    { status: "completed", createdAt: "2026-07-01T00:00:00Z", deliveredAt: "2026-07-01T00:00:30Z", slaDeadline: "2026-07-01T00:02:00Z" } as Order,
    { status: "rejected", createdAt: "2026-07-01T00:00:00Z" } as Order,
  ];
}

describe("ObservedReputationReader", () => {
  it("computes completion/reject rate, latency ratio, and aval score from history", async () => {
    const orderLister: OrderLister = { listOrders: async () => fakeOrders() };
    const avalHistory: Aval[] = [
      { outcome: "positive" } as Aval,
      { outcome: "positive" } as Aval,
      { outcome: "negative" } as Aval,
    ];
    const avalStore: AvalStore = {
      write: async () => {},
      history: async () => avalHistory,
    };

    const reader = new ObservedReputationReader(orderLister, avalStore);
    const signal = await reader.read(candidate);

    expect(signal.serviceId).toBe("svc-good");
    expect(signal.sampleSize).toBe(3);
    expect(signal.completionRate).toBeCloseTo(2 / 3);
    expect(signal.rejectRate).toBeCloseTo(1 / 3);
    expect(signal.avalScore).toBeCloseTo(2 / 3);
    expect(signal.latencyRatio).toBeGreaterThan(0);
    expect(signal.latencyRatio).toBeLessThan(1);
  });

  it("falls back to neutral defaults when there is no order history", async () => {
    const orderLister: OrderLister = { listOrders: async () => [] };
    const avalStore: AvalStore = { write: async () => {}, history: async () => [] };

    const reader = new ObservedReputationReader(orderLister, avalStore);
    const signal = await reader.read(candidate);

    expect(signal.sampleSize).toBe(0);
    expect(signal.completionRate).toBe(0.5);
    expect(signal.rejectRate).toBe(0);
    expect(signal.avalScore).toBe(0.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @avalify/shared exec vitest run src/reputation.test.ts`
Expected: FAIL — `reputation.ts` does not exist yet.

- [ ] **Step 3: Write `packages/shared/src/reputation.ts`**

```ts
import type { Candidate, ReputationSignal } from "./types.js";
import type { AvalStore } from "./aval.js";
import type { Order, ListOptions } from "./cap/client.js";

export interface ReputationReader {
  read(candidate: Candidate): Promise<ReputationSignal>;
}

export interface OrderLister {
  listOrders(opts?: ListOptions): Promise<Order[]>;
}

export class ObservedReputationReader implements ReputationReader {
  constructor(private orders: OrderLister, private avalStore: AvalStore) {}

  async read(candidate: Candidate): Promise<ReputationSignal> {
    const history = await this.orders.listOrders({ agentId: candidate.agentId });
    const completed = history.filter((o) => o.status === "completed");
    const rejected = history.filter((o) => o.status === "rejected");
    const sampleSize = history.length;

    const completionRate = sampleSize > 0 ? completed.length / sampleSize : 0.5;
    const rejectRate = sampleSize > 0 ? rejected.length / sampleSize : 0;

    const ratios = completed.map(latencyRatio).filter((r): r is number => r !== null);
    const latencyRatioAvg = ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 1;

    const avalHistory = await this.avalStore.history(candidate.serviceId);
    const avalScore = avalHistory.length > 0
      ? avalHistory.filter((a) => a.outcome === "positive").length / avalHistory.length
      : 0.5;

    return {
      serviceId: candidate.serviceId,
      completionRate,
      rejectRate,
      latencyRatio: latencyRatioAvg,
      avalScore,
      sampleSize,
    };
  }
}

function latencyRatio(order: Order): number | null {
  if (!order.deliveredAt || !order.createdAt || !order.slaDeadline) return null;
  const created = Date.parse(order.createdAt);
  const delivered = Date.parse(order.deliveredAt);
  const slaDeadline = Date.parse(order.slaDeadline);
  if (Number.isNaN(created) || Number.isNaN(delivered) || Number.isNaN(slaDeadline)) return null;
  const allowed = slaDeadline - created;
  if (allowed <= 0) return null;
  return (delivered - created) / allowed;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @avalify/shared exec vitest run src/reputation.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/reputation.ts packages/shared/src/reputation.test.ts
git commit -m "feat(shared): compose reputation from order history and aval history"
```

---

## Task 8: `shared/ranking.ts` — trust-first composite scoring

**Files:**
- Create: `packages/shared/src/ranking.ts`
- Create: `packages/shared/src/ranking.test.ts`

**Interfaces:**
- Consumes: `Candidate`, `JobSpec`, `RankedCandidate`, `ReputationSignal` from `./types.js` (Task 2).
- Produces: `RankingWeights`, `DEFAULT_WEIGHTS`, `rank(...)` — used by `broker.ts` (Task 14).

- [ ] **Step 1: Write the failing test `packages/shared/src/ranking.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { rank, DEFAULT_WEIGHTS } from "./ranking.js";
import type { Candidate, JobSpec, ReputationSignal } from "./types.js";

const job: JobSpec = {
  capability: "dataset-summary",
  input: {},
  acceptSchema: {} as JobSpec["acceptSchema"],
  maxPriceUsdc: 1,
};

describe("rank", () => {
  it("puts trust ahead of price — a cheaper but less-trusted candidate never outranks a trusted one within budget", () => {
    const cheapUntrusted: Candidate = { serviceId: "cheap", agentId: "a1", priceUsdc: 0.1, slaSeconds: 60, deliverableType: "schema" };
    const pricierTrusted: Candidate = { serviceId: "trusted", agentId: "a2", priceUsdc: 0.9, slaSeconds: 60, deliverableType: "schema" };

    const signals = new Map<string, ReputationSignal>([
      ["cheap", { serviceId: "cheap", completionRate: 0.2, rejectRate: 0.7, latencyRatio: 1.5, avalScore: 0.1, sampleSize: 10 }],
      ["trusted", { serviceId: "trusted", completionRate: 0.98, rejectRate: 0.01, latencyRatio: 0.5, avalScore: 0.95, sampleSize: 10 }],
    ]);

    const ranked = rank([cheapUntrusted, pricierTrusted], signals, job);

    expect(ranked[0].serviceId).toBe("trusted");
  });

  it("excludes a candidate priced above the job budget", () => {
    const tooExpensive: Candidate = { serviceId: "over-budget", agentId: "a3", priceUsdc: 5, slaSeconds: 60, deliverableType: "schema" };
    const signals = new Map<string, ReputationSignal>([
      ["over-budget", { serviceId: "over-budget", completionRate: 1, rejectRate: 0, latencyRatio: 0.5, avalScore: 1, sampleSize: 10 }],
    ]);

    const ranked = rank([tooExpensive], signals, job);
    expect(ranked).toEqual([]);
  });

  it("excludes a candidate with no reputation signal at all", () => {
    const noSignal: Candidate = { serviceId: "unknown", agentId: "a4", priceUsdc: 0.5, slaSeconds: 60, deliverableType: "schema" };
    const ranked = rank([noSignal], new Map(), job);
    expect(ranked).toEqual([]);
  });

  it("records the composite score and human-readable reasons for the winner", () => {
    const only: Candidate = { serviceId: "solo", agentId: "a5", priceUsdc: 0.5, slaSeconds: 60, deliverableType: "schema" };
    const signals = new Map<string, ReputationSignal>([
      ["solo", { serviceId: "solo", completionRate: 0.9, rejectRate: 0.05, latencyRatio: 0.8, avalScore: 0.8, sampleSize: 10 }],
    ]);

    const ranked = rank([only], signals, job, DEFAULT_WEIGHTS);
    expect(ranked[0].score).toBeGreaterThan(0);
    expect(ranked[0].reasons.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @avalify/shared exec vitest run src/ranking.test.ts`
Expected: FAIL — `ranking.ts` does not exist yet.

- [ ] **Step 3: Write `packages/shared/src/ranking.ts`**

```ts
import type { Candidate, JobSpec, RankedCandidate, ReputationSignal } from "./types.js";

export interface RankingWeights {
  trust: number;
  price: number;
  sla: number;
  minSampleSize: number;
}

export const DEFAULT_WEIGHTS: RankingWeights = {
  trust: 0.8,
  price: 0.1,
  sla: 0.1,
  minSampleSize: 3,
};

function trustScore(sig: ReputationSignal): number {
  const merit = sig.onchainMerit ?? 0.5;
  return 0.4 * sig.completionRate + 0.3 * (1 - sig.rejectRate) + 0.2 * sig.avalScore + 0.1 * merit;
}

function priceFit(priceUsdc: number, maxPriceUsdc: number): number {
  if (maxPriceUsdc <= 0) return 0;
  return Math.max(0, 1 - priceUsdc / maxPriceUsdc);
}

function slaFit(latencyRatio: number): number {
  return Math.max(0, 1 - Math.min(latencyRatio, 2) / 2);
}

export function rank(
  candidates: Candidate[],
  signals: Map<string, ReputationSignal>,
  job: JobSpec,
  weights: RankingWeights = DEFAULT_WEIGHTS
): RankedCandidate[] {
  const scored = candidates.map((candidate) => {
    const sig = signals.get(candidate.serviceId);
    const reasons: string[] = [];

    if (!sig) {
      reasons.push("no reputation signal available — treated as untrusted");
      return { ...candidate, score: Number.NEGATIVE_INFINITY, reasons };
    }

    if (candidate.priceUsdc > job.maxPriceUsdc) {
      reasons.push(`price ${candidate.priceUsdc} exceeds job budget ${job.maxPriceUsdc}`);
      return { ...candidate, score: Number.NEGATIVE_INFINITY, reasons };
    }

    if (sig.sampleSize < weights.minSampleSize) {
      reasons.push(`sample size ${sig.sampleSize} below minimum ${weights.minSampleSize} — reduced confidence`);
    }

    const trust = trustScore(sig);
    const price = priceFit(candidate.priceUsdc, job.maxPriceUsdc);
    const sla = slaFit(sig.latencyRatio);
    const score = weights.trust * trust + weights.price * price + weights.sla * sla;

    reasons.push(`trust=${trust.toFixed(3)} (completion=${sig.completionRate.toFixed(2)}, reject=${sig.rejectRate.toFixed(2)}, aval=${sig.avalScore.toFixed(2)})`);
    reasons.push(`price fit=${price.toFixed(3)}, sla fit=${sla.toFixed(3)}`);
    reasons.push(`composite score=${score.toFixed(3)}`);

    return { ...candidate, score, reasons };
  });

  return scored
    .filter((c) => c.score > Number.NEGATIVE_INFINITY)
    .sort((a, b) => b.score - a.score);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @avalify/shared exec vitest run src/ranking.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/ranking.ts packages/shared/src/ranking.test.ts
git commit -m "feat(shared): add trust-first composite ranking"
```

---

## Task 9: `shared/verify.ts` — deliverable verifier

**Files:**
- Create: `packages/shared/src/verify.ts`
- Create: `packages/shared/src/verify.test.ts`

**Interfaces:**
- Consumes: `JobSpec`, `Verdict` from `./types.js` (Task 2); `HireResult` from `./cap/requester.js` (Task 11 — see note below on ordering).
- Produces: `Verifier` interface, `SchemaVerifier` class — used by `broker.ts` (Task 14).

> **Note on task ordering:** `verify.ts` depends on the `HireResult` type defined in Task 11 (`requester.ts`). Implement this task's type import against the shape below; Task 11 must produce a `HireResult` with exactly these fields (`orderId`, `deliverableType`, `deliverableText`, `deliverableSchema`, `payTxHash`, `deliverTxHash`). If executing tasks out of numeric order, do Task 11 first or stub the type locally — but the final field names must match across both files.

- [ ] **Step 1: Write the failing test `packages/shared/src/verify.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @avalify/shared exec vitest run src/verify.test.ts`
Expected: FAIL — `verify.ts` does not exist yet.

- [ ] **Step 3: Write `packages/shared/src/verify.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @avalify/shared exec vitest run src/verify.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/verify.ts packages/shared/src/verify.test.ts
git commit -m "feat(shared): add schema-based deliverable verifier"
```

---

## Task 10: `shared/guardrails.ts` — spend cap, allow/deny list, route-around cap

**Files:**
- Create: `packages/shared/src/guardrails.ts`
- Create: `packages/shared/src/guardrails.test.ts`

**Interfaces:**
- Consumes: `JobSpec`, `RankedCandidate` from `./types.js` (Task 2).
- Produces: `GuardrailConfig`, `DEFAULT_GUARDRAILS`, `filterByGuardrails(...)`, `SpendTracker` class — used by `broker.ts` (Task 14).

- [ ] **Step 1: Write the failing test `packages/shared/src/guardrails.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { filterByGuardrails, SpendTracker, DEFAULT_GUARDRAILS } from "./guardrails.js";
import type { JobSpec, RankedCandidate } from "./types.js";

const job: JobSpec = { capability: "dataset-summary", input: {}, acceptSchema: {} as JobSpec["acceptSchema"], maxPriceUsdc: 1 };

function candidate(serviceId: string, priceUsdc: number, score: number): RankedCandidate {
  return { serviceId, agentId: `agent-${serviceId}`, priceUsdc, slaSeconds: 60, deliverableType: "schema", score, reasons: [] };
}

describe("filterByGuardrails", () => {
  it("drops candidates on the denylist", () => {
    const ranked = [candidate("a", 0.5, 0.9), candidate("b", 0.5, 0.8)];
    const filtered = filterByGuardrails(ranked, job, { ...DEFAULT_GUARDRAILS, denylist: ["a"] });
    expect(filtered.map((c) => c.serviceId)).toEqual(["b"]);
  });

  it("keeps only allowlisted candidates when an allowlist is set", () => {
    const ranked = [candidate("a", 0.5, 0.9), candidate("b", 0.5, 0.8)];
    const filtered = filterByGuardrails(ranked, job, { ...DEFAULT_GUARDRAILS, allowlist: ["b"] });
    expect(filtered.map((c) => c.serviceId)).toEqual(["b"]);
  });

  it("drops candidates priced above the job's max price even if ranking missed it", () => {
    const ranked = [candidate("a", 5, 0.9)];
    const filtered = filterByGuardrails(ranked, job, DEFAULT_GUARDRAILS);
    expect(filtered).toEqual([]);
  });

  it("truncates the list to maxRouteArounds", () => {
    const ranked = [candidate("a", 0.5, 0.9), candidate("b", 0.5, 0.8), candidate("c", 0.5, 0.7)];
    const filtered = filterByGuardrails(ranked, job, { ...DEFAULT_GUARDRAILS, maxRouteArounds: 2 });
    expect(filtered).toHaveLength(2);
  });
});

describe("SpendTracker", () => {
  it("allows spend within budget and accumulates it", () => {
    const tracker = new SpendTracker(1);
    tracker.reserve(0.4);
    tracker.reserve(0.4);
    expect(tracker.spent).toBeCloseTo(0.8);
  });

  it("throws when a reservation would exceed the budget", () => {
    const tracker = new SpendTracker(1);
    tracker.reserve(0.9);
    expect(() => tracker.reserve(0.2)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @avalify/shared exec vitest run src/guardrails.test.ts`
Expected: FAIL — `guardrails.ts` does not exist yet.

- [ ] **Step 3: Write `packages/shared/src/guardrails.ts`**

```ts
import type { JobSpec, RankedCandidate } from "./types.js";

export interface GuardrailConfig {
  allowlist?: string[];
  denylist?: string[];
  maxRouteArounds: number;
}

export const DEFAULT_GUARDRAILS: GuardrailConfig = {
  maxRouteArounds: 3,
};

export function filterByGuardrails(
  ranked: RankedCandidate[],
  job: JobSpec,
  config: GuardrailConfig = DEFAULT_GUARDRAILS
): RankedCandidate[] {
  return ranked
    .filter((candidate) => candidate.priceUsdc <= job.maxPriceUsdc)
    .filter((candidate) => !config.denylist?.includes(candidate.serviceId))
    .filter((candidate) => !config.allowlist || config.allowlist.length === 0 || config.allowlist.includes(candidate.serviceId))
    .slice(0, config.maxRouteArounds);
}

export class SpendTracker {
  private spentUsdc = 0;

  constructor(private budgetUsdc: number) {}

  reserve(amountUsdc: number): void {
    if (this.spentUsdc + amountUsdc > this.budgetUsdc) {
      throw new Error(`Spend cap exceeded: ${this.spentUsdc + amountUsdc} > budget ${this.budgetUsdc}`);
    }
    this.spentUsdc += amountUsdc;
  }

  get spent(): number {
    return this.spentUsdc;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @avalify/shared exec vitest run src/guardrails.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/guardrails.ts packages/shared/src/guardrails.test.ts
git commit -m "feat(shared): add spend cap, allow/deny list, and route-around cap guardrails"
```

---

## Task 11: `shared/cap/requester.ts` — hire() over the real order lifecycle

**Files:**
- Create: `packages/shared/src/cap/requester.ts`
- Create: `packages/shared/src/cap/requester.test.ts`

**Interfaces:**
- Consumes: `CapClient`, `EventType` from `./client.js` (Task 4); `Candidate`, `JobSpec` from `../types.js` (Task 2).
- Produces: `HireResult` type (consumed by `verify.ts`, Task 9, and `broker.ts`, Task 14), `Requester` class with `hire(candidate, job)` and `tryReject(orderId, reason)`.

- [ ] **Step 1: Write the failing test `packages/shared/src/cap/requester.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import { Requester } from "./requester.js";
import { EventType } from "./client.js";
import type { Candidate, JobSpec } from "../types.js";

const candidate: Candidate = { serviceId: "svc-1", agentId: "agent-1", priceUsdc: 0.5, slaSeconds: 60, deliverableType: "schema" };
const job: JobSpec = { capability: "dataset-summary", input: { dataset: "x" }, acceptSchema: {} as JobSpec["acceptSchema"], maxPriceUsdc: 1 };

class FakeStream {
  private handlers = new Map<string, ((event: Record<string, string>) => void)[]>();

  on(eventType: string, handler: (event: Record<string, string>) => void): void {
    const list = this.handlers.get(eventType) ?? [];
    list.push(handler);
    this.handlers.set(eventType, list);
  }

  close = vi.fn();

  emit(eventType: string, event: Record<string, string>): void {
    for (const handler of this.handlers.get(eventType) ?? []) handler(event);
  }
}

function fakeCap(stream: FakeStream) {
  return {
    connectWebSocket: vi.fn().mockResolvedValue(stream),
    negotiateOrder: vi.fn().mockResolvedValue({ negotiationId: "neg-1" }),
    payOrder: vi.fn().mockResolvedValue({ order: { orderId: "order-1" }, txHash: "0xpay" }),
    getOrder: vi.fn().mockResolvedValue({ orderId: "order-1", deliverTxHash: "0xdeliver" }),
    getDelivery: vi.fn().mockResolvedValue({ deliverableType: "schema", deliverableText: "", deliverableSchema: '{"ok":true}' }),
    rejectOrder: vi.fn().mockResolvedValue(undefined),
  };
}

describe("Requester.hire", () => {
  it("negotiates, waits for OrderCreated, pays, waits for OrderCompleted, then fetches the delivery", async () => {
    const stream = new FakeStream();
    const cap = fakeCap(stream);
    const requester = new Requester(cap as any, 5_000);

    const hirePromise = requester.hire(candidate, job);

    await vi.waitFor(() => expect(cap.negotiateOrder).toHaveBeenCalled());
    stream.emit(EventType.OrderCreated, { negotiation_id: "neg-1", order_id: "order-1" });

    await vi.waitFor(() => expect(cap.payOrder).toHaveBeenCalledWith("order-1"));
    stream.emit(EventType.OrderCompleted, { order_id: "order-1" });

    const result = await hirePromise;

    expect(result.orderId).toBe("order-1");
    expect(result.deliverableSchema).toBe('{"ok":true}');
    expect(result.payTxHash).toBe("0xpay");
    expect(result.deliverTxHash).toBe("0xdeliver");
    expect(stream.close).toHaveBeenCalled();
  });
});

describe("Requester.tryReject", () => {
  it("returns true when rejectOrder succeeds", async () => {
    const stream = new FakeStream();
    const cap = fakeCap(stream);
    const requester = new Requester(cap as any, 5_000);
    await expect(requester.tryReject("order-1", "bad delivery")).resolves.toBe(true);
  });

  it("returns false when rejectOrder throws (order state no longer allows it)", async () => {
    const stream = new FakeStream();
    const cap = fakeCap(stream);
    cap.rejectOrder.mockRejectedValue(new Error("invalid status"));
    const requester = new Requester(cap as any, 5_000);
    await expect(requester.tryReject("order-1", "bad delivery")).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @avalify/shared exec vitest run src/cap/requester.test.ts`
Expected: FAIL — `requester.ts` does not exist yet.

- [ ] **Step 3: Write `packages/shared/src/cap/requester.ts`**

```ts
import { EventType, type CapClient } from "./client.js";
import type { Candidate, JobSpec } from "../types.js";

export interface HireResult {
  orderId: string;
  deliverableType: "text" | "schema";
  deliverableText: string;
  deliverableSchema: string;
  payTxHash: string;
  deliverTxHash: string;
}

export class Requester {
  constructor(private cap: CapClient, private timeoutMs = 60_000) {}

  async hire(candidate: Candidate, job: JobSpec): Promise<HireResult> {
    const stream = await this.cap.connectWebSocket();
    try {
      const negotiation = await this.cap.negotiateOrder(candidate.serviceId, JSON.stringify(job.input));

      const orderId = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`Timed out waiting for order creation for negotiation ${negotiation.negotiationId}`)),
          this.timeoutMs
        );
        stream.on(EventType.OrderCreated, (e: { negotiation_id?: string; order_id?: string }) => {
          if (e.negotiation_id === negotiation.negotiationId && e.order_id) {
            clearTimeout(timer);
            resolve(e.order_id);
          }
        });
      });

      const paid = await this.cap.payOrder(orderId);

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`Timed out waiting for completion of order ${orderId}`)),
          this.timeoutMs
        );
        stream.on(EventType.OrderCompleted, (e: { order_id?: string }) => {
          if (e.order_id === orderId) {
            clearTimeout(timer);
            resolve();
          }
        });
      });

      const [delivery, order] = await Promise.all([this.cap.getDelivery(orderId), this.cap.getOrder(orderId)]);

      return {
        orderId,
        deliverableType: delivery.deliverableType as "text" | "schema",
        deliverableText: delivery.deliverableText,
        deliverableSchema: delivery.deliverableSchema,
        payTxHash: paid.txHash,
        deliverTxHash: order.deliverTxHash,
      };
    } finally {
      stream.close();
    }
  }

  async tryReject(orderId: string, reason: string): Promise<boolean> {
    try {
      await this.cap.rejectOrder(orderId, reason);
      return true;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @avalify/shared exec vitest run src/cap/requester.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/cap/requester.ts packages/shared/src/cap/requester.test.ts
git commit -m "feat(shared): add Requester.hire() over the real negotiate/pay/deliver event lifecycle"
```

---

## Task 12: `shared/cap/provider.ts` + barrel export

**Files:**
- Create: `packages/shared/src/cap/provider.ts`
- Create: `packages/shared/src/cap/provider.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: `CapClient`, `EventType` from `./client.js` (Task 4).
- Produces: `OrderContext`, `DeliverFn`, `serve(cap, onOrder)` — used by `packages/providers` (Task 13) and `packages/avalify/agent.ts` (Task 15). Also finalizes the `@avalify/shared` barrel export consumed by every app package from here on.

- [ ] **Step 1: Write the failing test `packages/shared/src/cap/provider.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import { serve } from "./provider.js";
import { EventType } from "./client.js";

class FakeStream {
  private handlers = new Map<string, ((event: Record<string, string>) => void)[]>();

  on(eventType: string, handler: (event: Record<string, string>) => void): void {
    const list = this.handlers.get(eventType) ?? [];
    list.push(handler);
    this.handlers.set(eventType, list);
  }

  close = vi.fn();

  async emit(eventType: string, event: Record<string, string>): Promise<void> {
    for (const handler of this.handlers.get(eventType) ?? []) await handler(event);
  }
}

function fakeCap(stream: FakeStream) {
  return {
    connectWebSocket: vi.fn().mockResolvedValue(stream),
    getNegotiation: vi.fn().mockResolvedValue({ negotiationId: "neg-1", requirements: '{"capability":"dataset-summary"}' }),
    acceptNegotiation: vi.fn().mockResolvedValue({ negotiation: {}, order: {} }),
    deliverOrder: vi.fn().mockResolvedValue({ order: {}, delivery: {}, txHash: "0xdeliver" }),
  };
}

describe("serve", () => {
  it("accepts negotiations, caches requirements, and delivers using onOrder's result on OrderPaid", async () => {
    const stream = new FakeStream();
    const cap = fakeCap(stream);
    const onOrder = vi.fn().mockResolvedValue({ deliverableType: "schema" as const, content: '{"status":"ok"}' });

    const handle = await serve(cap as any, onOrder);

    await stream.emit(EventType.NegotiationCreated, { negotiation_id: "neg-1" });
    expect(cap.getNegotiation).toHaveBeenCalledWith("neg-1");
    expect(cap.acceptNegotiation).toHaveBeenCalledWith("neg-1");

    await stream.emit(EventType.OrderPaid, { order_id: "order-1", negotiation_id: "neg-1" });

    expect(onOrder).toHaveBeenCalledWith({ orderId: "order-1", negotiationId: "neg-1", requirements: '{"capability":"dataset-summary"}' });
    expect(cap.deliverOrder).toHaveBeenCalledWith("order-1", "schema", '{"status":"ok"}');

    handle.close();
    expect(stream.close).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @avalify/shared exec vitest run src/cap/provider.test.ts`
Expected: FAIL — `provider.ts` does not exist yet.

- [ ] **Step 3: Write `packages/shared/src/cap/provider.ts`**

```ts
import { EventType, type CapClient } from "./client.js";

export interface OrderContext {
  orderId: string;
  negotiationId: string;
  requirements: string;
}

export interface DeliverFn {
  (ctx: OrderContext): Promise<{ deliverableType: "text" | "schema"; content: string }>;
}

export async function serve(cap: CapClient, onOrder: DeliverFn): Promise<{ close: () => void }> {
  const stream = await cap.connectWebSocket();
  const requirementsByNegotiation = new Map<string, string>();

  stream.on(EventType.NegotiationCreated, async (e: { negotiation_id?: string }) => {
    if (!e.negotiation_id) return;
    const negotiation = await cap.getNegotiation(e.negotiation_id);
    requirementsByNegotiation.set(e.negotiation_id, negotiation.requirements);
    await cap.acceptNegotiation(e.negotiation_id);
  });

  stream.on(EventType.OrderPaid, async (e: { order_id?: string; negotiation_id?: string }) => {
    if (!e.order_id || !e.negotiation_id) return;
    const requirements = requirementsByNegotiation.get(e.negotiation_id) ?? "{}";
    const { deliverableType, content } = await onOrder({ orderId: e.order_id, negotiationId: e.negotiation_id, requirements });
    await cap.deliverOrder(e.order_id, deliverableType, content);
  });

  return { close: () => stream.close() };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @avalify/shared exec vitest run src/cap/provider.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Write the barrel export `packages/shared/src/index.ts`**

```ts
export * from "./types.js";
export * from "./env.js";
export * from "./cap/client.js";
export * from "./cap/requester.js";
export * from "./cap/provider.js";
export * from "./discovery.js";
export * from "./aval.js";
export * from "./reputation.js";
export * from "./ranking.js";
export * from "./verify.js";
export * from "./guardrails.js";
```

- [ ] **Step 6: Run the full shared test suite and build**

Run: `pnpm --filter @avalify/shared build && pnpm --filter @avalify/shared exec vitest run`
Expected: build succeeds; all shared tests pass (Tasks 3–12 combined).

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/cap/provider.ts packages/shared/src/cap/provider.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): add provider serve() loop and finalize shared barrel export"
```

---

## Task 13: `packages/providers` — good + bad mock providers

**Files:**
- Modify: `packages/providers/src/good-provider.ts` (replace stub)
- Create: `packages/providers/src/bad-provider.ts`

**Interfaces:**
- Consumes: `CapClient`, `loadAgentEnv`, `serve` from `@avalify/shared` (Task 12's barrel).
- Produces: `startGoodProvider()`, `startBadProvider()` — invoked by the package's `start:good` / `start:bad` scripts (already wired in Task 1).

- [ ] **Step 1: Replace `packages/providers/src/good-provider.ts`**

```ts
import { CapClient, loadAgentEnv, serve } from "@avalify/shared";

export async function startGoodProvider() {
  const env = loadAgentEnv("GOOD_PROVIDER");
  const cap = new CapClient(env);
  return serve(cap, async () => ({
    deliverableType: "schema",
    content: JSON.stringify({ status: "ok", summary: "dataset processed successfully", rowCount: 128 }),
  }));
}

startGoodProvider()
  .then(() => console.log("good-provider: listening for hires"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

- [ ] **Step 2: Create `packages/providers/src/bad-provider.ts`**

```ts
import { CapClient, loadAgentEnv, serve } from "@avalify/shared";

// Mock only — clearly labeled in the README's honesty section. Returns a
// deliverable that fails SchemaVerifier's `matches-accept-schema` check so
// Run 2 (adversarial) can demonstrate the route-around + negative aval.
export async function startBadProvider() {
  const env = loadAgentEnv("BAD_PROVIDER");
  const cap = new CapClient(env);
  return serve(cap, async () => ({
    deliverableType: "schema",
    content: JSON.stringify({ status: "lol", garbage: true }),
  }));
}

startBadProvider()
  .then(() => console.log("bad-provider: listening for hires"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

- [ ] **Step 3: Verify the package builds**

Run: `pnpm --filter @avalify/providers build`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add packages/providers/src/good-provider.ts packages/providers/src/bad-provider.ts
git commit -m "feat(providers): add good and bad mock CAP provider agents"
```

---

## Task 14: `packages/avalify/broker.ts` — the core loop with route-around

**Files:**
- Create: `packages/avalify/src/broker.ts`
- Create: `packages/avalify/src/broker.test.ts`

**Interfaces:**
- Consumes from `@avalify/shared`: `CandidateSource`, `ReputationReader`, `Verifier`, `AvalStore`, `RankingWeights`, `GuardrailConfig`, `Aval`, `JobSpec`, `Candidate`, `RankedCandidate`, `rank`, `filterByGuardrails`, `buildAval`, `DEFAULT_WEIGHTS`, `DEFAULT_GUARDRAILS`; `Requester` (for its `hire`/`tryReject` shape only — injected, not constructed here).
- Produces: `NoAcceptableProviderError`, `Broker` class with `run(job): Promise<Aval>` — used by `agent.ts` (Task 15).

- [ ] **Step 1: Write the failing test `packages/avalify/src/broker.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import { Broker, NoAcceptableProviderError } from "./broker.js";
import type { Aval, Candidate, CandidateSource, JobSpec, ReputationReader, ReputationSignal, Verdict } from "@avalify/shared";

const job: JobSpec = {
  capability: "dataset-summary",
  input: { dataset: "demo.csv" },
  acceptSchema: {} as JobSpec["acceptSchema"],
  maxPriceUsdc: 1,
};

const goodCandidate: Candidate = { serviceId: "svc-good", agentId: "agent-good", priceUsdc: 0.5, slaSeconds: 120, deliverableType: "schema" };
const badCandidate: Candidate = { serviceId: "svc-bad", agentId: "agent-bad", priceUsdc: 0.4, slaSeconds: 60, deliverableType: "schema" };

function makeDeps(candidates: Candidate[], verdicts: Record<string, Verdict>) {
  const candidateSource: CandidateSource = { find: async () => candidates };

  const signals: Record<string, ReputationSignal> = {
    "svc-good": { serviceId: "svc-good", completionRate: 0.95, rejectRate: 0.02, latencyRatio: 0.6, avalScore: 0.9, sampleSize: 10 },
    "svc-bad": { serviceId: "svc-bad", completionRate: 0.4, rejectRate: 0.3, latencyRatio: 1.2, avalScore: 0.2, sampleSize: 10 },
  };
  const reputation: ReputationReader = { read: async (c) => signals[c.serviceId] };

  const hire = vi.fn(async (candidate: Candidate) => ({
    orderId: `order-${candidate.serviceId}`,
    deliverableType: "schema" as const,
    deliverableText: "",
    deliverableSchema: "{}",
    payTxHash: `0xpay-${candidate.serviceId}`,
    deliverTxHash: `0xdeliver-${candidate.serviceId}`,
  }));
  const tryReject = vi.fn(async () => true);
  const requester = { hire, tryReject };

  const verifier = { verify: (delivery: { orderId: string }, _job: JobSpec): Verdict => {
    const serviceId = delivery.orderId.replace("order-", "");
    return verdicts[serviceId];
  } };

  const written: Aval[] = [];
  const avalStore = { write: async (aval: Aval) => { written.push(aval); }, history: async () => [] };

  return { candidateSource, reputation, requester, verifier, avalStore, written, hire, tryReject };
}

describe("Broker.run", () => {
  it("Run 1 (happy path): hires the highest-ranked (most trusted) candidate and returns a positive aval", async () => {
    const deps = makeDeps([goodCandidate, badCandidate], {
      "svc-good": { ok: true, checks: [] },
      "svc-bad": { ok: true, checks: [] },
    });
    const broker = new Broker(deps);

    const aval = await broker.run(job);

    expect(aval.outcome).toBe("positive");
    expect(aval.chosen.serviceId).toBe("svc-good");
    expect(deps.hire).toHaveBeenCalledTimes(1);
    expect(deps.written).toHaveLength(1);
  });

  it("Run 2 (adversarial): routes around a candidate that fails verification and still completes with a negative aval on record", async () => {
    const deps = makeDeps([goodCandidate, badCandidate], {
      "svc-good": { ok: false, checks: [{ name: "matches-accept-schema", pass: false }] },
      "svc-bad": { ok: true, checks: [] },
    });
    const broker = new Broker(deps);

    const aval = await broker.run(job);

    expect(deps.hire).toHaveBeenCalledTimes(2);
    expect(deps.tryReject).toHaveBeenCalledTimes(1);
    expect(deps.written).toHaveLength(2);
    expect(deps.written[0].outcome).toBe("negative");
    expect(deps.written[0].chosen.serviceId).toBe("svc-good");
    expect(aval.outcome).toBe("positive");
    expect(aval.reroutedFrom).toBe("svc-good");
  });

  it("throws NoAcceptableProviderError when every candidate fails verification", async () => {
    const deps = makeDeps([goodCandidate], { "svc-good": { ok: false, checks: [] } });
    const broker = new Broker(deps);
    await expect(broker.run(job)).rejects.toThrow(NoAcceptableProviderError);
  });

  it("throws NoAcceptableProviderError when there are no candidates at all", async () => {
    const deps = makeDeps([], {});
    const broker = new Broker(deps);
    await expect(broker.run(job)).rejects.toThrow(NoAcceptableProviderError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @avalify/avalify exec vitest run src/broker.test.ts`
Expected: FAIL — `broker.ts` does not exist yet.

- [ ] **Step 3: Write `packages/avalify/src/broker.ts`**

```ts
import {
  buildAval,
  filterByGuardrails,
  rank,
  DEFAULT_GUARDRAILS,
  DEFAULT_WEIGHTS,
  type Aval,
  type AvalStore,
  type Candidate,
  type CandidateSource,
  type GuardrailConfig,
  type HireResult,
  type JobSpec,
  type RankingWeights,
  type ReputationReader,
  type Verifier,
} from "@avalify/shared";

export class NoAcceptableProviderError extends Error {}

export interface HireRequester {
  hire(candidate: Candidate, job: JobSpec): Promise<HireResult>;
  tryReject(orderId: string, reason: string): Promise<boolean>;
}

export interface BrokerDeps {
  candidateSource: CandidateSource;
  reputation: ReputationReader;
  requester: HireRequester;
  verifier: Verifier;
  avalStore: AvalStore;
  weights?: RankingWeights;
  guardrails?: GuardrailConfig;
}

export class Broker {
  constructor(private deps: BrokerDeps) {}

  async run(job: JobSpec): Promise<Aval> {
    const candidates = await this.deps.candidateSource.find(job.capability, job.candidateServiceIds);
    if (candidates.length === 0) {
      throw new NoAcceptableProviderError(`no candidates for capability ${job.capability}`);
    }

    const signals = new Map();
    for (const candidate of candidates) {
      signals.set(candidate.serviceId, await this.deps.reputation.read(candidate));
    }

    const ranked = rank(candidates, signals, job, this.deps.weights ?? DEFAULT_WEIGHTS);
    const eligible = filterByGuardrails(ranked, job, this.deps.guardrails ?? DEFAULT_GUARDRAILS);
    if (eligible.length === 0) {
      throw new NoAcceptableProviderError("no candidate passed guardrails");
    }

    let reroutedFrom: string | undefined;

    for (const candidate of eligible) {
      const hire = await this.deps.requester.hire(candidate, job);
      const verdict = this.deps.verifier.verify(hire, job);
      const aval = buildAval(job, candidate, ranked, verdict, hire.orderId, hire.deliverTxHash, reroutedFrom);
      await this.deps.avalStore.write(aval);

      if (verdict.ok) return aval;

      await this.deps.requester.tryReject(hire.orderId, "failed post-delivery verification");
      reroutedFrom = candidate.serviceId;
    }

    throw new NoAcceptableProviderError("all candidates failed verification");
  }
}
```

`RankedCandidate extends Candidate`, so passing a `RankedCandidate` (from `rank()`'s output) into `HireRequester.hire(candidate: Candidate, ...)` is always structurally valid — no cast needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @avalify/avalify exec vitest run src/broker.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/avalify/src/broker.ts packages/avalify/src/broker.test.ts
git commit -m "feat(avalify): add broker core loop with route-around on failed verification"
```

---

## Task 15: `packages/avalify` — config, agent (provider loop), main entrypoint

**Files:**
- Create: `packages/avalify/src/config.ts`
- Create: `packages/avalify/src/agent.ts`
- Create: `packages/avalify/src/agent.test.ts`
- Modify: `packages/avalify/src/main.ts` (replace stub)
- Create: `packages/avalify/registry.json.example`

**Interfaces:**
- Consumes: `DEFAULT_WEIGHTS`, `DEFAULT_GUARDRAILS`, `RankingWeights`, `GuardrailConfig`, `JobSpec`, `serve`, `CapClient`, `loadAgentEnv`, `ConfiguredRegistrySource`, `ObservedReputationReader`, `Requester`, `SchemaVerifier`, `JsonFileAvalStore`, `RegistryEntry` from `@avalify/shared`; `Broker` from `./broker.js` (Task 14).
- Produces: `rankingWeights`, `guardrails` (config.ts); `decodeJobRequest(...)`, `startAvalifyService(...)` (agent.ts) — wired together by `main.ts`.

- [ ] **Step 1: Write `packages/avalify/src/config.ts`**

```ts
import { DEFAULT_WEIGHTS, DEFAULT_GUARDRAILS, type GuardrailConfig, type RankingWeights } from "@avalify/shared";

export const rankingWeights: RankingWeights = { ...DEFAULT_WEIGHTS };

export const guardrails: GuardrailConfig = { ...DEFAULT_GUARDRAILS, maxRouteArounds: 3 };
```

- [ ] **Step 2: Write the failing test `packages/avalify/src/agent.test.ts`**

```ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @avalify/avalify exec vitest run src/agent.test.ts`
Expected: FAIL — `agent.ts` does not exist yet.

- [ ] **Step 4: Write `packages/avalify/src/agent.ts`**

```ts
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @avalify/avalify exec vitest run src/agent.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Create `packages/avalify/registry.json.example`**

```json
[
  {
    "capability": "dataset-summary",
    "serviceId": "REPLACE_WITH_GOOD_PROVIDER_SERVICE_ID",
    "agentId": "REPLACE_WITH_GOOD_PROVIDER_AGENT_ID",
    "priceUsdc": 0.5,
    "slaSeconds": 120,
    "deliverableType": "schema"
  },
  {
    "capability": "dataset-summary",
    "serviceId": "REPLACE_WITH_BAD_PROVIDER_SERVICE_ID",
    "agentId": "REPLACE_WITH_BAD_PROVIDER_AGENT_ID",
    "priceUsdc": 0.3,
    "slaSeconds": 60,
    "deliverableType": "schema"
  }
]
```

- [ ] **Step 7: Replace `packages/avalify/src/main.ts`**

```ts
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
```

- [ ] **Step 8: Verify the package builds**

Run: `pnpm --filter @avalify/avalify build`
Expected: no type errors. (`CapClient` structurally satisfies `OrderLister` used inside `ObservedReputationReader`, confirmed by Task 7's interface.)

- [ ] **Step 9: Commit**

```bash
git add packages/avalify/src/config.ts packages/avalify/src/agent.ts packages/avalify/src/agent.test.ts packages/avalify/src/main.ts packages/avalify/registry.json.example
git commit -m "feat(avalify): wire config, provider-side job decoding, and main entrypoint"
```

---

## Task 16: `packages/harness` — buyer + two demo runs

**Files:**
- Create: `packages/harness/src/buyer.ts`
- Create: `packages/harness/src/run-happy.ts`
- Create: `packages/harness/src/run-adversarial.ts`
- Modify: `packages/harness/src/demo.ts` (replace stub)

**Interfaces:**
- Consumes: `CapClient`, `loadAgentEnv`, `Requester`, `Candidate`, `JobSpec`, `Aval` from `@avalify/shared`.
- Produces: `hireAvalify(opts)` (buyer.ts); `runHappy()` (run-happy.ts); `runAdversarial()` (run-adversarial.ts) — both used by `demo.ts`.

- [ ] **Step 1: Write `packages/harness/src/buyer.ts`**

```ts
import { z } from "zod";
import { CapClient, Requester, loadAgentEnv, type Aval, type Candidate, type JobSpec } from "@avalify/shared";

export interface HireAvalifyOptions {
  buyerEnvPrefix: string;
  avalifyServiceId: string;
  avalifyAgentId: string;
  priceUsdc: number;
  slaSeconds: number;
  capability: string;
  input: unknown;
  maxPriceUsdc: number;
  candidateServiceIds?: string[];
}

export async function hireAvalify(opts: HireAvalifyOptions): Promise<Aval> {
  const env = loadAgentEnv(opts.buyerEnvPrefix);
  const cap = new CapClient(env);
  const requester = new Requester(cap);

  const avalifyAsCandidate: Candidate = {
    serviceId: opts.avalifyServiceId,
    agentId: opts.avalifyAgentId,
    priceUsdc: opts.priceUsdc,
    slaSeconds: opts.slaSeconds,
    deliverableType: "schema",
  };

  const job: JobSpec = {
    capability: opts.capability,
    input: opts.input,
    acceptSchema: z.any(),
    maxPriceUsdc: opts.maxPriceUsdc,
    candidateServiceIds: opts.candidateServiceIds,
  };

  const hire = await requester.hire(avalifyAsCandidate, job);
  return JSON.parse(hire.deliverableSchema) as Aval;
}
```

- [ ] **Step 2: Write `packages/harness/src/run-happy.ts`**

```ts
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
```

- [ ] **Step 3: Write `packages/harness/src/run-adversarial.ts`**

```ts
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
```

- [ ] **Step 4: Replace `packages/harness/src/demo.ts`**

```ts
import { runHappy } from "./run-happy.js";
import { runAdversarial } from "./run-adversarial.js";

async function main() {
  console.log("Avalify demo — two runs\n");

  const happy = await runHappy();
  console.log(`\nRun 1 settlement tx: ${happy.settlementTxHash ?? "not settled"}`);

  const adversarial = await runAdversarial();
  console.log(`\nRun 2 settlement tx: ${adversarial.settlementTxHash ?? "not settled"}`);
  console.log(`Run 2 routed away from: ${adversarial.reroutedFrom ?? "n/a"}`);

  console.log("\nTrust decay: the bad provider now carries a negative aval in avals.log.");
  console.log("Run this demo again and the ranking step will favor the good provider even more strongly.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 5: Verify the package builds**

Run: `pnpm --filter @avalify/harness build`
Expected: no type errors.

> **Note:** these three scripts require real CAP credentials (`.env` filled per §10 of the scaffold spec) and Dashboard-registered agents to actually execute — there is no unit test here by design, matching this plan's Architecture statement. `hireAvalify`'s only non-trivial logic (`Requester.hire`) is already covered by Task 11's tests.

- [ ] **Step 6: Commit**

```bash
git add packages/harness/src/buyer.ts packages/harness/src/run-happy.ts packages/harness/src/run-adversarial.ts packages/harness/src/demo.ts
git commit -m "feat(harness): add buyer client and the two money-shot demo runs"
```

---

## Task 17: Full workspace verification + README status update

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing new — this task only verifies everything built in Tasks 1–16 works together and updates the one doc claim that goes stale once the scaffold lands.

- [ ] **Step 1: Run the full build**

Run: `pnpm install && pnpm -r build`
Expected: all 4 packages compile with zero type errors.

- [ ] **Step 2: Run the full test suite**

Run: `pnpm test`
Expected: all tests from Tasks 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15 pass (shared: env, cap/client, discovery, aval, reputation, ranking, verify, guardrails, cap/requester, cap/provider; avalify: broker, agent).

- [ ] **Step 3: Update the README status line**

In `README.md`, find:

```markdown
🚧 Hackathon build in progress — deadline **2026-07-12**. Design and CAP surface verified; scaffold and the two-run demo landing next. See the [scaffold spec & 6-day roadmap](docs/superpowers/specs/2026-07-06-avalify-scaffold-design.md).
```

Replace with:

```markdown
🚧 Hackathon build in progress — deadline **2026-07-12**. Design, CAP surface, and monorepo scaffold landed (`shared`/`avalify`/`providers`/`harness`, full ranking/verify/aval loop unit-tested against fakes). Next: Dashboard account setup and a real settlement run per the [scaffold spec & 6-day roadmap](docs/superpowers/specs/2026-07-06-avalify-scaffold-design.md).
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: update status now that the scaffold and core loop have landed"
```

---

## What this plan deliberately leaves for after Dashboard setup (out of scope here)

Per the scaffold spec §10/§11, these need a Dashboard-created SDK-Key + funded AA wallet per agent and cannot be coded or tested in this repo session:

- Actually registering Avalify / good-provider / bad-provider / buyer accounts on `agent.croo.network`.
- Funding each AA wallet with Base USDC.
- Filling the real `.env` values and running `pnpm --filter harness run:demo` against live CAP for a real settlement tx hash.
- Recording the demo video and filing the DoraHacks BUIDL.

Everything up to that boundary — the full compose-trust → hire → verify → write-aval loop, trust-first ranking, guardrails, route-around, and both demo scripts — is built and unit-tested by Tasks 1–17.

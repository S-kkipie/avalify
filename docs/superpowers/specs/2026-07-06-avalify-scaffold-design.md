# Avalify — Scaffolding Spec & Build Roadmap

- **Date:** 2026-07-06
- **Status:** Approved design → scaffold spec (this doc) → implementation plan (next)
- **Deadline:** 2026-07-12 09:00 (6 days)
- **Repo:** monorepo, pnpm, TypeScript

## Locked decisions

1. **Avalify = a demand-side trust broker / ranker.** It sources candidate providers, ranks them on multi-signal reputation, hires the best, verifies the delivery, and records an evidence-backed *aval*. It is **both** a CAP provider (buyers hire it) and a CAP requester (it hires providers) — the double-A2A story.
2. **No custom smart contract.** The "aval" is an off-chain, ERC-8004-shaped evidence object. Native CAP reputation ("Merit"/PTS) is the on-chain reputation of record; Avalify reads observable signals and contributes verdicts that drive it.
3. **Monorepo, pnpm, 4 packages.** `shared`, `avalify`, `providers`, `harness`.
4. **No WDK. Raw `ethers` v6** for any signer-key generation. (See §2 — CAP manages agent wallets, so this footprint is small.)
5. **Vertical slice**: the repo compiles, connects to real CAP, and completes Run 1 (happy path) end-to-end with a real USDC settlement on Base.

---

## 0. Research deltas (why this spec differs from the first sketch)

Verified against the CAP docs (`docs.croo.network`, `llms-full.txt`, Node SDK reference) and the CAP page. Three findings reshape the build:

| Finding | Source | Consequence |
|---|---|---|
| **No `registerService` in the SDK.** Agent + service registration and SDK-Key issuance happen only in the Dashboard (`agent.croo.network`). | Node SDK reference; Quick Start | The scaffold cannot register agents in code. Each of Avalify / good-provider / bad-provider / each buyer is a Dashboard-created account (its own AA wallet + SDK-Key). Setup is a documented **manual runbook** (§10). The HD "wallet factory" idea is dropped — CAP owns the wallets. |
| **No discovery/search API in the SDK.** Discovery is via CROO Navigator (NL) / Store UI, not programmatic. | Node SDK reference | Avalify cannot autonomously "sweep the whole network" over the SDK. We use a pluggable `CandidateSource`; default = a **curated registry** assembled from the Store, with a documented TODO to swap in a network query if an API appears. The multi-signal **ranking** remains the real differentiator regardless of candidate source. |
| **No reputation-read API in the SDK.** "CROO Merit" reputation is on-chain and updated at settlement, but there is no `getReputation()` and no Merit contract address published in the dev docs. | Node SDK reference; Smart Contracts page | `ReputationReader` aggregates **observable** signals: order history via `listOrders` (completion rate, reject rate, latency vs SLA) + Avalify's own past avales. On-chain Merit read is a `TODO` gated on a published address. |

Additional confirmed facts:

- **Settlement is automatic on `deliverOrder`** (CAPVault distributes: platform fee → Treasury, remainder → provider AA wallet). Avalify verifies **post-delivery**. Recourse for a bad deliverable = **negative aval + re-hire the competitor** (always buildable); `rejectOrder` clawback is a **bonus** if the order state still allows it (to verify — §9).
- **Base Mainnet (chain 8453), real USDC.** Gas is sponsored during the Agent Store launch window, but USDC principal is real → **hard spend caps and tiny prices ($0.10–$1.00) are mandatory, not optional.**
- Wallets are **ERC-4337 smart accounts** (Biconomy Nexus, CREATE2, EntryPoint v0.7). The env `WALLET_PRIVATE_KEY` is the **signer/owner** key; funds and escrow live in the AA wallet.

---

## 1. Confirmed CAP SDK surface (ground truth)

`@croo-network/sdk`, class **`AgentClient`**.

```ts
new AgentClient({ baseURL, wsURL, rpcURL? }, 'croo_sk_...')
```

| Role | Method | Notes |
|---|---|---|
| Requester | `negotiateOrder(req)` → `Negotiation` | start a hire |
| Provider | `acceptNegotiation(negotiationId)` → result | dual-sig `createOrder` on-chain |
| Provider | `acceptNegotiationWithFundAddress(id, addr)` | accept + set payout address |
| Either | `rejectNegotiation(id, reason)` / `rejectOrder(orderId, reason)` | |
| Requester | `payOrder(orderId)` → result | auto-approves USDC → CAPVault escrow |
| Provider | `deliverOrder(orderId, req)` → result | keccak256 delivery hash on-chain; **triggers settlement** |
| Either | `getOrder(id)`, `listOrders(opts?)`, `getNegotiation(id)`, `listNegotiations(opts?)` | polling / history |
| Requester | `getDelivery(orderId)` → `Delivery` | fetch result |
| Files | `uploadFile(name, body)` → key, `getDownloadURL(key)` → url (30-min link) | |

Events (`EventType`): `NegotiationCreated`, `NegotiationRejected`, `NegotiationExpired`, `OrderCreated`, `OrderPaid`, `OrderCompleted`, `OrderRejected`, `OrderExpired`. WS auto-reconnects (exp backoff), 30s heartbeat.

`DeliverableType`: `Text = "text"`, `Schema = "schema"`.

Error helpers: `isNotFound`, `isUnauthorized`, `isInvalidParams`, `isInvalidStatus`, `isForbidden`, `isInsufficientBalance`.

Contracts (Base Mainnet 8453): CAPCore `0xaD46f1Eba2fe9cBB689D2874a52039192F2ac821`, CAPVault `0x33ECdcC8dD32330ec5a62AB1986F25ED5B5D170d`, CROOValidationModule `0xfCc7eefd6D22bC6a4F35B467928ecAF738d0B3b8`.

> ⚠️ **Method signatures above are from docs, not a compiled package.** First implementation task is to install `@croo-network/sdk` and confirm exact argument/return shapes; all SDK contact is isolated in `shared/cap/client.ts` so corrections touch one file (§9-A).

---

## 2. Architecture

Monorepo. Node ≥ 20, pnpm workspaces, TypeScript (strict), `tsx` runner, `zod` (deliverable-shape validation), `ethers` v6 (signer-key gen + optional on-chain reads), `vitest`.

```
avalify/
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ .env.example                 # every agent's SDK-Key + signer key + shared endpoints
├─ package.json                 # workspace root, shared scripts
└─ packages/
   ├─ shared/                   # domain types + SDK wrapper + loop building blocks
   ├─ avalify/                  # the broker agent (provider to buyers, requester to providers)
   ├─ providers/               # good + bad mock provider agents
   └─ harness/                 # buyer clients + the two demo runners
```

**Boundary rules**
- All `@croo-network/sdk` imports live **only** in `shared/cap/`. Every other package talks to CAP through the wrapper.
- `shared` has no dependency on `avalify`/`providers`/`harness`. The three app packages depend on `shared`, never on each other.
- No secrets in code. Every key comes from env, validated once in `shared/env.ts`.

---

## 3. `packages/shared` — the loop building blocks

```
shared/src/
├─ types.ts          # domain types (below)
├─ env.ts            # load + zod-validate env; typed per-agent config
├─ cap/
│  ├─ client.ts      # thin AgentClient wrapper: connect, event loop, typed helpers
│  ├─ requester.ts   # hire(): negotiateOrder → payOrder → await OrderCompleted → getDelivery
│  └─ provider.ts    # serve(): on NegotiationCreated → acceptNegotiation → deliverOrder
├─ discovery.ts      # CandidateSource interface + ConfiguredRegistrySource (default)
├─ reputation.ts     # ReputationReader: observable signals + own aval history
├─ ranking.ts        # rank(candidates, signals, job) → RankedCandidate[]   ← differentiator
├─ verify.ts         # Verifier: deliverable vs job.acceptSchema (zod) + content checks
├─ aval.ts           # buildAval(...) + AvalStore (append-only JSON log, feeds reputation)
└─ guardrails.ts     # spend cap, provider allow/deny list, max route-around retries
```

**Core types** (sketch — refine against real SDK types):

```ts
export interface JobSpec {
  capability: string;              // e.g. "dataset-summary"
  input: unknown;                  // request payload passed to the provider
  acceptSchema: z.ZodTypeAny;      // shape the deliverable MUST satisfy
  maxPriceUsdc: number;            // guardrail: never pay above this
  candidateServiceIds?: string[];  // optional caller-supplied candidate set
}

export interface Candidate {
  serviceId: string; agentId: string;
  priceUsdc: number; slaSeconds: number;
  deliverableType: "text" | "schema";
}

export interface ReputationSignal {
  serviceId: string;
  completionRate: number;   // from listOrders history
  rejectRate: number;
  latencyRatio: number;     // observed delivery time / SLA
  avalScore: number;        // Avalify's own past verdicts for this provider
  onchainMerit?: number;    // TODO: when a Merit contract address is published
  sampleSize: number;
}

export interface RankedCandidate extends Candidate {
  score: number;            // composite
  reasons: string[];        // human-readable "why chosen / why not"
}

export interface Verdict {
  ok: boolean;
  checks: { name: string; pass: boolean; detail?: string }[];
}

export interface Aval {                    // off-chain, ERC-8004-shaped evidence object
  jobCapability: string;
  chosen: { serviceId: string; agentId: string };
  considered: RankedCandidate[];           // full ranking, for transparency
  verdict: Verdict;
  orderId: string;
  settlementTxHash?: string;               // REAL, from CAP — never fabricated
  outcome: "positive" | "negative";
  reroutedFrom?: string;                   // set when we routed away from a bad provider
  timestampMs: number;                     // stamped by caller (not inside a workflow script)
}
```

**Interfaces**

```ts
export interface CandidateSource { find(capability: string, hint?: string[]): Promise<Candidate[]>; }
export interface ReputationReader { read(c: Candidate): Promise<ReputationSignal>; }
export interface Verifier { verify(delivery: Delivery, job: JobSpec): Verdict; }
export function rank(cands: Candidate[], sigs: Map<string, ReputationSignal>, job: JobSpec): RankedCandidate[];
```

**Ranking (the differentiator).** Hiring is **trust-first**: the reputation term dominates; price and SLA only break ties among trusted candidates. A transparent weighted score, not a black box:

```
score = w1·TRUST(completionRate, 1−rejectRate, avalScore, merit?)   // w1 dominant — trust decides
      + w2·priceFit(priceUsdc vs job budget)                        // tie-breaker only
      + w3·slaFit(latencyRatio)                                     // tie-breaker only
      − penalties(denylisted, priceUsdc > maxPriceUsdc, sampleSize too small)
```

Default weights make `w1 ≫ w2, w3` so a cheaper-but-less-trusted provider never outranks a trusted one within budget. **Trust is not a single native score** (no read API — §0); Avalify *composes* it from multiple observable signals + its own aval history, which is the core value over a read-only score API. `reasons[]` records each term so the aval can explain the pick. Weights live in one config object.

---

## 4. `packages/avalify` — the broker agent

```
avalify/src/
├─ agent.ts     # provider side: register Avalify's own service loop (on hire from a buyer)
├─ broker.ts    # the core loop (below)
├─ config.ts    # ranking weights, guardrail defaults, default CandidateSource wiring
└─ main.ts      # entrypoint: connect AgentClient, start serving
```

**Broker loop** (Avalify as requester, with route-around):

```ts
async run(job: JobSpec): Promise<Aval> {
  const cands = await candidateSource.find(job.capability, job.candidateServiceIds);
  const sigs  = await readAll(cands, reputation);            // ReputationReader per candidate
  const ranked = guardrails.filter(rank(cands, sigs, job), job); // budget + allowlist
  if (ranked.length === 0) throw new NoAcceptableProviderError();

  for (const cand of ranked) {                               // route-around loop
    const { orderId, delivery, txHash } = await requester.hire(cand, job); // negotiate→pay→deliver
    const verdict = verifier.verify(delivery, job);
    const aval = buildAval(job, cand, ranked, verdict, orderId, txHash);
    await avalStore.write(aval);                             // feeds future reputation reads
    if (verdict.ok) return { ...aval, outcome: "positive" };
    await requester.tryReject(orderId, "failed verification"); // bonus clawback if state allows
    // negative aval recorded; move to next-best candidate
  }
  throw new NoAcceptableProviderError("all candidates failed verification");
}
```

When a **buyer hires Avalify**, Avalify's provider loop (`agent.ts`) runs `broker.run(jobFromRequest)` and returns the `Aval` as the deliverable (`DeliverableType.Schema`).

---

## 5. `packages/providers` — good + bad mock agents

```
providers/src/
├─ serve.ts          # shared: connect, on NegotiationCreated → acceptNegotiation → deliverOrder
├─ good-provider.ts  # returns a deliverable that PASSES the accept schema + content checks
└─ bad-provider.ts   # returns a deliverable that FAILS (wrong shape / junk content) — for Run 2
```

Both are real CAP provider agents (own SDK-Key + AA wallet). The bad provider is honestly labeled a mock in the demo and README.

---

## 6. `packages/harness` — buyers + the two demo runs

```
harness/src/
├─ buyer.ts             # a CAP requester that hires Avalify's service and prints the returned aval
├─ run-happy.ts         # Run 1
├─ run-adversarial.ts   # Run 2
└─ demo.ts              # runs both, prints the trust-decay narrative + tx hashes
```

**Run 1 (happy):** buyer hires Avalify → Avalify ranks → hires **good-provider** → verify OK → real USDC settle → **positive aval**. Print the real settlement tx hash.

**Run 2 (adversarial):** same job, but candidate set puts **bad-provider** first (or the good one is temporarily down) → hire → deliver → **verify fails** → negative aval + `tryReject` → **route to good-provider** → job completes → **negative aval** stands against bad-provider. On the next `run-happy`, bad-provider's aggregated signal (reject/aval history) is visibly lower → the "trust decay" money shot.

Anti-sybil coverage: good + bad + optional 1 real external agent = **≥3 counterparties**; ≥5 distinct buyer accounts (coordinate cross-hires with other teams per strategy doc) = **≥5 buyers**.

---

## 7. Vertical slice — definition of "done" for the scaffold

The slice is complete when, from a clean checkout + a filled `.env`:

1. `pnpm install && pnpm -r build` compiles with zero type errors.
2. `pnpm --filter providers start:good` and `start:bad` connect to real CAP and serve.
3. `pnpm --filter avalify start` connects and serves.
4. `pnpm --filter harness run:happy` executes **Run 1 end-to-end**: buyer → Avalify → good-provider → verify → **real USDC settlement on Base** → positive aval printed with a real tx hash.

Run 2 (adversarial), real network discovery, and on-chain Merit read are the **next** milestones, not part of the slice.

---

## 8. Guardrails, honesty, anti-sybil (build them in, don't bolt on)

- **Spend cap:** `maxPriceUsdc` per job + a global per-run budget; refuse to `payOrder` above cap. Mainnet real money → enforced, logged.
- **Allow/deny list:** provider allowlist for the demo; denylist auto-populated from negative avales.
- **Route-around cap:** max N retries, then fail clean (`NoAcceptableProviderError`).
- **Honesty section (README + demo):** state exactly what's real (CAP settlement, tx hashes, order lifecycle) vs simulated (bad-provider is our mock; some reputation signals are observational/synthetic; full-network discovery is a curated set). **Never fabricate a tx hash** — print the real one or say "not settled".
- **Idempotency:** handle duplicate `OrderPaid`/`OrderCompleted` events (SDK ops are idempotent; our handlers must be too).

---

## 9. Open items — verify on Day 1 (each has a fallback)

| # | Question | Fallback if "no" |
|---|---|---|
| A | Exact `@croo-network/sdk` method/type signatures vs the docs. | Wrapper `shared/cap/client.ts` absorbs the delta in one file. **Do this first.** |
| B | Is there any programmatic way to list Store services/agents (SDK or `api.croo.network` REST)? | `ConfiguredRegistrySource` = curated serviceId list from the Store UI. Thesis intact (ranking, not crawling). |
| C | Is native reputation/Merit readable on-chain (contract address)? | `ReputationReader` uses `listOrders` observables + own aval history; Merit read = TODO behind an address. |
| D | Can a **requester** `rejectOrder` a *delivered* bad order (clawback), or does `deliverOrder` settle instantly? | Recourse = negative aval + re-hire (buildable either way). Clawback = bonus if state allows. |
| E | Does a buyer/requester also need a funded AA wallet + SDK-Key (i.e., is every buyer a Dashboard account)? | Assume yes; the runbook (§10) provisions ≥5 buyer accounts; coordinate cross-team hires for the wallet count. |

---

## 10. Setup runbook (manual, Dashboard) — prerequisites before code runs

Because registration is Dashboard-only, before the slice can run:

1. In `agent.croo.network`, create accounts + register a service for: **Avalify**, **good-provider**, **bad-provider**, and **≥1 buyer** (target ≥5 buyers for anti-sybil). Each yields an **SDK-Key** and an **AA wallet address**.
2. Fund each AA wallet with a small amount of USDC on Base (buyers need enough to pay; Avalify needs enough to pay providers). Prices set tiny ($0.10–$1.00).
3. Fill `.env` (see below).

`.env.example`:
```
CROO_API_URL=https://api.croo.network
CROO_WS_URL=wss://api.croo.network/ws
CROO_RPC_URL=            # Base RPC, for optional on-chain reads

# one SDK-Key + signer key per agent
AVALIFY_SDK_KEY=croo_sk_...
AVALIFY_PRIVATE_KEY=0x...
GOOD_PROVIDER_SDK_KEY=croo_sk_...
GOOD_PROVIDER_PRIVATE_KEY=0x...
BAD_PROVIDER_SDK_KEY=croo_sk_...
BAD_PROVIDER_PRIVATE_KEY=0x...
BUYER1_SDK_KEY=croo_sk_...
BUYER1_PRIVATE_KEY=0x...
# BUYER2.. as needed
```

---

## 11. Six-day roadmap

| Day | Milestone |
|---|---|
| **1** | Scaffold monorepo (all 4 packages, tsconfig, env, scripts). Install real `@croo-network/sdk`, confirm signatures, finalize `shared/cap/client.ts` (Open item A). Dashboard: register the 3 core agents + 1 buyer, fund wallets. |
| **2** | Smoke "hello hire": buyer → Avalify (echo) → good-provider, one real settlement. Requester + provider wrappers working end-to-end. |
| **3** | **Run 1** full loop: discovery (curated) → reputation (observable) → ranking → hire → verify → positive aval + real tx. **Vertical slice done.** |
| **4** | **Run 2** adversarial: bad-provider → verify fail → negative aval + `tryReject` → route to good → trust-decay visible on re-read. Guardrails wired (spend cap, allow/deny, route cap). |
| **5** | Harden: real network discovery if an API exists (B) / on-chain Merit if address exists (C); optional 1 real external agent (bonus); provision remaining buyer accounts to clear anti-sybil; honesty section drafted. |
| **6** | Demo video ≤5 min, README (setup, SDK methods used, integration notes), list on CROO Agent Store, file BUIDL on DoraHacks, final anti-sybil count check (≥3 counterparties, ≥5 buyers, no self-trade concentration). |

---

## Appendix — dependencies & scripts

- Root: `typescript`, `tsx`, `vitest`, `@types/node`, `dotenv`.
- `shared`: `@croo-network/sdk`, `zod`, `ethers`.
- Scripts (root `package.json`): `build` (`tsc -b`), `typecheck`, `test`, and per-package `start:*` / `run:*` via `pnpm --filter`.
- License MIT (already in repo). Public repo (already).

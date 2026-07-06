# 01 — CROO Agent Hackathon (facts)

Source: https://dorahacks.io/hackathon/croo-hackathon/detail

## Basics

- **Prize pool:** ~$10.2K cash + Agent Store featured listing + $CROO airdrop whitelist.
- **Window:** started 2026-06-09, **deadline 2026-07-12 09:00**.
- **Scale (observed):** ~60–74 BUIDLs, ~283 hackers.
- **Chain:** Base + USDC. 0% gas during the Agent Store launch window (gas sponsored by CROO).

## What CAP / CROO is

- **CAP (CROO Agent Protocol)** — "TCP/IP for Agents": a permissionless agent-to-agent (A2A) standard letting any agent, in any framework, **discover, hire, and pay** any other agent on-chain.
- **CROO Agent Store** — "App Store for Agents": every agent has a wallet, every service is priced, every job is a real on-chain transaction. Discoverable by humans *and* other agents.

## Tracks (pick up to 2 per BUIDL)

- Research & Intelligence Agents — paid research with verifiable sources
- **Data & Verification Agents** — provenance, credentials, output checks ← *Avalify primary*
- Creator & Content Ops Agents — priced, composable creator services
- DeFi / On-chain Ops Agents — monitoring, alerts, execution
- Developer Tooling Agents — tools for other CAP builders
- **Open — Any A2A Agents** — anything proving A2A composability ← *Avalify secondary*

## Submission requirements (all five mandatory)

1. **Listed on CROO Agent Store** — discoverable by humans and agents.
2. **Integrated with CAP** — agent is callable, settles on-chain.
3. **Open source** — public repo, MIT / Apache 2.0 / similar.
4. **Demo + README** — ≤5-min demo video, setup instructions, SDK methods used, integration notes.
5. **BUIDL filed on DoraHacks** — all required fields.

## Anti-sybil & disqualification (design-critical)

**Hard disqualification:**
- Private repo or unverifiable code
- Copy-paste fork without meaningful modification
- **Fake demo, broken CAP integration, or failed human spot-check**

**Reward-eligibility flags (reviewed, not auto-DQ):**
- `< 3 unique counterparty agents`
- `< 5 unique buyer wallets`
- Highly concentrated self-trade pattern
- Random 10% human audit failure

> These flags are the reason Avalify *hires real providers* and coordinates real buyers — a self-simulated single-hire storyline demo trips every one of them.

**Eligibility:** teams 1–5, builders 18+. Onboarding rewards capped at 3 rewarded agents per team / wallet cluster.

## CAP SDK surface (from `@croo-network/sdk`, per public references)

- `AgentClient(config, sdkKey)` — init.
- WebSocket event loop with typed `EventType` enums (not string literals).
- Lifecycle: `NegotiationCreated` → `acceptNegotiation()` → `OrderPaid` → `deliverOrder({ type, content })` → `OrderCompleted`.
- `DeliverableType` must match on delivery.
- Idempotency required on duplicate `OrderPaid`.
- Typed error helpers (e.g. `isInsufficientBalance`).
- Deprecated / anti-pattern: `cap.serve`, `cap.price`, `cap.settle`.

> Surface above is inferred from the "ShipKit" dev-tooling BUIDL and CROO SDK quickstart references — **verify against the real SDK before building** (see [05-open-questions.md](05-open-questions.md)).

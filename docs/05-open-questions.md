# 05 — Open questions & scope

## Must validate before/while building

1. **Does CROO expose native reputation?**
   - If yes → read/write the Store's native reputation surface.
   - If no → write our own **ERC-8004-compatible** attestations (write-on-settle, read-on-hire). This is the safe default and the more portable story.

2. **Are the 5 named rivals actually callable?** (Veritas Fides, Flow Forensics, CROO Reputation Oracle, VERIDEX, PayGuard)
   - If callable → optionally consume one as a sub-check for a real-composability bonus.
   - Either way → **ship our own good + bad provider agents** for the demo. Never hard-depend on a rival's uptime (see [02](02-landscape-and-winners.md) findings).

3. **Exact CAP SDK surface** — verify `@croo-network/sdk` against the real package, not the inferred surface in [01](01-hackathon.md). Confirm: `AgentClient` init, event enums, `acceptNegotiation` / `OrderPaid` / `deliverOrder` / `OrderCompleted`, `DeliverableType`, idempotency, typed errors.

4. **Can a third-party agent observe another pair's order in-flight?**
   - Likely **no** on CAP (settlement is buyer↔provider). This means "in-flight monitoring / pause settlement" is probably not implementable by a bystander → keep it out of scope, or reframe as something Avalify does *as the hiring buyer* (it already controls its own hire).

## Realistic 6-day scope (deadline 2026-07-12)

**In scope (the core loop, all buildable as the buyer):**
- Avalify agent with CAP Identity, listed on CROO Agent Store, callable, priced.
- Read provider reputation (native or ERC-8004 attestations we maintain).
- Hire a provider for real + settle USDC via CAP.
- Verify the deliverable (sanity-checks matching `DeliverableType`).
- Write an on-chain attestation (positive/negative aval).
- Two demo runs (happy path + adversarial route-around) — the money shot.
- Own good + bad provider agents to hire.
- Honesty section (real vs simulated), guardrails (spend caps/allowlists), no fake tx hashes.

**Out of scope (custody / arbiter powers we don't have):**
- Pausing another pair's settlement mid-flight.
- Auto-refund of funds Avalify doesn't hold in escrow.
- (Reframe both as future work; naming them honestly is a *plus* — see [03](03-strategy.md).)

## Submission checklist (from [01](01-hackathon.md))

- [ ] Listed on CROO Agent Store (callable, priced)
- [ ] CAP integrated, settles on-chain
- [ ] Public repo, MIT (done)
- [ ] Demo video ≤5 min + README (setup, SDK methods, integration notes)
- [ ] BUIDL filed on DoraHacks before 2026-07-12
- [ ] ≥3 unique counterparty agents, ≥5 unique buyer wallets, no self-trade concentration

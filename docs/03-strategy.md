# 03 — Strategy

## The core bet

Build the **demand-side broker that consumes the market**, not a piece that replaces it. Avalify is a legitimate buyer agent — the shape CROO's protocol is built to reward — that reads reputation, hires, verifies, and re-writes reputation.

## What we explicitly are NOT

1. **Not a monolithic gatekeeper.** The rejected v1 ("SentryLoop") tried to be a single agent that gates a hire, pauses another pair's settlement mid-flight, and auto-refunds. Pausing/refunding needs custody or arbiter power over other agents' escrow that a callable bystander doesn't have on CAP — those phases would have to be faked, and *fake demo = hard DQ*. Its self-simulated single-hire storyline also trips every anti-sybil flag.
2. **Not another read-only score API.** "Is this safe to pay?" scoring is saturated and already live: `notifuturo/vouch` (per-call trust API on x402, on Base), `AgentVouch`, `Legasi`, `Basma's AgentID`, `reckon402`, plus two separate "Vouch Protocol" projects. Being the N-th score loses. Avalify's edge is the part they don't do: **actually hiring, verifying, and writing reputation back.**

## How Avalify wins

- **Real A2A composability.** It is callable *and* it hires others → double A2A. Matches CROO's explicit "other agents hire your agent as a dependency" thesis.
- **Clears anti-sybil for free.** Hiring N real providers in the demo produces on-chain volume, ≥3 unique counterparties, and ≥5 unique buyers — the exact reward-eligibility flags a self-trade storyline fails. (Coordinate cross-hires with other teams to hit the buyer-wallet count.)
- **Fills a named gap.** Multiple winners say "nobody closes the reputation loop." Avalify closes it *as a callable agent*, not as loose contracts.
- **A proven money-shot demo** (see below).
- **Real flywheel, not fake.** ERC-8004-compatible attestations are readable by other agents — the write→read loop reckon402 was rewarded for.

## The money-shot demo (two runs)

1. **Run 1 (happy path):** a buyer agent hires Avalify → Avalify reads reputation, picks the best provider, hires it, verifies a good deliverable, settles USDC, writes a **positive aval** on-chain.
2. **Run 2 (adversarial):** same call, but the chosen provider misbehaves (fails a sanity-check). Avalify **routes to the competitor**, completes the job, and writes a **negative aval** on-chain against the bad provider. On the *next* read, the bad provider's reputation is visibly lower.

This mirrors Agent-Economy-on-Arc's live trust-decay demo — the pattern judges called "demo of the year."

## Credibility moves (judges reward these)

- **Honesty section** in README/demo: state exactly what is real vs simulated (Wispy and AgentCommerceOS did this and won). No fabricated tx hashes — show "facilitator-settled" or the real hash, never a fake one.
- **Guardrails as a feature:** spend caps / allowlists / sane defaults are trust+safety win conditions in sibling hackathons — surface them, don't hide them.
- **ERC-8004 alignment** for the attestation schema so the reputation is portable and composable.

## Differentiation vs the 5 named CROO rivals

Rivals named in the space: Veritas Fides, Flow Forensics, CROO Reputation Oracle, VERIDEX, PayGuard — each solves one slice (check-before / audit-during / rate-after). Avalify doesn't compete slice-for-slice; it **sits on top and can consume them as sub-checks**, making them dependencies while being the one agent that closes the whole loop with a single hire and a single payment.

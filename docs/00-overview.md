# 00 — Overview

## One-liner

**Avalify — get any agent hire backed.** A demand-side trust agent that other agents hire to hire *for* them: it reads a provider's on-chain reputation, hires the best one, verifies the delivery, and writes the result back on-chain as an attestation (the *aval*) — the record that feeds the next decision.

Not another read-only "is this safe to pay?" score API (that niche is saturated and already live). Avalify is a **buyer** that actually contracts, checks, and settles — closing the trust loop in a single callable agent.

## The loop (perceive → decide → act → learn)

1. **Read** — pull the provider's reputation history on-chain (ERC-8004 style: written on settlement, read on hire).
2. **Decide + hire** — pick the best provider by trust/price, hire for real, settle USDC via CAP.
3. **Verify** — sanity-check the deliverable against the agreed shape.
4. **Write** — emit an on-chain attestation (the *aval*) that feeds the next hire — readable by everyone, not just Avalify.

## Why one agent instead of three

Every trust agent on the market solves one slice — one scores *before*, one audits *during*, one rates *after*. The buyer wires them together by hand: call three agents, pay three times, cross the results. Avalify is **one hire, one payment, the whole loop**. And because it *hires* real providers, it produces genuine agent-to-agent volume and counterparty diversity instead of a self-contained demo.

## Target tracks (CROO, max 2 per BUIDL)

- **Data & Verification** (primary) — provenance, output checks, reputation. Exact fit.
- **Open — Any A2A** (secondary) — the whole thesis is A2A composability; this track rewards it directly.

## Status

Early — hackathon build in progress. Deadline **2026-07-12**. Scaffold + docs landed; CAP integration and demo next. See [05-open-questions.md](05-open-questions.md).

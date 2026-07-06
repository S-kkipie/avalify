# Avalify

**Get any agent hire backed.** Avalify is a **demand-side trust broker** for the [CROO Agent Protocol (CAP)](https://dorahacks.io/hackathon/croo-hackathon/detail): other agents hire it to hire *for* them. It ranks providers on composed trust, hires the most trustworthy one, verifies the delivery, and records an evidence-backed *aval* — the record that feeds the next decision.

> One callable agent that closes the trust loop: **compose trust → hire → verify → write the aval.** Not another read-only "is this safe to pay?" score — a buyer that actually contracts, checks, and settles.

Built for the **CROO Agent Hackathon** — tracks *Data & Verification* + *Open (A2A)*.

---

## The problem

Every trust agent on the market solves one slice — one scores *before*, one audits *during*, one rates *after*. The buyer wires them together by hand: call three agents, pay three times, cross the results. And even after all that, **nobody actually hires and verifies** — you're left holding a score.

## What Avalify does

Avalify is **one hire, one payment, the whole loop.** It is **both** sides of the market at once:

- **A provider** — buyers hire *Avalify* as a callable CAP service.
- **A requester** — Avalify then hires *real providers* on their behalf.

That's genuine agent-to-agent volume and counterparty diversity, not a self-contained demo.

## The loop

1. **Compose trust** — CAP has no single readable trust score, so Avalify *builds* one per provider from multiple signals: on-chain order history (completion rate, reject rate, latency vs SLA), its own past verdicts, and native reputation where available.
2. **Hire — trust-first** — rank candidates so the **most trustworthy within budget wins**; price and SLA only break ties. Hire for real, settle USDC via CAP on Base.
3. **Verify** — sanity-check the deliverable against the agreed shape and content.
4. **Write the aval** — record an evidence-backed attestation (who was chosen, the full ranking, the verdict, the real settlement hash). It downranks providers that fail and feeds the next hire — for everyone, not just Avalify.

If a provider delivers garbage, Avalify records a **negative aval** and **routes to a competitor** to get the job done — so the next buyer never hires the bad one blind.

## Why this is different

Read-only score APIs stop at "here's a number." Avalify's edge is the part they don't do: **it composes trust from many signals, actually hires and verifies, and writes the outcome back.** That composed-trust view is worth more than any single score — and it closes the reputation loop that repeat hackathon winners said nobody closes.

## Built on CAP

Real integration, verified against the CROO docs and SDK:

- Callable + settling via `@croo-network/sdk` (`AgentClient`) — negotiate → pay → deliver → complete.
- Settlement in **USDC on Base Mainnet** (chain 8453), escrow via CAPVault, ERC-4337 smart-account wallets.
- Reputation contributed through real order outcomes.

## Honesty (what's real vs simulated)

No fabricated proofs. Settlements are real on-chain CAP transactions with real hashes — we print the real hash or say "not settled," never a fake one. For a controlled demo we ship our own good and bad provider agents (the bad one is clearly a mock); some trust signals are observational until more on-chain reputation is readable; full-network discovery uses a curated candidate set because CAP exposes no programmatic search yet. Guardrails — hard spend caps, provider allow/deny lists, bounded retries — are built in, not bolted on.

## Status

🚧 Hackathon build in progress — deadline **2026-07-12**. Design and CAP surface verified; scaffold and the two-run demo landing next. See the [scaffold spec & 6-day roadmap](docs/superpowers/specs/2026-07-06-avalify-scaffold-design.md).

## Docs

Design, research, and decision context live in [`docs/`](docs/README.md): [overview](docs/00-overview.md) · [hackathon facts](docs/01-hackathon.md) · [landscape & winners](docs/02-landscape-and-winners.md) · [strategy](docs/03-strategy.md) · [naming](docs/04-naming-decision.md) · [open questions & scope](docs/05-open-questions.md) · [scaffold spec](docs/superpowers/specs/2026-07-06-avalify-scaffold-design.md).

## License

MIT — see [LICENSE](LICENSE).

# Avalify

**Get any agent hire backed.** Avalify is a demand-side trust agent for the [CROO Agent Protocol (CAP)](https://dorahacks.io/hackathon/croo-hackathon/detail): other agents hire it to hire *for* them. It reads a provider's on-chain reputation, hires the best one, verifies the delivery, and writes the result back as an on-chain attestation — the record that feeds the next decision.

> One callable agent that closes the trust loop: **read reputation → hire → verify → write the aval.** Not another read-only score API — a buyer that actually contracts, checks, and settles.

Built for the **CROO Agent Hackathon** — tracks *Data & Verification* + *Open (A2A)*.

## Why

Every trust agent on the market solves one slice — one scores before, one audits during, one rates after. The buyer has to wire them together by hand: call three agents, pay three times, cross the results. Avalify is one hire, one payment, the whole loop — and because it *hires* real providers, it produces genuine A2A volume and counterparty diversity instead of a self-contained demo.

## The loop

1. **Read** — pull the provider's reputation history on-chain (ERC-8004 style: written on settlement, read on hire).
2. **Decide + hire** — pick the best by trust/price, hire for real, settle USDC via CAP.
3. **Verify** — sanity-check the deliverable.
4. **Write** — emit an on-chain attestation (the *aval*) that feeds the next hire — for everyone, not just Avalify.

## Status

🚧 Early — hackathon build in progress (deadline 2026-07-12). Design and CAP integration landing next.

## License

MIT — see [LICENSE](LICENSE).

# 02 — Landscape & winners (research)

What actually wins in agentic-commerce / A2A-payment hackathons. Every claim below is from a real submission or recap.

## Similar hackathons (reference set)

- **CROO Agent** (DoraHacks, $10.2K, deadline 2026-07-12) — the target.
- **SF Agentic Commerce x402** (SKALE + Google + Coinbase + Virtuals, $50K, Feb 2026) — 324 hackers, 86 builds.
- **Agentic Commerce x402 Berlin** (Algorand, $20K, Jun 2026) — 373 regs, 42 builds.
- **Agentic Economy on Arc** (Circle + Arc, Apr 2026) — nanopayment marketplaces.
- **Solana x402** (Oct–Nov 2025) — "Best Trustless Agent" etc.
- **Pharos Skill-to-Agent** ($50K PROS, Agent Arena deadline ~2026-07-06) — rewards reusability + composability; same agent could target it.

## Winners — evidence table

| Project | What it was | Signal for Avalify |
|---------|-------------|--------------------|
| **Erster** (Berlin, 1st) | "Pay-per-evaluation **trust check** for finance agents" | The pre-hire trust check already won a hackathon. Validated. |
| **Liminal x402** (Berlin infra, 1st) | "Routing an agent to the provider it can **actually trust**" | Trust-based routing wins. |
| **Legasi** (SF, Virtuals 2nd) | Credit + **reputation** + yield for agents, on-chain reputation | Reputation layer wins. |
| **Basma's AgentID** (Berlin bonus) | On-chain **reputation score that updates every payment** | The write-on-settle flywheel. |
| **Lockpay** (Berlin, 2nd) | **Milestone escrow** releasing payment on delivery | Conditional settlement wins. |
| **amiko-x402** (Solana, "Best Trustless Agent" winner) | On-chain agent registry + job tracking + **payment-weighted reputation**, lazy registration | Reputation-on-settle is a repeat winner. |
| **reckon402** | "Every x402 settlement **writes ERC-8004 reputation**. Every ENS lookup reads it back." Per-agent escrow releases as reputation grows. | The exact write→read loop Avalify implements. |
| **Agent-Economy-on-Arc** | Marketplace; **live trust-decay demo** — misbehaving analyst loses business to honest one in real time | The money-shot pattern (called "demo of the year"). |
| **AgentBazaar / AgentSwarm** | One query → **50–60 real A2A nanopayments** on-chain, live graph | Volume + counterparty diversity by design. |
| **Wispy** (SF, multi-track) | Autonomous discover→pay→deliver; **removed fake tx hashes**, hard spend caps | Judges punish fake proofs; reward guardrails. |
| **AgentCommerceOS** (SYNTHESIS) | Attestation + escrow; named a **real external agent ("donnyzaken") as integration partner** | Real cross-agent dependency is rare and praised. |

## Two findings that shaped Avalify

**Q: Do winners depend on specific external agents?**
Mostly **no** — they ship *both* sides themselves (buyer + their own mock providers) and simulate counterparties inside their submission. The one notable exception, AgentCommerceOS, made a *real* external integration partner (donnyzaken) its Track-3 story and was praised. → **Ship your own good+bad providers for the demo; treat any real rival integration as a bonus, never a hard dependency.**

**Q: Do winners say they wish some primitive existed?**
**Yes, explicitly, and judges reward it.**
- reckon402: *"The individual standards exist … none of them close the loop … both sets need new primitives."*
- Agent-Economy-on-Arc: quality-bonds/escrow = *"the most interesting unsolved problem in the agent economy today."*
- AgentCommerceOS honesty section: *"escrow depends on platform trust at launch … verifiers currently simulated … for commerce with strangers you need a dispute layer: a trusted third-party agent or a stake-based system."*
→ **Name the gap honestly and fill one piece well.**

## The recurring winning primitive

**Reputation written on settlement, read before hire** — appears in amiko-x402, reckon402, Basma's AgentID, Legasi. And **ERC-8004** is the emerging on-chain agent identity/reputation standard the strongest projects align to. Making Avalify's attestation ERC-8004-compatible turns "my private attestation nobody reads" into a real, composable flywheel.

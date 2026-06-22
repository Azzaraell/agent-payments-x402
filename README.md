# Solana Agent Payments Skill

![License](https://img.shields.io/badge/license-MIT-blue)
![Solana](https://img.shields.io/badge/Solana-mainnet-black?logo=solana)
![x402](https://img.shields.io/badge/x402-v2-green)
![Claude Code](https://img.shields.io/badge/Claude_Code-skill-orange)

**The money layer for AI agents on Solana.** A progressively-loaded Claude Code skill that teaches an agent — and its builder — to **pay** for resources, **get paid** for its own services, and **spend safely** behind enforced, non-custodial limits.

> Built to slot into the [Solana AI Kit](https://github.com/solanabr/solana-ai-kit) as an `ext/` skill, following the [`solana-game-skill`](https://github.com/solanabr/solana-game-skill) structure.

---

## The problem

AI agents increasingly need to move money: pay per-call for data and compute via [x402](https://github.com/coinbase/x402), settle with other agents, and charge for their own tools. But the pattern almost everyone ships is a **footgun**:

```ts
// ⚠️ The god-mode default — present in most agent-kit quickstarts
const keypair = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY!));
const wallet  = new KeypairWallet(keypair); // unlimited authority over every lamport
```

One prompt injection, one hallucinated tool call, one loop bug — and the agent can send the entire wallet to an attacker. There is **no budget, no per-transaction cap, no destination allowlist, no audit trail, and no kill switch.**

The ecosystem has the *pieces* — x402 for settlement, Squads/Privy/Turnkey/Crossmint for custody, AP2 for authorization — but **no skill ties them into a coherent, safe money path for an autonomous agent.** This is that skill.

## What it gives you

| Pillar | What the agent can do | Skill file |
|--------|-----------------------|-----------|
| 💸 **Pay** | Consume any x402-paywalled API / MCP / agent — per request, in USDC, no API key | [`pay-x402-client.md`](skill/pay-x402-client.md) |
| 🏷️ **Get paid** | Paywall its own API / MCP behind HTTP 402 and settle in USDC | [`monetize-x402-server.md`](skill/monetize-x402-server.md) |
| 🔒 **Spend safely** | Hold keys non-custodially with **enforced** caps, allowlists, and a kill switch | [`agent-wallets.md`](skill/agent-wallets.md) · [`spending-controls.md`](skill/spending-controls.md) |
| ✅ **Authorize** | Prove it may spend a *user's* money (AP2 mandates) when acting on someone's behalf | [`mandates-ap2.md`](skill/mandates-ap2.md) |
| ⚙️ **Settle** | Get USDC mints, decimals, ATAs, gasless, and receipts right | [`usdc-settlement.md`](skill/usdc-settlement.md) |

## The mental model (three layers, kept separate)

```
Authorization   →  AP2 mandate          "is the agent allowed to spend this?"   (Google, Sept 2025)
Settlement      →  x402 v2 over USDC     "how does value actually move?"         (Coinbase CDP)
Custody+policy  →  Squads / Privy / …    "what holds keys & enforces limits?"
```

x402 is the **stablecoin settlement extension of AP2** — adopt it alone (most common), or pair with AP2 mandates when an agent spends *a user's* money.

## What's inside

```
.
├── skill/
│   ├── SKILL.md                  # entry hub — routes to the files below
│   ├── pay-x402-client.md        # agent pays per request (budget-guarded)
│   ├── monetize-x402-server.md   # paywall an API/MCP, settle in USDC
│   ├── agent-wallets.md          # custody chooser: on-chain vs off-chain enforcement
│   ├── spending-controls.md      # the safety core — Squads v4 limits, budgets, kill switch
│   ├── mandates-ap2.md           # authorization layer for spending a user's money
│   ├── usdc-settlement.md        # mints, decimals, ATAs, gasless, receipts
│   └── resources.md              # packages, facilitators, v1↔v2, constants, docs
├── agents/
│   ├── agent-payments-engineer.md  # implements the money path (limits-first)
│   └── payment-safety-auditor.md   # adversarial review: finds drain risks
├── commands/
│   ├── add-x402-paywall.md         # /add-x402-paywall — monetize a route
│   ├── setup-agent-wallet.md       # /setup-agent-wallet — capped non-custodial wallet
│   └── audit-agent-spending.md     # /audit-agent-spending — find god-mode footguns
├── rules/
│   └── payments.md                 # auto-loads on payment/wallet files — safety law
├── install.sh
├── LICENSE                         # MIT
└── README.md
```

## Install

### Into a Solana AI Kit project (or any `.claude/` project)

```bash
# From your project root:
curl -fsSL https://raw.githubusercontent.com/Azzaraell/agent-payments-x402/main/install.sh | bash

# or clone + run locally:
git clone https://github.com/Azzaraell/agent-payments-x402.git
bash agent-payments-x402/install.sh /path/to/your-project
```

The installer copies `skill/` → `.claude/skills/ext/agent-payments/`, and the `agents/`, `commands/`, and `rules/` into their `.claude/` homes. Pass `--agents` to target `.agents/` instead of `.claude/` (for Codex/Cursor/etc.), matching the kit's convention.

### As a submodule (kit-style)

```bash
git submodule add https://github.com/Azzaraell/agent-payments-x402.git .claude/skills/ext/agent-payments
```

## Use it

Once installed, just ask Claude Code naturally — the skill loads progressively:

```
"Let my agent pay for this API with x402"            → pay-x402-client.md
"Paywall my /quote endpoint, charge $0.001 a call"   → /add-x402-paywall
"Give my agent a wallet capped at $5/day"            → /setup-agent-wallet
"Audit my agent's payment code before mainnet"       → /audit-agent-spending
```

Or invoke the agents directly: `agent-payments-engineer` to build, `payment-safety-auditor` to review.

## Safety baseline (enforced, not aspirational)

Every autonomous spender this skill produces has: no god-mode key on mainnet · a per-transaction cap **and** a rolling budget · a destination allowlist · a kill switch · persisted `PAYMENT-RESPONSE` receipts · atomic-unit math · devnet-tested before mainnet. The [`payment-safety-auditor`](agents/payment-safety-auditor.md) and [`rules/payments.md`](rules/payments.md) keep it honest.

## Built for the 2026 stack

x402 **v2** (`@x402/*` packages, `PAYMENT-*` headers, CAIP-2 networks, `exact` scheme on Solana), Squads **v4** spending limits, Coinbase **Agentic Wallets** (Feb 2026), and **AP2** (Sept 2025). The v1→v2 protocol drift is documented in [`resources.md`](skill/resources.md#protocol-versions) so you don't ship a legacy shape. Constants are pinned and sourced; fast-moving package versions should be verified on npm before shipping.

## How it fits the kit

This is the cross-cutting **payments + controls** layer. It complements — does not duplicate — the protocol skills: it governs how `solana-agent-kit`'s agent pays and is paid (and replaces its raw-keypair wallet), generalizes the `birdeye` x402 example, and applies the `squads` spending-limit primitive specifically to autonomous agents. Raw token/ATA/Token-2022 mechanics defer to the core `solana-dev` skill.

## License

MIT — see [LICENSE](LICENSE). Ready to be merged or submoduled into the Solana AI Kit.

---
name: solana-agent-payments
description: The money layer for AI agents on Solana. Lets an agent PAY for APIs/data/compute and other agents (x402 micropayments in USDC), GET PAID by monetizing its own APIs/MCP tools behind HTTP 402, and SPEND SAFELY behind non-custodial wallets with hard, enforced limits — never a raw god-mode private key. Covers x402 v2 (client + server + facilitator), Squads v4 spending limits, Privy/Turnkey/Coinbase-CDP/Crossmint agent wallets, AP2 mandates, and USDC settlement. Use when building agents that transact, paywalling an API/MCP for agent consumers, or hardening an agent's spending controls.
user-invocable: true
---

# Solana Agent Payments Skill

> **The missing money layer for autonomous agents.** `solana-agent-kit` and friends give an agent the ability to *act*. This skill gives it the ability to **pay, get paid, and spend safely** — without ever handing it an uncapped private key.

## The problem this solves

AI agents increasingly need to move money: pay per-call for data/compute, settle with other agents, and charge for their own services. The pattern almost everyone ships today is a **footgun**:

```ts
// The god-mode default — seen in most agent kits, including solana-agent-kit quickstarts
const keypair = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY!));
const wallet  = new KeypairWallet(keypair); // unlimited authority over every lamport
```

One prompt injection, one hallucinated tool call, one loop bug — and the agent can drain the wallet to any address. There is **no budget, no per-transaction cap, no destination allowlist, no audit trail, and no kill switch.** This skill replaces that default with enforced, non-custodial spending controls, and wires up the two sides of agent commerce (paying and getting paid) the way the 2026 stack actually does it.

## What this skill is for

Use this skill when the user asks for any of:

### 1. Pay — agent consumes paid resources
- "Let my agent pay for this API without an API key" / "pay per request in USDC"
- Consume x402-paywalled endpoints, MCP servers, or another agent's service
- Budget-tracked autonomous spend → [pay-x402-client.md](pay-x402-client.md)

### 2. Get paid — agent/API monetizes itself
- "Charge per call for my API / MCP tool / agent service"
- Add an HTTP 402 paywall (Express / Next.js / Hono / FastAPI), price routes, settle in USDC → [monetize-x402-server.md](monetize-x402-server.md)

### 3. Spend safely — custody + enforced limits
- "Which wallet should my agent use?" → [agent-wallets.md](agent-wallets.md)
- "Cap the agent at $X/day, allowlist destinations, add a kill switch" → [spending-controls.md](spending-controls.md)
- "Replace this raw `SOLANA_PRIVATE_KEY` with something safe" → [spending-controls.md](spending-controls.md)

### 4. Authorize — prove the agent may spend a user's money
- Human-in-the-loop approval, verifiable intent, audit trail → [mandates-ap2.md](mandates-ap2.md)

### 5. Settle — the USDC + Solana mechanics underneath
- Mints, decimals, ATAs, gasless (fee abstraction), finality, idempotent receipts → [usdc-settlement.md](usdc-settlement.md)

## How the pieces fit (mental model)

Agent payments in 2026 are **three layers**, often conflated. Keep them separate:

| Layer | Question it answers | Standard / tool | This skill's file |
|-------|---------------------|-----------------|-------------------|
| **Authorization** | *Is this agent allowed to spend this money?* | AP2 mandates (Google, Sept 2025) | [mandates-ap2.md](mandates-ap2.md) |
| **Settlement** | *How does value actually move?* | x402 v2 (Coinbase CDP) over USDC | [pay-x402-client.md](pay-x402-client.md) · [monetize-x402-server.md](monetize-x402-server.md) |
| **Custody + policy** | *What holds the keys and enforces limits?* | Squads v4 / Privy / Turnkey / CDP / Crossmint | [agent-wallets.md](agent-wallets.md) · [spending-controls.md](spending-controls.md) |

x402 is the **stablecoin settlement extension of AP2** — the A2A x402 extension carries an AP2 mandate into on-chain settlement, so crypto payments get the same audit trail card payments get. You can adopt x402 alone (most common today), or pair it with AP2 mandates when an agent spends *a user's* money rather than its own.

## Default stack decisions (opinionated, 2026)

1. **Protocol: x402 v2.** Use the scoped `@x402/*` packages (`@x402/core`, `@x402/svm`, `@x402/fetch`, `@x402/express|next|hono|fastify`). v2 uses the `PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE` / `PAYMENT-RESPONSE` headers and CAIP-2 networks. Treat the older single `X-Payment` + `x402Version: 1` shape as **legacy** (see [resources.md](resources.md#protocol-versions)).
2. **Currency: USDC.** Solana mainnet mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (6 decimals). x402 settles in USDC, not SOL.
3. **Settlement chain: Solana mainnet.** Sub-second finality, ~$0.00025 fees — ideal for micropayments. Develop on devnet first.
4. **Scheme: `exact`** (`ExactSvmScheme`) for Solana. `upto` and `batch-settlement` are **EVM-only** as of 2026 — do not promise them on Solana.
5. **Custody: never a bare keypair in prod.** Default to **on-chain enforcement** (Squads v4 spending limits or Crossmint smart wallets) when the threat model demands that a buggy agent *cannot* exceed limits. Use **off-chain policy** (Privy / Turnkey / Coinbase Agentic Wallets) when you want managed key infra and trust the signer service. See the decision matrix in [agent-wallets.md](agent-wallets.md).
6. **Facilitator: don't touch the chain from your server.** Use a facilitator to verify+settle: `https://x402.org/facilitator` (testnet), Coinbase CDP or PayAI (prod), or self-host **Kora** for a Solana-native, fee-abstracted facilitator. See [monetize-x402-server.md](monetize-x402-server.md).
7. **Every autonomous spender gets a budget + a kill switch.** Non-negotiable. See [spending-controls.md](spending-controls.md).

## Operating procedure

### 1. Classify the request

| If the user wants to… | Route to | Primary tool |
|-----------------------|----------|--------------|
| Have an agent pay for an API / MCP / service | [pay-x402-client.md](pay-x402-client.md) | `@x402/fetch` |
| Monetize / paywall their own API or MCP | [monetize-x402-server.md](monetize-x402-server.md) | `@x402/express` + facilitator |
| Choose where the agent's keys live | [agent-wallets.md](agent-wallets.md) | Squads v4 / Privy / Turnkey / CDP / Crossmint |
| Enforce caps, allowlists, budgets, kill switch | [spending-controls.md](spending-controls.md) | `@sqds/multisig` spending limits |
| Authorize agent spend / human approval / audit | [mandates-ap2.md](mandates-ap2.md) | AP2 mandate + A2A x402 extension |
| Get USDC/ATA/gasless/receipt details right | [usdc-settlement.md](usdc-settlement.md) | `@solana/spl-token`, Kora |
| Look up a package, version, mint, or endpoint | [resources.md](resources.md) | — |

### 2. Pick the right agent

| Task type | Agent | Suggested model |
|-----------|-------|-----------------|
| Implement x402 client/server + wallet wiring | [agent-payments-engineer](../agents/agent-payments-engineer.md) | sonnet |
| Review spending controls, threat-model an agent's money path, find god-mode footguns | [payment-safety-auditor](../agents/payment-safety-auditor.md) | opus |

### 3. Apply the safety baseline (always)

Before any agent goes near mainnet funds, confirm **all** of these — the [payment-safety-auditor](../agents/payment-safety-auditor.md) checks them, and [rules/payments.md](../rules/payments.md) enforces the code-level ones:

- [ ] No raw private key with unlimited authority. Funds sit behind an enforced limit (on-chain spending limit or policy-gated signer).
- [ ] Per-transaction cap **and** rolling budget (daily/session) are set and enforced — not just logged.
- [ ] Destination allowlist for any non-x402 transfer. (x402 pays the facilitator-validated `payTo`; arbitrary transfers are the dangerous path.)
- [ ] Kill switch: a single config flip / multisig action halts all spend.
- [ ] Every settlement persists its `PAYMENT-RESPONSE` receipt for audit.
- [ ] Secrets via env/secret manager, never committed. Wallet files gitignored.
- [ ] Devnet-tested before mainnet. Amounts handled in atomic units (USDC ×10^6).

A runnable, offline model of this baseline — the pay→settle loop with the per-tx cap, session budget, allowlist, and kill switch enforced — is in [`examples/devnet-x402/`](../examples/devnet-x402/) (`node --test`, 12 passing tests).

### 4. Commands

| Command | Purpose |
|---------|---------|
| [/add-x402-paywall](../commands/add-x402-paywall.md) | Wrap an existing API route behind an x402 paywall to charge per call |
| [/setup-agent-wallet](../commands/setup-agent-wallet.md) | Scaffold a non-custodial agent wallet with caps + allowlist + kill switch |
| [/audit-agent-spending](../commands/audit-agent-spending.md) | Audit an agent's payment code for god-mode keys and missing limits |

## Relationship to the rest of the kit

This skill is the **payments + controls layer**; it routes to (does not duplicate) the protocol skills:

- **`solana-agent-kit`** gives the agent 60+ actions. This skill governs *how it pays for and is paid for* those actions, and replaces its raw-keypair wallet with a capped one.
- **`birdeye` x402 example** is a single consumer of x402; [pay-x402-client.md](pay-x402-client.md) generalizes that pattern to any x402 resource and adds budget tracking.
- **`squads`** covers multisig broadly; [spending-controls.md](spending-controls.md) applies its spending-limit primitive specifically to autonomous agents.
- For raw token transfers, ATAs, and Token-2022 → defer to the kit's core `solana-dev` skill and `token-2022.md`.

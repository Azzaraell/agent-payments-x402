# Agent wallets — where the keys live and who enforces the limits

The single most important payments decision for an autonomous agent is **not** which protocol — it's **what holds the key and how limits are enforced**. Get this wrong and every other control is theater.

## The one distinction that matters: on-chain vs off-chain enforcement

| | **On-chain enforcement** | **Off-chain (signer-layer) enforcement** |
|---|---|---|
| Who enforces the cap | A smart-contract / multisig program on Solana | A signing service that refuses to sign violating txns |
| If the agent is buggy / prompt-injected | Limit **cannot** be exceeded — the chain rejects it | Limit holds **only** if the service + code path are intact |
| Trust assumption | Trust the audited program | Trust the provider's policy engine + your integration |
| Best for | High-value, adversarial, "must not be bypassable" | Managed key infra, fast iteration, MFA/approval UX |
| Examples | **Squads v4 spending limits**, Crossmint smart wallets | **Privy**, **Turnkey**, **Coinbase Agentic Wallets** |

Rule of thumb: **the more the agent is autonomous and exposed to untrusted input, the more you want on-chain enforcement.** A bug can't argue with a program that rejects the transaction.

## The chooser

| Use case | Recommendation |
|----------|----------------|
| Autonomous agent moving real funds, must be un-bypassable | **Squads v4 spending limit** (agent = member, capped per period, allowlisted destinations) — see [spending-controls.md](spending-controls.md) |
| You want managed wallets + policy + MFA, trust the provider | **Privy** or **Turnkey** server wallets |
| You're already on Coinbase CDP / AgentKit and want TEE + session caps + native x402 | **Coinbase Agentic Wallets** |
| You need both stablecoin **and** card rails with on-chain caps | **Crossmint** smart wallets |
| Local dev / devnet only | A raw `Keypair` is fine **on devnet** — never ship it to mainnet |

## The options

### Squads v4 — on-chain, Solana-native (default for un-bypassable limits)
A multisig vault where the agent is a member with an on-chain **spending limit**: it can spend up to `amount` per `period` to an allowlisted set of destinations **without** a proposal, and **nothing** beyond that. Enforced by the Squads program — a buggy agent physically cannot exceed it. This is the strongest fit for "the agent must not be able to drain the treasury." Full verified code in [spending-controls.md](spending-controls.md).

```bash
npm install @sqds/multisig @solana/web3.js
```

### Privy — embedded + server wallets, off-chain policy
Server wallets for agents with attached policies: transfer limits, approved protocols/contracts, recipient restrictions, and operating-time windows. Enforced at Privy's signing layer (it refuses to sign violations). Supports Solana, EVM, Bitcoin. Good when you want managed keys + a policy UI and accept the trust assumption. Wire the Privy server-wallet signer in place of a raw keypair, then attach a policy via their dashboard/API. (See [resources.md](resources.md) for docs.)

### Turnkey — signing API + policy engine, off-chain
A low-level signing API (Solana, EVM, Bitcoin, TRON) with a policy engine for transaction limits, address whitelisting, and MFA-style approval flows. The service refuses to sign transactions that violate policy. Choose Turnkey when you want fine-grained, programmable signing infra rather than a batteries-included wallet.

### Coinbase Agentic Wallets — TEE-enforced, x402-native
Launched Feb 2026, built on AgentKit + the x402 protocol. Non-custodial keys live in a **TEE**. Two control primitives configured by the operator at creation (tightenable on the fly):
- **Session caps** — bound *total* spend across an entire agent run.
- **Transaction limits** — bound a *single* payment.

The most "x402-batteries-included" option if you're already in the Coinbase CDP stack and want session-level budgets without writing the budget loop yourself.

### Crossmint — smart wallets, on-chain caps, stablecoin + cards
Smart-contract wallets that enforce **per-transaction limits, daily caps, and recipient allowlists on-chain**, plus both stablecoin and card payment rails. Pick this when you want on-chain guarantees *and* fiat/card rails in one place.

## Whichever you pick, the baseline holds

The provider gives you the *mechanism*; you still owe the *policy*:

- A **per-transaction cap** and a **rolling budget** (daily and/or per session).
- A **destination allowlist** for arbitrary transfers (x402's facilitator-validated `payTo` is the safe path; freeform transfers are the dangerous one).
- A **kill switch** — one action halts all spend (multisig config change, policy disable, or revoking the session).
- **Receipts persisted** for every settlement.

These are detailed, with enforcement code, in [spending-controls.md](spending-controls.md).

## Anti-pattern (what this whole file exists to prevent)

```ts
// NEVER in production: unlimited authority, no cap, no allowlist, no audit.
const wallet = new KeypairWallet(
  Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY!))
);
```

If you find this in agent code touching mainnet, stop and replace it — that's exactly what [/audit-agent-spending](../commands/audit-agent-spending.md) flags.

---
description: Scaffold a non-custodial agent wallet on Solana with enforced caps, destination allowlist, and a kill switch — never a raw private key.
argument-hint: [optional: custody choice — squads | privy | turnkey | cdp | crossmint]
---

Set up a safe agent wallet. Custody preference (if given): **$ARGUMENTS**

Goal: give the agent a wallet it can spend from autonomously **within hard, enforced limits** — and that a bug or injection cannot drain.

Steps:

1. Read `skill/agent-wallets.md` (custody chooser) and `skill/spending-controls.md` (enforcement).
2. Pick custody:
   - If no preference, recommend **Squads v4 spending limit** (on-chain, un-bypassable) for any mainnet/real-funds agent; a raw `Keypair` only for **devnet**.
   - Otherwise honor the choice (Privy / Turnkey / Coinbase Agentic Wallets / Crossmint) and note its trust assumption (off-chain vs on-chain enforcement).
3. Establish the controls (all of them):
   - Per-transaction cap **and** rolling/session budget (ask for amounts; suggest defaults).
   - Destination allowlist (on-chain `destinations` for Squads; policy for off-chain providers).
   - Kill switch (remove spending limit / disable policy / `PAYMENTS_ENABLED=false`).
   - Receipt persistence for `PAYMENT-RESPONSE`.
4. For Squads: scaffold create-limit (config tx → approve/execute) + use-limit code from `skill/spending-controls.md`, in **USDC atomic units** (×10^6), `period: Day` by default.
5. Generate `.env.example` (RPC, mint, network id, facilitator, caps) and ensure wallet files are gitignored.
6. Devnet test: confirm a spend within the cap succeeds and a spend over the cap (or to a non-allowlisted address) is **rejected**.

Constraints: never write a mainnet path with unlimited key authority. Atomic units only. Hand the result to `payment-safety-auditor` before mainnet.

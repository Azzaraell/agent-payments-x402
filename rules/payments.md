---
description: Safety law for agent payment & wallet code on Solana. Auto-load when editing files that touch x402, wallets, keypairs, spending limits, or token transfers.
globs: ["**/*payment*.{ts,tsx,js,mjs}", "**/*wallet*.{ts,tsx,js,mjs}", "**/*x402*.{ts,tsx,js,mjs}", "**/*agent*.{ts,tsx,js,mjs}"]
alwaysApply: false
---

# Payment & wallet safety rules

These are hard constraints for any code that can move funds. They exist because an autonomous agent will eventually be prompt-injected, loop, or hallucinate a recipient. See `skill/spending-controls.md` for the full rationale.

## Never

- **Never** give a mainnet path unlimited key authority. No bare `Keypair.fromSecretKey(process.env.SOLANA_PRIVATE_KEY)` / `KeypairWallet` as the production spender. Authority sits behind an on-chain spending limit (Squads v4) or a policy-gated signer (Privy/Turnkey/CDP/Crossmint). A raw keypair is **devnet-only**.
- **Never** hardcode private keys, secrets, or API keys. Read from env / secret manager. Wallet files (`*-keypair.json`, `keypair.json`, `id.json`, `wallet.json`) must be gitignored.
- **Never** transfer to an address the model produced without checking it against an allowlist. Prefer x402's facilitator-validated `payTo` over freeform transfers.
- **Never** do money math in floats near a transfer. USDC = 6 decimals, SOL = 9 — use atomic units (`bigint`).
- **Never** place an x402 payment inside a loop without a session ceiling.
- **Never** mix x402 v1 (`X-Payment`, `x402Version: 1`) with v2 (`PAYMENT-*` headers, CAIP-2). Target v2.

## Always

- **Always** enforce a per-transaction cap **and** a rolling/session budget — enforced, not merely logged.
- **Always** include a kill switch that halts all spend in one action.
- **Always** persist the `PAYMENT-RESPONSE` receipt and key records by it (idempotency + audit).
- **Always** pull USDC mint + CAIP-2 network id from `@x402/svm` constants (or the verified table in `skill/resources.md`) and keep mint/network/facilitator env-driven.
- **Always** test the full loop on devnet before mainnet.

## When you see a violation

Stop and fix it (or, if reviewing, flag it by severity and route to `payment-safety-auditor`). A god-mode key, a missing cap, or a non-allowlisted destination on a mainnet path is **CRITICAL** — block it.

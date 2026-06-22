---
description: Wrap an existing API route (or MCP endpoint) behind an x402 paywall so agents pay per call in USDC on Solana.
argument-hint: [route path or file to paywall]
---

Add an x402 v2 paywall to: **$ARGUMENTS**

Goal: monetize the given route/endpoint so callers pay per request in USDC on Solana, with the server staying off-chain via a facilitator.

Steps:

1. Read `skill/monetize-x402-server.md` (and `skill/usdc-settlement.md` for mint/ATA details).
2. Detect the framework (Express / Next.js / Hono / Fastify) and install the matching `@x402/<framework>` + `@x402/core` + `@x402/svm`.
3. Wrap the target route with `paymentMiddleware`:
   - `payTo` = the project's base58 Solana receiving address (env: `PAYTO_SOLANA_ADDRESS`).
   - Per-route price (ask the user if unknown; suggest a sensible micro-price).
   - `network: "solana"`, `scheme: "exact"`.
   - Facilitator URL from env (`X402_FACILITATOR_URL`) — default `https://x402.org/facilitator` for devnet.
4. Ensure the `payTo` address has a USDC ATA (create if missing).
5. Use a `"0"` settlement override for cached/free responses.
6. Write a devnet end-to-end test: unpaid call → `402` + `PAYMENT-REQUIRED`; paid retry → `200` + `PAYMENT-RESPONSE`; USDC lands at `payTo`'s ATA.

Constraints: x402 **v2** only (`PAYMENT-*` headers, CAIP-2 networks). Do not promise `upto`/`batch` on Solana. Keep mint/network/facilitator env-driven. Devnet before mainnet.

Report what changed, the price set, and the exact command to test on devnet.

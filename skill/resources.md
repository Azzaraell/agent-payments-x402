# Resources & reference

Canonical links, packages, and constants for the 2026 agent-payments stack. The space moves fast — **verify package versions on npm and constants against the official docs before shipping.** Treat this file as a map, not a frozen snapshot.

## Packages

### x402 (settlement)
| Package | Role |
|---------|------|
| `@x402/core` | Core protocol primitives |
| `@x402/svm` | Solana (SVM) scheme + network/mint constants |
| `@x402/evm` | EVM scheme (add if you also accept Base) |
| `@x402/fetch` | Client wrapper — `wrapFetchWithPayment` / `withPaymentInterceptor` |
| `@x402/express` · `@x402/next` · `@x402/hono` · `@x402/fastify` | Server middleware — `paymentMiddleware` |
| `x402[fastapi]` · `x402[flask]` + `x402[svm]` (pip) | Python server |
| `github.com/x402-foundation/x402/go/v2` (Go) | Go server |
| `x402-solana` (npm) | Community Solana implementation of x402 v2 — alternative to `@x402/svm` |
| `@faremeter/payment-solana` · `@faremeter/fetch` (Corbits) | Solana-first SDK alternative |

### Custody & controls
| Package / service | Role |
|-------------------|------|
| `@sqds/multisig` | Squads v4 — on-chain multisig + spending limits |
| Privy (server wallets) | Off-chain policy-gated wallets (Solana/EVM/BTC) |
| Turnkey | Signing API + policy engine |
| Coinbase CDP / AgentKit / Agentic Wallets | TEE wallets, session caps, native x402 |
| Crossmint | On-chain smart wallets, stablecoin + card rails |
| `@solana/web3.js` · `@solana/spl-token` | Core Solana + SPL token (ATAs, transfers) |

## Facilitators

| Facilitator | URL | Networks |
|-------------|-----|----------|
| x402.org (testnet) | `https://x402.org/facilitator` | Base Sepolia + Solana devnet |
| Coinbase CDP (prod) | `https://api.cdp.coinbase.com/platform/v2/x402` | Base + Solana |
| PayAI (prod) | `https://facilitator.payai.network` | Covers tx fees |
| Kora (self-host) | Kora CLI / `surfpool` | Solana-native, fee-abstracted |

## <a id="protocol-versions"></a>Protocol versions — v1 vs v2 (read this)

x402 has evolved; sources on the web mix the two. This skill targets **v2**.

| | v1 (legacy) | **v2 (use this)** |
|---|---|---|
| Payment header | single `X-Payment` (base64 JSON, `x402Version: 1`) | `PAYMENT-REQUIRED` (402) / `PAYMENT-SIGNATURE` (retry) / `PAYMENT-RESPONSE` (receipt) |
| Network id | string, e.g. `"solana-devnet"` | CAIP-2, e.g. `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |
| Packages | early Coinbase ref / Faremeter | scoped `@x402/*` (`@x402/core`, `@x402/svm`, …) |
| Schemes | `exact` | `exact` (Solana) · `upto` / `batch-settlement` (EVM-only) |

If a tutorial uses `X-Payment` with `x402Version: 1`, it's v1 — translate to v2 before relying on it. The kit's own `birdeye` x402 example uses v2 headers.

## Quick-reference constants

```
USDC mainnet mint : EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v   (6 decimals)
USDC devnet  mint : 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU   (6 decimals)
Solana mainnet CAIP-2 : solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp
Solana decimals  : SOL = 9 · USDC = 6
x402 Solana scheme : exact (ExactSvmScheme)
```

## Primary docs

**x402**
- Protocol repo: https://github.com/coinbase/x402
- Docs: https://docs.x402.org — seller quickstart: https://docs.x402.org/getting-started/quickstart-for-sellers
- Solana intro: https://solana.com/developers/guides/getstarted/intro-to-x402
- Build a Solana facilitator (Kora): https://solana.com/developers/guides/getstarted/build-a-x402-facilitator
- Next.js Solana template: https://solana.com/developers/templates/x402-template
- What is x402: https://solana.com/x402/what-is-x402
- Birdeye x402 (in-ecosystem example): https://docs.birdeye.so/reference/x402

**Custody & controls**
- Squads v4 docs: https://docs.squads.so · Grid API: https://developer-api.squads.so
- Agent wallets compared (Crossmint): https://www.crossmint.com/learn/agent-wallets-compared
- Coinbase Agentic Wallets: https://www.coinbase.com/developer-platform/discover/launches/agentic-wallets
- Privy: https://docs.privy.io · Turnkey: https://docs.turnkey.com

**Authorization (AP2)**
- AP2 announcement (Google Cloud): https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol
- Google AP2 × x402 (Coinbase): https://www.coinbase.com/developer-platform/discover/launches/google_x402
- Verify-then-pay research: TessPay (arXiv 2602.00213) · A402 (arXiv 2603.01179)

## Where this skill sits in the kit

- Complements `solana-agent-kit` (actions) by governing how the agent pays and is paid, and by replacing its raw-keypair wallet.
- Generalizes the `birdeye` x402 example into a reusable client + adds budgets.
- Applies the `squads` spending-limit primitive specifically to autonomous agents.
- Defers raw token/ATA/Token-2022 mechanics to the core `solana-dev` skill and `token-2022.md`.

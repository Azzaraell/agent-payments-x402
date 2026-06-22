# Get paid — x402 server (monetize an API, MCP, or agent service)

How to put an HTTP 402 paywall in front of your own API, MCP tools, or agent so other agents (and humans) pay you per call in USDC on Solana. Your server never touches the chain — a **facilitator** verifies and settles.

## Pick your framework package

x402 v2 ships official middleware. Install the framework package plus the core + the chains you accept (`@x402/svm` for Solana):

```bash
# Express
npm install @x402/express @x402/core @x402/svm
# Next.js
npm install @x402/next   @x402/core @x402/svm
# Hono (Cloudflare Workers / edge)
npm install @x402/hono   @x402/core @x402/svm
# Fastify
npm install @x402/fastify @x402/core @x402/svm
```

Python (`pip install 'x402[fastapi]' 'x402[svm]'` or `'x402[flask]'`), Go (`go get github.com/x402-foundation/x402/go/v2`), and Rust are also official. Add `@x402/evm` too if you want to accept Base as well as Solana.

## Paywall a route (Express)

```ts
import express from "express";
import { paymentMiddleware } from "@x402/express";

const app = express();

// Network is a CAIP-2 id in v2. Source it from @x402/svm constants or env —
// mainnet "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", devnet "solana:EtWTRABZ…".
const NETWORK = process.env.X402_NETWORK!;

// payTo = your Solana receiving address (base58). Price is per-route.
app.use(
  paymentMiddleware(
    process.env.PAYTO_SOLANA_ADDRESS!, // base58, NOT a 0x EVM address
    {
      "GET /premium/quote":    { price: "$0.001", network: NETWORK, scheme: "exact" },
      "POST /premium/analyze": { price: "$0.05",  network: NETWORK, scheme: "exact" },
    },
    {
      // Facilitator verifies + settles so your server stays off-chain.
      facilitator: { url: process.env.X402_FACILITATOR_URL! },
    }
  )
);

app.get("/premium/quote", (_req, res) => {
  res.json({ pair: "SOL-USDC", price: 142.31 }); // only runs after payment settles
});

app.listen(3000);
```

> Confirm the exact `paymentMiddleware` argument/options shape against the version of `@x402/express` you install — the protocol is stable (v2 headers, `exact` scheme, CAIP-2 ids) but middleware ergonomics evolve across releases.

Behind the scenes the middleware:
1. Returns **`402 Payment Required`** + a **`PAYMENT-REQUIRED`** header (price, `payTo`, network, scheme, USDC mint) when payment is absent.
2. On retry, reads the client's **`PAYMENT-SIGNATURE`** header and asks the facilitator to verify + settle.
3. On success, runs your handler and adds a **`PAYMENT-RESPONSE`** receipt header.

Clients integrate with zero bespoke code via `@x402/fetch` — see [pay-x402-client.md](pay-x402-client.md).

## Facilitator: do not settle from your own server

The facilitator abstracts the chain (verify signature, submit, confirm). Choose one:

| Environment | Facilitator URL | Notes |
|-------------|-----------------|-------|
| Testnet | `https://x402.org/facilitator` | Base Sepolia + **Solana devnet**. Start here. |
| Production (hosted) | `https://api.cdp.coinbase.com/platform/v2/x402` | Coinbase CDP. Needs CDP credentials. |
| Production (hosted) | `https://facilitator.payai.network` | PayAI — covers transaction fees. |
| Production (self-host) | **Kora** (`surfpool`/Kora CLI) | Solana-native facilitator: pays network fees, signs, validates. Self-host for full control + fee abstraction. See [usdc-settlement.md](usdc-settlement.md#gasless). |

Crossmint is also rolling out facilitator support. Keep the URL in env so you can move testnet → prod without code changes.

## Solana / SVM specifics (get these right)

- **Scheme:** use `exact` (`ExactSvmScheme`). `upto` and `batch-settlement` are **EVM-only** in 2026 — do not offer them on a Solana route.
- **`payTo`:** a base58 Solana address (differs from EVM hex). Payments land in its USDC associated token account.
- **Network id (CAIP-2):** mainnet `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`, devnet `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1…`. Prefer the constants exported by `@x402/svm` over hardcoding.
- **Currency:** USDC only. Price strings like `"$0.001"` are converted to atomic USDC (×10^6) by the middleware.
- **Settlement overrides** (`setSettlementOverrides`): charge less than the authorized max — atomic units (`"1000"`), a percentage (`"50%"`), or a USD price (`"$0.05"`). Must be `<=` the authorized maximum; `"0"` means no charge (e.g. a cache hit). Use this to give cached or partial responses for free.

## Monetize an MCP server / agent tools

To charge other agents for your MCP tools, paywall the MCP server's HTTP transport route the same way — wrap the transport handler in `paymentMiddleware` with per-tool pricing. A calling agent using the budgeted client from [pay-x402-client.md](pay-x402-client.md) pays automatically within its cap. This is how an agent earns: expose a useful tool, price it, settle in USDC.

```ts
// Price the MCP HTTP endpoint; each tool invocation that hits it settles in USDC.
// NETWORK = CAIP-2 id from @x402/svm/env (see above).
app.use(paymentMiddleware(PAYTO, {
  "POST /mcp": { price: "$0.002", network: NETWORK, scheme: "exact" },
}, { facilitator: { url: FACILITATOR_URL } }));
```

## Test end to end

1. Run the server with `X402_FACILITATOR_URL=https://x402.org/facilitator` and a **devnet** `payTo`.
2. From a devnet-USDC wallet, call the route with the [pay-x402-client.md](pay-x402-client.md) client.
3. Assert: first call → `402` + `PAYMENT-REQUIRED`; paid retry → `200` + `PAYMENT-RESPONSE`; USDC arrives at `payTo`'s ATA.
4. Flip the facilitator URL + `payTo` to mainnet only after devnet passes.

## Checklist

- [ ] `payTo` is a base58 Solana address with a USDC ATA (create it if missing — [usdc-settlement.md](usdc-settlement.md)).
- [ ] Scheme is `exact`; no `upto`/`batch` promised on Solana.
- [ ] Facilitator URL is env-driven (testnet → prod without code edits).
- [ ] Per-route pricing is intentional; free/cached responses use a `"0"` settlement override.
- [ ] Receipts (`PAYMENT-RESPONSE`) are logged server-side for reconciliation.

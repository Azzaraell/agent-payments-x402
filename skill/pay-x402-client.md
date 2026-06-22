# Pay — x402 client (agent consumes paid resources)

How an agent pays per request for any x402-paywalled API, MCP server, or other agent — in USDC on Solana, with no API key and no account. This is the "agent has a Solana wallet with USDC → just pay for what it needs" path.

> Prerequisite: the wallet must hold **USDC on Solana** (and a little SOL for rent/fees unless the facilitator abstracts them — see [usdc-settlement.md](usdc-settlement.md)). Wire the wallet through [spending-controls.md](spending-controls.md) before mainnet — do **not** load a bare keypair in production.

## Install

```bash
npm install @x402/fetch @x402/svm @solana/kit @scure/base
```

`@x402/fetch` wraps `fetch` and transparently handles the 402 → sign → retry loop. `@x402/svm` provides the Solana (SVM) payment scheme + the signer adapter; the signer is built on `@solana/kit` (web3.js v2), not the legacy `@solana/web3.js`.

## Minimal client

```ts
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactSvmScheme, toClientSvmSigner } from "@x402/svm";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";

// DEV ONLY. In production the signer is a policy-gated wallet, not a raw key —
// see spending-controls.md (Squads spending limit / Privy / Turnkey / CDP).
const kp = await createKeyPairSignerFromBytes(base58.decode(process.env.SVM_PRIVATE_KEY!));
const signer = toClientSvmSigner(kp);

const NETWORK = process.env.X402_NETWORK!; // devnet "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"

// Wrap fetch once. Every 402 is paid + retried automatically, within the schemes you allow.
const fetch402 = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: NETWORK, client: new ExactSvmScheme(signer) }],
});

const res = await fetch402("https://api.example.com/x402/quote?pair=SOL-USDC", {
  headers: { Accept: "application/json" },
});
const data = await res.json();
```

> `@x402/fetch` also exports `wrapFetchWithPayment(fetch, x402Client)` if you build the `x402Client` yourself. Confirm the `ExactSvmScheme` constructor + import subpath against the version you install (shape verified vs `@x402/*@2.16`) — see [resources.md](resources.md).

## The flow (what the wrapper does for you)

x402 v2 over Solana:

1. **Request** the protected URL with no payment.
2. Server replies **`402 Payment Required`** + a **`PAYMENT-REQUIRED`** header describing the price, `payTo`, network (CAIP-2, e.g. `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` mainnet), scheme (`exact`), and the USDC mint.
3. The wrapper builds and signs a USDC transfer transaction on Solana.
4. It retries the request with a **`PAYMENT-SIGNATURE`** header carrying the signed payment.
5. The server (via its facilitator) verifies + settles, then returns **`200`** + the data, plus a **`PAYMENT-RESPONSE`** header — the settlement receipt. **Persist it** (audit trail).

```
GET /x402/resource ───────────────▶  402 + PAYMENT-REQUIRED
  sign USDC tx (Solana) ◀───────────
GET /x402/resource + PAYMENT-SIGNATURE ▶  200 + data + PAYMENT-RESPONSE (receipt)
```

Re-requesting within a server's cache TTL is typically **free** — the server returns a cached response without charging again.

## Wrap it with a budget (the part agent kits skip)

The raw wrapper will pay *every* 402 with no ceiling. For an autonomous agent, gate it behind a budget so a loop or injection can't bleed the wallet. This is a client-side guard; pair it with on-chain enforcement from [spending-controls.md](spending-controls.md) for defense in depth.

```ts
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";

interface Budget {
  perRequestMaxUsd: number;   // reject any single payment above this
  sessionCapUsd: number;      // total across this run
}

// `schemes` is the same [{ network, client: new ExactSvmScheme(signer) }] array
// passed to wrapFetchWithPaymentFromConfig in the minimal client above.
function budgetedFetch(baseFetch: typeof fetch, schemes: any[], budget: Budget) {
  let spentUsd = 0;
  const paid = wrapFetchWithPaymentFromConfig(baseFetch, { schemes });

  return async function (url: string, init?: RequestInit): Promise<Response> {
    // 1. Probe price first: an unpaid request returns 402 + PAYMENT-REQUIRED.
    const probe = await baseFetch(url, init);
    if (probe.status === 402) {
      const priceUsd = parsePriceUsd(probe.headers.get("PAYMENT-REQUIRED"));
      if (priceUsd > budget.perRequestMaxUsd)
        throw new Error(`x402 price $${priceUsd} exceeds per-request cap $${budget.perRequestMaxUsd}`);
      if (spentUsd + priceUsd > budget.sessionCapUsd)
        throw new Error(`x402 would exceed session cap: $${(spentUsd + priceUsd).toFixed(4)} > $${budget.sessionCapUsd}`);
      spentUsd += priceUsd;
    }
    // 2. Now actually pay + retry via the wrapper.
    const res = await paid(url, init);
    const receipt = res.headers.get("PAYMENT-RESPONSE");
    if (receipt) recordReceipt(url, priceForUrl(url), receipt); // persist for audit
    return res;
  };
}

// parsePriceUsd / recordReceipt are app-provided; the PAYMENT-REQUIRED header
// carries base64-encoded payment requirements (amount + mint) per the x402 v2 spec.
```

> Design note: probe-then-pay costs one extra round trip but is the only way to enforce a ceiling *before* funds move when using the auto-wrapper. If you control the call site, prefer reading `PAYMENT-REQUIRED` from the first 402 you already receive rather than a separate probe.

## Consuming an x402-paywalled MCP server

MCP tools can be paywalled the same way (the kit's own registry notes x402-monetized MCPs). Point the MCP client's HTTP transport at the budgeted fetch so each tool call that returns 402 is paid within the cap. The agent calls the tool normally; payment is invisible to the model. Keep the budget guard — a paywalled tool in a loop is exactly the failure mode to bound.

## Error handling

```ts
try {
  const res = await fetch402(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${await res.text()}`);
  return await res.json();
} catch (err: any) {
  if (String(err.message).includes("402"))
    // Payment did not resolve — almost always insufficient USDC in the wallet.
    console.error("x402 payment failed — check USDC balance on Solana mainnet");
  throw err;
}
```

| Symptom | Cause |
|---------|-------|
| 402 never resolves to 200 | Insufficient USDC balance in the signer wallet |
| 402 retry loop | Facilitator rejected the payment — network issue or wrong keypair/scheme |
| Payment above expected | Server set per-route pricing — read `PAYMENT-REQUIRED`, enforce a cap |
| Works on devnet, fails on mainnet | Wrong USDC mint / network CAIP-2 id — see [usdc-settlement.md](usdc-settlement.md) |

## Checklist

- [ ] Wallet holds USDC on the target network (devnet first).
- [ ] Signer is policy-gated, not a bare key, before mainnet ([spending-controls.md](spending-controls.md)).
- [ ] A per-request cap **and** session cap wrap the auto-payer.
- [ ] `PAYMENT-RESPONSE` receipts are persisted.
- [ ] Network CAIP-2 id + USDC mint pulled from `@x402/svm` constants, not hardcoded guesses.

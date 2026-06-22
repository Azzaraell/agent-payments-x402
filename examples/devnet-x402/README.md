# Devnet x402 demo — runnable money path + spending controls

A zero-dependency, runnable model of the x402 v2 flow this skill describes: an agent
**pays** for a paywalled resource, a server **gets paid**, and every payment passes
through **enforced spending controls**. Runs on Node alone — no `npm install`, no devnet
funds, no keys.

It exists to make the skill's safety claims concrete and testable. The spending-control
layer (`src/spend-guard.js`) is the part raw x402 wrappers omit, and it's the part that's
unit-tested here.

## What's real vs modeled

| Real (verified, exercised by the tests) | Modeled (so it runs offline) |
|---|---|
| Flow + wire headers: `402` + `PAYMENT-REQUIRED` → pay with `PAYMENT-SIGNATURE` → `200` + `PAYMENT-RESPONSE` (base64, verified vs `@x402/core@2.16`) | The **facilitator** (verify + settle) runs in-process — no Solana transaction |
| Enforced controls: per-tx cap, session budget, destination allowlist, kill switch, idempotent receipts | The **signer** is a stub — no real key or signature |
| USDC atomic-unit math (6 decimals, `bigint`) | Settlement is not on-chain |
| Constants: devnet USDC mint + CAIP-2 id (verified vs `@x402/svm@2.16`) | — |

The facilitator and signer are exactly the two pieces a real deployment delegates to
`@x402/*` + a hosted facilitator (below). Everything else here is the real logic.

## Run it

```
node demo.js     # or: npm run demo
node --test      # or: npm test
```

`node demo.js` (port is random each run):

```
x402 paywall on http://127.0.0.1:59953/premium/quote
  network  solana-devnet = solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1
  USDC     4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
  budget   per-tx $0.010000 | session $0.050000

call 1  paid $0.001  ->  {"pair":"SOL-USDC","price":142.31}
        spent $0.001000 | remaining $0.049000 | receipts 1
call 2  paid $0.001  ->  {"pair":"SOL-USDC","price":142.31}
        spent $0.002000 | remaining $0.048000 | receipts 2
call 3  paid $0.001  ->  {"pair":"SOL-USDC","price":142.31}
        spent $0.003000 | remaining $0.047000 | receipts 3

call 4  blocked  ->  KillSwitchError: kill switch engaged — all spend halted
```

`node --test` (12 tests, ~0.4s):

```
ℹ tests 12
ℹ pass 12
ℹ fail 0
```

## Going to real devnet

Swap the two modeled pieces for the official packages (snippets verified against
`@x402/*@2.16`). This path needs a funded devnet wallet + network, so it is **not** part
of the offline test above.

```
npm i express @x402/express @x402/core @x402/svm @x402/fetch @solana/kit @scure/base
```

Server — Express + `@x402/express`:

```ts
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactSvmScheme } from "@x402/svm"; // confirm the exact export/subpath on install

const facilitator = new HTTPFacilitatorClient({ url: process.env.X402_FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitator)
  .register(process.env.X402_NETWORK, new ExactSvmScheme());

const app = express();
app.use(
  paymentMiddleware(
    {
      "GET /premium/quote": {
        accepts: {
          scheme: "exact",
          price: "$0.001",
          network: process.env.X402_NETWORK,       // solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1 (devnet)
          payTo: process.env.PAYTO_SOLANA_ADDRESS, // base58 Solana address
        },
        description: "SOL-USDC quote",
      },
    },
    resourceServer,
  ),
);
app.get("/premium/quote", (_req, res) => res.json({ pair: "SOL-USDC", price: 142.31 }));
app.listen(3000);
```

Client — `@x402/fetch` + a Solana signer from `@x402/svm`:

```ts
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactSvmScheme, toClientSvmSigner } from "@x402/svm";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";

const kp = await createKeyPairSignerFromBytes(base58.decode(process.env.SVM_PRIVATE_KEY));
const signer = toClientSvmSigner(kp);

const fetch402 = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: process.env.X402_NETWORK, client: new ExactSvmScheme(signer) }],
});

const res = await fetch402("http://localhost:3000/premium/quote");
console.log(await res.json());
```

> The `@x402/*` middleware sets and reads the wire headers for you. The exact
> `ExactSvmScheme` constructor args and import subpath move across releases (the EVM
> equivalent is `@x402/evm/exact/server`) — confirm against the version you install,
> then run the full loop on devnet before mainnet. The `SpendGuard` in `src/` is the
> client-side half of safety; pair it with on-chain enforcement from
> [`../../skill/spending-controls.md`](../../skill/spending-controls.md).

## Files

| File | Role |
|------|------|
| `src/usdc.js` | USDC mints, CAIP-2 ids, exact atomic-unit (`bigint`) math |
| `src/spend-guard.js` | enforced per-tx cap, session budget, allowlist, kill switch, idempotent receipts |
| `src/facilitator.js` | mock verify + settle (labeled) — models the real facilitator's two guarantees |
| `src/server.js` | `node:http` paywall: `402` challenge → settle → `200` + receipt |
| `src/client.js` | budget-guarded pay loop (models `@x402/fetch` + the missing ceiling) |
| `demo.js` | runs server + client end to end |
| `test/` | `node:test` suites — spending controls + the handshake |

## Maps to the skill

`src/spend-guard.js` → [spending-controls.md](../../skill/spending-controls.md) ·
`src/server.js` → [monetize-x402-server.md](../../skill/monetize-x402-server.md) ·
`src/client.js` → [pay-x402-client.md](../../skill/pay-x402-client.md) ·
`src/usdc.js` → [usdc-settlement.md](../../skill/usdc-settlement.md)

# Settle — USDC on Solana, the mechanics underneath

x402 settles in USDC on Solana. The wrappers hide most of this, but you must get the constants and edge cases right — a mint or decimals mistake moves real money to the wrong place or in the wrong amount.

## USDC mints (the values to never guess)

| Network | USDC mint | Decimals |
|---------|-----------|----------|
| Solana **mainnet** | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | 6 |
| Solana **devnet** | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` | 6 |

Prefer the constant exported by `@x402/svm` over hardcoding when the package provides it. If you hardcode, hardcode *these*.

## Network ids (CAIP-2)

x402 v2 identifies networks by CAIP-2: mainnet `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`, devnet `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`. Pull these from `@x402/svm` constants — they must match the mint's network or settlement fails.

## Decimals & atomic units

USDC = **6 decimals**. SOL = **9**. Always do internal math in atomic units and convert only at display/boundary:

```ts
const USDC = 1_000_000;                  // 10^6 atomic units per USDC
const toAtomic = (usd: number) => BigInt(Math.round(usd * USDC));
const toDisplay = (atomic: bigint) => Number(atomic) / USDC;

toAtomic(0.05);   // 50_000n  ("$0.05")
toDisplay(2_500_000n); // 2.5  ("2.5 USDC")
```

A decimals error here is a 1,000,000× overpay. The [payment-safety-auditor](../agents/payment-safety-auditor.md) treats raw float amounts near a transfer as a finding.

## Associated Token Accounts (ATAs)

USDC lives in an **ATA** owned by the wallet, not the wallet address itself. Both payer and `payTo` recipient need a USDC ATA. Create the recipient's if it may not exist:

```ts
import { getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";

const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

// Derive the ATA address (read-only):
const ata = await getAssociatedTokenAddress(USDC_MINT, ownerPubkey);

// Ensure it exists (creates + funds rent if missing — needs a fee payer with SOL):
const account = await getOrCreateAssociatedTokenAccount(connection, feePayer, USDC_MINT, ownerPubkey);
```

A common "payment succeeded but funds not visible" bug is looking at the wallet address instead of its USDC ATA.

## <a id="gasless"></a>Gasless / fee abstraction (so the agent needs no SOL)

An agent that holds USDC but no SOL still needs someone to pay the network fee. Two routes:

- **Facilitator-paid fees:** facilitators like **PayAI** and self-hosted **Kora** cover transaction fees as part of settlement — the agent only needs USDC. Kora is a Solana-native facilitator backend that handles fees, signs, and validates. This is the cleanest path for "USDC-only" agents.
- **Fee-payer relayer:** a sponsor account co-signs as fee payer. Useful outside x402 (e.g. arbitrary transfers), but for x402 prefer a fee-abstracting facilitator.

Keep a small SOL balance anyway for ATA rent unless your facilitator handles it.

## Finality & idempotency

- Solana finality is sub-second (~400ms), fees ~$0.00025 — micropayments are practical.
- Treat the **`PAYMENT-RESPONSE`** header as the receipt/settlement id. Key your records by it so a retried request isn't double-counted. Re-requesting within a server's cache TTL is free (no second charge) — don't re-decrement your budget on a cache hit.

## Token-2022 caveat

Canonical USDC is a classic SPL token. If you ever accept a **Token-2022** asset (transfer hooks, transfer fees, confidential transfers), the transfer math and instructions differ and a transfer fee can change the settled amount. x402 USDC settlement uses standard USDC — for anything Token-2022, defer to the kit's `token-2022.md` and verify the net received amount.

## Devnet → mainnet

1. Build and test against devnet: devnet USDC mint, devnet CAIP-2 id, `https://facilitator.x402.org`.
2. Fund a devnet wallet with devnet USDC; run the full pay/receive loop.
3. Switch mint + network id + facilitator URL to mainnet **only** after the devnet loop passes end to end. Keep all three env-driven so the switch is config, not code.

## Checklist

- [ ] Correct USDC mint for the network; pulled from `@x402/svm` or the table above.
- [ ] CAIP-2 network id matches the mint's network.
- [ ] All amounts in atomic units; decimals correct (USDC 6 / SOL 9).
- [ ] Recipient USDC ATA exists (create if needed).
- [ ] Fee strategy chosen (fee-abstracting facilitator, or SOL on hand).
- [ ] Records keyed by `PAYMENT-RESPONSE`; cache hits don't double-count.

# Spending controls — hard, enforced limits for autonomous agents

This is the file the whole skill is built around. An agent that can pay is an agent that can be drained. The controls below are the difference between "the agent spent $3 on data" and "the agent sent the treasury to an attacker's address."

## Threat model (what you're defending against)

| Threat | Without controls | The control that stops it |
|--------|------------------|---------------------------|
| Prompt injection tells the agent to transfer funds out | Full drain | Destination allowlist + on-chain spending limit |
| Tool/loop bug pays the same 402 thousands of times | Drain via fees/payments | Per-tx cap + rolling budget |
| Hallucinated recipient address | Funds to wrong/attacker address | Allowlist (only `payTo`/known addresses) |
| Leaked `SOLANA_PRIVATE_KEY` | Attacker has unlimited authority | Key never has unlimited authority (limit lives on-chain) |
| Compromised dependency signs a tx | Silent theft | On-chain limit caps blast radius; kill switch halts it |

The guiding principle: **a buggy or hijacked agent should be physically incapable of exceeding its budget.** That means enforcement on-chain (Squads v4 / Crossmint), with client-side budgets as a second layer — never the only layer.

## Layer 1 (primary): on-chain spending limit with Squads v4

The agent is a **member** of a Squads vault with a spending limit: it may spend up to `amount` per `period` to an **allowlisted** set of destinations, executed immediately **without a multisig proposal**, and the program rejects anything beyond that. Verified against `@sqds/multisig`.

```bash
npm install @sqds/multisig @solana/web3.js
```

```ts
import * as multisig from "@sqds/multisig";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

const { Period } = multisig.types;
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // 6 decimals

// 1) CREATE a USDC daily limit for the agent (config tx → approve/execute via the multisig).
async function createAgentUsdcLimit(
  connection: Connection,
  feePayer: Keypair,
  multisigPda: PublicKey,
  agentMember: PublicKey,          // the agent's signing pubkey — a *member*, not the owner
  allowedDestinations: PublicKey[],// the ONLY addresses the agent may pay
  dailyUsdc: number
) {
  const multisigInfo = await multisig.accounts.Multisig.fromAccountAddress(connection, multisigPda);
  const transactionIndex = BigInt(Number(multisigInfo.transactionIndex) + 1);

  const createKey = Keypair.generate();
  const [spendingLimitPda] = multisig.getSpendingLimitPda({ multisigPda, createKey: createKey.publicKey });

  await multisig.rpc.configTransactionCreate({
    connection,
    feePayer,
    multisigPda,
    transactionIndex,
    creator: feePayer.publicKey,
    actions: [{
      __kind: "AddSpendingLimit",
      createKey: createKey.publicKey,
      vaultIndex: 0,
      mint: USDC_MINT,
      amount: BigInt(Math.round(dailyUsdc * 1_000_000)), // atomic units: USDC ×10^6
      period: Period.Day,                                 // OneTime | Day | Week | Month
      members: [agentMember],                             // who may use this limit
      destinations: allowedDestinations,                  // allowlist — empty = any (avoid for agents)
    }],
  });
  // NOTE: still needs multisig approval + execution before it is active.
  return { spendingLimitPda, transactionIndex };
}

// 2) USE the limit — executes immediately, no proposal, and CANNOT exceed the cap.
async function agentSpend(
  connection: Connection,
  agent: Keypair,
  multisigPda: PublicKey,
  spendingLimitPda: PublicKey,
  destination: PublicKey,   // must be in the allowlist or the program rejects it
  usdc: number
) {
  return multisig.rpc.spendingLimitUse({
    connection,
    feePayer: agent,
    multisigPda,
    member: agent,
    spendingLimit: spendingLimitPda,
    mint: USDC_MINT,
    vaultIndex: 0,
    amount: BigInt(Math.round(usdc * 1_000_000)),
    decimals: 6,            // USDC = 6 (SOL would be 9)
    destination,
    memo: "agent: x402 settlement",
  });
}
```

Why this is strong: the cap, period, member set, and destination allowlist are **on-chain state in the Squads program**. The agent holds a key that is *only* a member with a bounded limit — not an owner. A drained-wallet outcome is impossible without a separate multisig action.

## Layer 2 (defense in depth): client-side budget guard

Even with an on-chain limit, bound spend **inside the run** so the agent fails fast and loud instead of grinding against the on-chain cap. Reuse the budgeted x402 client from [pay-x402-client.md](pay-x402-client.md):

```ts
const ledger = { sessionUsd: 0 };
const SESSION_CAP_USD = 2.00;     // this run may spend at most $2
const PER_CALL_CAP_USD = 0.10;    // no single call over $0.10

function assertWithinBudget(priceUsd: number) {
  if (priceUsd > PER_CALL_CAP_USD)
    throw new Error(`blocked: $${priceUsd} > per-call cap $${PER_CALL_CAP_USD}`);
  if (ledger.sessionUsd + priceUsd > SESSION_CAP_USD)
    throw new Error(`blocked: session cap $${SESSION_CAP_USD} reached`);
  ledger.sessionUsd += priceUsd;
}
```

## Destination allowlist

x402 is comparatively safe because the agent pays the **facilitator-validated `payTo`** from the server's `PAYMENT-REQUIRED` header — not an address the model chose. The dangerous path is *arbitrary* transfers. Enforce an allowlist everywhere a freeform destination is possible:

```ts
const ALLOWED = new Set<string>([
  /* known counterparties + your own ATAs, base58 */
]);
function assertAllowedDestination(addr: string) {
  if (!ALLOWED.has(addr)) throw new Error(`blocked: ${addr} not in destination allowlist`);
}
```

On Squads, the allowlist is the `destinations` array on the spending limit — enforced on-chain, which is strictly stronger than this client check. Use both.

## Kill switch

Every autonomous spender needs a one-action stop:

- **Squads:** remove the spending limit (`RemoveSpendingLimit` config action) or pause the member — on-chain, immediate, un-bypassable.
- **Off-chain providers (Privy/Turnkey/CDP):** disable the policy / revoke the session key.
- **App-level (last resort, not sufficient alone):** a `PAYMENTS_ENABLED=false` flag the payment wrapper checks before every call.

```ts
if (process.env.PAYMENTS_ENABLED === "false")
  throw new Error("kill switch active — all agent spend halted");
```

## Audit trail

Persist a record for every settlement — non-negotiable for reconciliation and incident response:

```ts
function recordReceipt(entry: {
  url: string; amountUsd: number; paymentResponse: string; ts: number;
}) {
  // append-only store: DB row, log line, or file. The PAYMENT-RESPONSE header is the receipt.
}
```

## Atomic units (the bug that costs real money)

USDC has **6 decimals**. `1 USDC = 1_000_000` atomic units. SOL has **9**. Always convert at the boundary and keep internal math in atomic units. A decimals mistake is a 10^3–10^6× overpay. See [usdc-settlement.md](usdc-settlement.md).

## Checklist (this is what [/audit-agent-spending](../commands/audit-agent-spending.md) enforces)

- [ ] No key with unlimited authority on mainnet. Funds behind an on-chain limit or policy-gated signer.
- [ ] Per-transaction cap **and** rolling budget, both enforced (not just logged).
- [ ] Destination allowlist on every freeform-transfer path (on-chain where possible).
- [ ] Kill switch that halts all spend in one action.
- [ ] Receipts persisted for every settlement.
- [ ] Amounts in atomic units; decimals correct (USDC 6 / SOL 9).
- [ ] Devnet-tested before mainnet.

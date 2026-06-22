---
description: Audit an agent's payment/wallet code for drain risks — god-mode keys, missing caps, unbounded loops, hallucinated destinations, decimals bugs, leaked secrets, no kill switch/audit trail.
argument-hint: [optional: path to audit — defaults to the repo]
---

Audit the agent's money path in: **$ARGUMENTS** (default: whole repo)

Run the `payment-safety-auditor` agent. It is read-only and adversarial: assume the agent will be prompt-injected, will loop, and will hallucinate a recipient.

Procedure:

1. Read `skill/spending-controls.md` for the checklist and threat model.
2. Grep for the danger signals: `PRIVATE_KEY`, `Keypair.fromSecretKey`, `KeypairWallet`, `wrapFetchWithPayment`, `paymentMiddleware`, `transfer(`, `spendingLimit`, hardcoded mint/secret strings, wallet `*.json`.
3. For each spend path, trace key source → amount bound → destination bound → loop bound → kill switch → receipt.
4. Report findings by severity (CRITICAL / HIGH / MEDIUM / LOW): file:line, the concrete exploit (how a drain happens), and the specific fix from `skill/spending-controls.md`.
5. End with **verdict: SAFE FOR MAINNET / NOT SAFE** — `NOT SAFE` if any CRITICAL or HIGH remains.

Do not modify code. Hand fixes to `agent-payments-engineer`.

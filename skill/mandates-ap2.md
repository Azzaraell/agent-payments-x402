# Authorize — AP2 mandates (is this agent allowed to spend?)

x402 answers *how* value moves. It does **not** answer *whether this agent was authorized to spend a particular user's money*. When an agent spends **its own** budget, x402 + spending controls are enough. When an agent spends **a user's** money, you need an authorization layer. That layer in 2026 is **AP2**.

> Reach for this file when the agent acts on behalf of a human/principal (an assistant buying on your behalf, a procurement agent), or when you need a verifiable, auditable "the user approved this" trail. For an agent spending its own treasury, skip to [spending-controls.md](spending-controls.md).

## What AP2 is

**Agent Payments Protocol (AP2)** — an open standard announced by Google (Sept 16, 2025) with 60+ launch partners (Mastercard, PayPal, Coinbase, American Express, Salesforce). It defines how an AI agent proves it has authority to make a payment on a user's behalf, in a way the payment network can verify and audit. AP2 is **payment-method-agnostic**: cards, bank transfers, and — via its crypto extension — stablecoins.

## Mandates: the core primitive

AP2 expresses authorization as **mandates** — verifiable credentials capturing user intent:

- **Intent mandate** — the user's delegated authority and constraints ("you may spend up to $50 on flights under these conditions"). Enables un-attended ("human-not-present") purchases within bounds.
- **Cart mandate** — authorization of a *specific* transaction (this cart, this amount, this merchant) for human-present approval.

A mandate is cryptographically signed evidence that answers, non-repudiably, "did the user authorize this, and within what limits?" That evidence is what gives agent payments a real audit trail.

## How AP2 and x402 fit together (not competitors)

- **AP2** = the authorization / mandate layer (intent + approval + audit).
- **x402** = the stablecoin **settlement** extension of AP2. The **A2A x402 extension** lets an AP2 mandate carry into x402 settlement, so a crypto payment inherits the same audit trail a card payment gets under AP2. x402 is positioned as AP2's stablecoin facilitator.

```
User intent ──▶ AP2 Intent Mandate (signed authority + limits)
                    │
        agent acts within mandate
                    ▼
            AP2 Cart Mandate (this specific spend)
                    │  carried via A2A x402 extension
                    ▼
            x402 settlement on Solana (USDC)  ──▶ PAYMENT-RESPONSE receipt
```

Practical stance for this skill:
- **Most agent-payment work today is x402-only** — the agent spends its own wallet for data/compute/agent-to-agent calls. Use [pay-x402-client.md](pay-x402-client.md) + [spending-controls.md](spending-controls.md).
- **Add AP2 mandates when the agent spends a principal's money** or when you need verifiable user consent for compliance/audit. Keep the mandate as the gate *before* the x402 payment fires.

## Verify-then-pay (the pattern to internalize)

Emerging agentic-commerce research (e.g. TessPay, A402) converges on one idea: **bind the payment to verified authorization and to service execution** — don't pay until (a) the mandate authorizes it and (b) you can confirm the service will be/was delivered. Concretely, for an agent:

1. Check the mandate authorizes this spend (amount, merchant, conditions).
2. Confirm the counterparty/quote (the `PAYMENT-REQUIRED` terms) matches the mandate.
3. Only then release the x402 payment, within the [spending-controls.md](spending-controls.md) budget.
4. Persist mandate + receipt together for the audit trail.

## When you do *not* need AP2

- The agent spends its own operating budget (your treasury), not a third party's money.
- There is no external principal whose consent must be proven.

In those cases AP2 is overhead — enforced spending controls are the right and sufficient guarantee. Adopt AP2 deliberately, when authorization (not just limits) is the actual requirement.

See [resources.md](resources.md) for the AP2 announcement, the A2A x402 extension, and the verify-then-pay papers.

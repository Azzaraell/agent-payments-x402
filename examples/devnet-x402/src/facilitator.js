import { randomUUID } from "node:crypto";

/**
 * MOCK facilitator — offline demo only. It does NOT touch Solana and settles
 * nothing on-chain. In production the server delegates verify+settle to a real
 * facilitator (https://facilitator.x402.org testnet, Coinbase CDP / PayAI prod,
 * or self-hosted Kora) via @x402/core's HTTPFacilitatorClient — see README.
 *
 * It models the two guarantees a real facilitator gives: (1) a payment satisfies
 * its requirement, and (2) the same payment can't settle twice (the real
 * ExactSvmFacilitator keeps a ~120s settlement cache).
 */
export class MockFacilitator {
  constructor() {
    /** @type {Set<string>} payment ids already settled */
    this.settled = new Set();
  }

  /**
   * @returns {{ok: true, receipt: string} | {ok: false, reason: string}}
   */
  settle(payment, requirement) {
    if (payment.network !== requirement.network) return { ok: false, reason: "network mismatch" };
    if (payment.asset !== requirement.asset) return { ok: false, reason: "asset mismatch" };
    if (payment.payTo !== requirement.payTo) return { ok: false, reason: "payTo mismatch" };
    if (BigInt(payment.amount) < BigInt(requirement.maxAmountRequired))
      return { ok: false, reason: "underpaid" };
    if (this.settled.has(payment.id))
      return { ok: false, reason: "replay: payment already settled" };

    this.settled.add(payment.id);
    return { ok: true, receipt: `mock-receipt:${randomUUID()}` };
  }
}

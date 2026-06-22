import { atomicToUsd } from "./usdc.js";

const fmt = (atomic) => `$${atomicToUsd(atomic).toFixed(6)}`;

export class KillSwitchError extends Error {}
export class CapExceededError extends Error {}

/**
 * Enforced spending controls for an autonomous payer. Every limit is checked
 * BEFORE funds move and throws on violation — enforced, not merely logged. This
 * is the layer raw x402 wrappers omit. Code mirror of ../../skill/spending-controls.md.
 *
 * Split by design: authorize() pre-checks and throws; settle() records a cleared
 * payment keyed by its receipt, so a retried or replayed request can't double-count.
 *
 * @typedef {Object} SpendGuardConfig
 * @property {bigint} perTxCap    max atomic USDC for any single payment
 * @property {bigint} sessionCap  max atomic USDC across this guard's lifetime
 * @property {Set<string>} [allowlist]  permitted payTo addresses (omit = allow any; devnet only)
 */
export class SpendGuard {
  /** @param {SpendGuardConfig} config */
  constructor({ perTxCap, sessionCap, allowlist } = {}) {
    if (typeof perTxCap !== "bigint" || typeof sessionCap !== "bigint")
      throw new Error("perTxCap and sessionCap must be bigint atomic-USDC amounts");
    if (perTxCap <= 0n || sessionCap <= 0n) throw new Error("caps must be positive");
    if (perTxCap > sessionCap) throw new Error("perTxCap cannot exceed sessionCap");
    this.perTxCap = perTxCap;
    this.sessionCap = sessionCap;
    this.allowlist = allowlist ?? null;
    this.spent = 0n;
    this.killed = false;
    /** @type {Map<string, {payTo: string, amount: bigint}>} keyed by receipt id (idempotency + audit) */
    this.receipts = new Map();
  }

  /** Halt all spend in one action. */
  kill() {
    this.killed = true;
  }

  get remaining() {
    return this.sessionCap - this.spent;
  }

  /** Throw unless a payment of `amount` (atomic USDC) to `payTo` is allowed right now. */
  authorize(amount, payTo) {
    if (this.killed) throw new KillSwitchError("kill switch engaged — all spend halted");
    if (typeof amount !== "bigint" || amount <= 0n)
      throw new CapExceededError(`invalid payment amount: ${amount}`);
    if (amount > this.perTxCap)
      throw new CapExceededError(`payment ${fmt(amount)} exceeds per-tx cap ${fmt(this.perTxCap)}`);
    if (this.spent + amount > this.sessionCap)
      throw new CapExceededError(
        `payment ${fmt(amount)} would exceed session budget (remaining ${fmt(this.remaining)})`,
      );
    if (this.allowlist && !this.allowlist.has(payTo))
      throw new CapExceededError(`payTo ${payTo} is not on the allowlist`);
  }

  /**
   * Record a settled payment by its receipt id. Idempotent: a repeated receipt
   * (e.g. a retried request) does not decrement the budget twice.
   * @returns {boolean} true if newly recorded, false if it was a replay
   */
  settle(amount, payTo, receipt) {
    if (this.receipts.has(receipt)) return false;
    this.spent += amount;
    this.receipts.set(receipt, { payTo, amount });
    return true;
  }
}

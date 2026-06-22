// USDC is a 6-decimal SPL token. All money math is in atomic units (bigint);
// floats only appear at display boundaries. A decimals slip here is a 1,000,000x error.
// Constants verified against ../../skill/usdc-settlement.md and @x402/svm@2.16.

export const USDC_DECIMALS = 6;
const ATOMIC_PER_USDC = 1_000_000n;

/** USDC mint per network (classic SPL USDC). */
export const USDC_MINT = {
  "solana-mainnet": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "solana-devnet": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
};

/** x402 v2 network ids are CAIP-2 (verified against @x402/svm@2.16). */
export const NETWORK = {
  "solana-mainnet": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  "solana-devnet": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
};

/**
 * Parse a price string like "$0.001" to atomic USDC (bigint) — exactly, with no
 * float, capped at 6 fractional digits (USDC's precision). Throws on anything finer.
 * @param {string} price
 * @returns {bigint}
 */
export function priceToAtomic(price) {
  const m = /^\$?(\d+)(?:\.(\d{1,6}))?$/.exec(String(price).trim());
  if (!m) throw new Error(`unparseable USDC price: "${price}" (use e.g. "$0.001")`);
  const whole = BigInt(m[1]);
  const frac = (m[2] ?? "").padEnd(USDC_DECIMALS, "0");
  return whole * ATOMIC_PER_USDC + BigInt(frac);
}

/** atomic USDC (bigint) -> USD number, for display/logging only. */
export function atomicToUsd(atomic) {
  return Number(atomic) / Number(ATOMIC_PER_USDC);
}

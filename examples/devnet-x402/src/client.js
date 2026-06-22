// Verified x402 v2 wire headers (@x402/core@2.16) — each carries a base64 payload.
const H = { required: "payment-required", signature: "payment-signature", response: "payment-response" };
const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64");
const dec = (b64) => JSON.parse(Buffer.from(String(b64), "base64").toString());

/**
 * Pay for an x402 resource, guarded by a SpendGuard. Models what @x402/fetch's
 * `wrapFetchWithPayment` does, plus the budget ceiling raw wrappers omit:
 *   GET -> 402 + PAYMENT-REQUIRED -> authorize -> pay -> retry + PAYMENT-SIGNATURE -> 200 + PAYMENT-RESPONSE -> settle.
 *
 * @param {string} url
 * @param {import("./spend-guard.js").SpendGuard} guard
 * @param {(requirement: object) => object} signPayment  builds a signed payment for a requirement
 *        (mock here; @x402/svm `toClientSvmSigner` over a @solana/kit signer in production)
 * @returns {Promise<object>} the resource body
 */
export async function payForResource(url, guard, signPayment) {
  const challenge = await fetch(url);
  if (challenge.status !== 402) {
    if (challenge.ok) return challenge.json(); // free or cached — nothing to pay
    throw new Error(`unexpected ${challenge.status}: ${await challenge.text()}`);
  }

  const required = challenge.headers.get(H.required);
  if (!required) throw new Error("402 response carried no PAYMENT-REQUIRED header");
  const requirement = dec(required);

  const amount = BigInt(requirement.maxAmountRequired);
  guard.authorize(amount, requirement.payTo); // throws BEFORE paying on any violation

  const paid = await fetch(url, { headers: { [H.signature]: enc(signPayment(requirement)) } });
  if (!paid.ok) {
    const body = await paid.json().catch(() => ({}));
    throw new Error(`payment rejected (${paid.status}): ${body.error ?? "unknown"}`);
  }

  const receipt = paid.headers.get(H.response);
  if (!receipt) throw new Error("settled 200 but no PAYMENT-RESPONSE receipt to persist");
  guard.settle(amount, requirement.payTo, receipt); // the receipt header is the idempotency key
  return paid.json();
}

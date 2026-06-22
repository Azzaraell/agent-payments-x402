import { createServer } from "node:http";
import { NETWORK, USDC_MINT, priceToAtomic } from "./usdc.js";
import { MockFacilitator } from "./facilitator.js";

// Verified x402 v2 wire headers (@x402/core@2.16) — each carries a base64 payload.
const H = { required: "payment-required", signature: "payment-signature", response: "payment-response" };
const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64");
const dec = (b64) => {
  try {
    return JSON.parse(Buffer.from(String(b64), "base64").toString());
  } catch {
    return null;
  }
};

/**
 * A paywalled resource server modeling the x402 v2 flow with one USDC-priced route.
 * Production equivalent: Express + @x402/express `paymentMiddleware` delegating to a
 * real facilitator — see README "Going to real devnet". node:http keeps this demo
 * zero-install and runnable offline.
 *
 * @param {{net?: "solana-mainnet"|"solana-devnet", payTo: string, price: string, facilitator?: MockFacilitator}} opts
 */
export function createPaywallServer({ net = "solana-devnet", payTo, price, facilitator = new MockFacilitator() } = {}) {
  if (!payTo) throw new Error("payTo (your Solana receiving address) is required");
  if (!NETWORK[net]) throw new Error(`unknown network: ${net}`);

  // The x402 "payment requirement" the server advertises in a 402 challenge.
  const requirement = {
    scheme: "exact",
    network: NETWORK[net],
    asset: USDC_MINT[net],
    payTo,
    maxAmountRequired: priceToAtomic(price).toString(), // atomic USDC as a string (x402 JSON)
    resource: "/premium/quote",
    description: "SOL-USDC quote",
  };

  return createServer((req, res) => {
    if ((req.url ?? "").split("?")[0] !== requirement.resource) {
      return send(res, 404, {}, { error: "not found" });
    }

    const signature = req.headers[H.signature];
    if (!signature) {
      // x402 challenge: 402 + the requirements, base64 in the PAYMENT-REQUIRED header.
      return send(res, 402, { [H.required]: enc(requirement) }, { error: "payment required" });
    }

    const payment = dec(Array.isArray(signature) ? signature[0] : signature);
    if (!payment) return send(res, 400, {}, { error: "malformed PAYMENT-SIGNATURE header" });

    const result = facilitator.settle(payment, requirement);
    if (!result.ok) return send(res, 402, { [H.required]: enc(requirement) }, { error: result.reason });

    // Paid + settled: serve the resource, attach the receipt for the client's audit trail.
    return send(res, 200, { [H.response]: enc({ receipt: result.receipt }) }, { pair: "SOL-USDC", price: 142.31 });
  });
}

function send(res, status, headers, body) {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

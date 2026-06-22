import { randomUUID } from "node:crypto";
import { createPaywallServer } from "./src/server.js";
import { SpendGuard } from "./src/spend-guard.js";
import { payForResource } from "./src/client.js";
import { NETWORK, USDC_MINT, priceToAtomic, atomicToUsd } from "./src/usdc.js";

const usd = (atomic) => `$${atomicToUsd(atomic).toFixed(6)}`;

const NET = "solana-devnet";
const PAYTO = process.env.PAYTO_SOLANA_ADDRESS ?? "DemoPayTo1111111111111111111111111111111111";
const PRICE = "$0.001";

// Mock signer. In production this is @x402/svm `toClientSvmSigner(...)` over a
// @solana/kit KeyPairSigner — never a raw key (see ../../skill/spending-controls.md).
const signPayment = (req) => ({
  id: randomUUID(),
  scheme: req.scheme,
  network: req.network,
  asset: req.asset,
  payTo: req.payTo,
  amount: req.maxAmountRequired,
});

const server = createPaywallServer({ net: NET, payTo: PAYTO, price: PRICE });
await new Promise((resolve) => server.listen(0, resolve));
const url = `http://127.0.0.1:${server.address().port}/premium/quote`;

const guard = new SpendGuard({
  perTxCap: priceToAtomic("$0.01"),
  sessionCap: priceToAtomic("$0.05"),
  allowlist: new Set([PAYTO]),
});

console.log(`x402 paywall on ${url}`);
console.log(`  network  ${NET} = ${NETWORK[NET]}`);
console.log(`  USDC     ${USDC_MINT[NET]}`);
console.log(`  budget   per-tx ${usd(guard.perTxCap)} | session ${usd(guard.sessionCap)}\n`);

for (let i = 1; i <= 3; i++) {
  const data = await payForResource(url, guard, signPayment);
  console.log(`call ${i}  paid ${PRICE}  ->  ${JSON.stringify(data)}`);
  console.log(`        spent ${usd(guard.spent)} | remaining ${usd(guard.remaining)} | receipts ${guard.receipts.size}`);
}

// Trip a control on purpose: the kill switch halts everything.
guard.kill();
try {
  await payForResource(url, guard, signPayment);
} catch (err) {
  console.log(`\ncall 4  blocked  ->  ${err.constructor.name}: ${err.message}`);
}

server.close();

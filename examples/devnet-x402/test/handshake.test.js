import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createPaywallServer } from "../src/server.js";
import { SpendGuard } from "../src/spend-guard.js";
import { payForResource } from "../src/client.js";
import { NETWORK, USDC_MINT, priceToAtomic } from "../src/usdc.js";

const PAYTO = "TestPayTo11111111111111111111111111111111111";
const PRICE = "$0.001";

async function boot() {
  const server = createPaywallServer({ net: "solana-devnet", payTo: PAYTO, price: PRICE });
  await new Promise((resolve) => server.listen(0, resolve));
  const url = `http://127.0.0.1:${server.address().port}/premium/quote`;
  return { server, url };
}

const sign = (req) => ({
  id: randomUUID(),
  scheme: req.scheme,
  network: req.network,
  asset: req.asset,
  payTo: req.payTo,
  amount: req.maxAmountRequired,
});

const guard = () =>
  new SpendGuard({
    perTxCap: priceToAtomic("$0.01"),
    sessionCap: priceToAtomic("$0.05"),
    allowlist: new Set([PAYTO]),
  });

test("unpaid request returns 402 with x402 payment requirements", async () => {
  const { server, url } = await boot();
  const res = await fetch(url);
  assert.equal(res.status, 402);
  const required = res.headers.get("payment-required");
  assert.ok(required, "PAYMENT-REQUIRED header present");
  const req = JSON.parse(Buffer.from(required, "base64").toString());
  assert.equal(req.scheme, "exact");
  assert.equal(req.network, NETWORK["solana-devnet"]);
  assert.equal(req.asset, USDC_MINT["solana-devnet"]);
  assert.equal(req.payTo, PAYTO);
  assert.equal(req.maxAmountRequired, priceToAtomic(PRICE).toString());
  server.close();
});

test("paid request settles and returns 200 with a PAYMENT-RESPONSE receipt", async () => {
  const { server, url } = await boot();
  const g = guard();
  const data = await payForResource(url, g, sign);
  assert.equal(data.pair, "SOL-USDC");
  assert.equal(g.spent, priceToAtomic(PRICE));
  assert.equal(g.receipts.size, 1);
  server.close();
});

test("a payment over the per-tx cap is blocked before any settle", async () => {
  const { server, url } = await boot();
  const tiny = new SpendGuard({
    perTxCap: priceToAtomic("$0.0005"),
    sessionCap: priceToAtomic("$0.05"),
    allowlist: new Set([PAYTO]),
  });
  await assert.rejects(payForResource(url, tiny, sign), /per-tx cap/);
  assert.equal(tiny.spent, 0n); // never paid
  server.close();
});

test("a replayed payment cannot settle twice (facilitator dedupe)", async () => {
  const { server, url } = await boot();
  const g = guard();
  const fixedId = randomUUID();
  const replaySign = (req) => ({ ...sign(req), id: fixedId });
  await payForResource(url, g, replaySign); // first settles
  await assert.rejects(payForResource(url, g, replaySign), /rejected/); // replay refused
  assert.equal(g.receipts.size, 1);
  server.close();
});

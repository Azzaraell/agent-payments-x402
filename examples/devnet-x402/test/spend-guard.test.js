import { test } from "node:test";
import assert from "node:assert/strict";
import { SpendGuard, CapExceededError, KillSwitchError } from "../src/spend-guard.js";
import { priceToAtomic } from "../src/usdc.js";

const cfg = () => ({ perTxCap: priceToAtomic("$0.01"), sessionCap: priceToAtomic("$0.05") });

test("authorize accepts a payment within both caps", () => {
  const g = new SpendGuard(cfg());
  assert.doesNotThrow(() => g.authorize(priceToAtomic("$0.001"), "payTo"));
});

test("authorize rejects a payment over the per-tx cap", () => {
  const g = new SpendGuard(cfg());
  assert.throws(() => g.authorize(priceToAtomic("$0.02"), "payTo"), CapExceededError);
});

test("authorize rejects when the session budget would be exceeded", () => {
  const g = new SpendGuard({ perTxCap: priceToAtomic("$0.01"), sessionCap: priceToAtomic("$0.015") });
  g.settle(priceToAtomic("$0.01"), "p", "r1");
  assert.throws(() => g.authorize(priceToAtomic("$0.01"), "p"), CapExceededError);
});

test("authorize enforces the destination allowlist", () => {
  const g = new SpendGuard({ ...cfg(), allowlist: new Set(["good"]) });
  assert.doesNotThrow(() => g.authorize(priceToAtomic("$0.001"), "good"));
  assert.throws(() => g.authorize(priceToAtomic("$0.001"), "evil"), CapExceededError);
});

test("kill switch halts all spend", () => {
  const g = new SpendGuard(cfg());
  g.kill();
  assert.throws(() => g.authorize(priceToAtomic("$0.001"), "p"), KillSwitchError);
});

test("settle is idempotent per receipt", () => {
  const g = new SpendGuard(cfg());
  const amt = priceToAtomic("$0.001");
  assert.equal(g.settle(amt, "p", "receipt-1"), true);
  assert.equal(g.settle(amt, "p", "receipt-1"), false); // replay ignored
  assert.equal(g.spent, amt); // counted once
});

test("remaining reflects settled spend", () => {
  const g = new SpendGuard(cfg());
  g.settle(priceToAtomic("$0.02"), "p", "r");
  assert.equal(g.remaining, priceToAtomic("$0.03"));
});

test("rejects a perTxCap larger than the sessionCap", () => {
  assert.throws(
    () => new SpendGuard({ perTxCap: priceToAtomic("$1"), sessionCap: priceToAtomic("$0.5") }),
  );
});

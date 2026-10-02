const assert = require('node:assert/strict');
const test = require('node:test');
const {
  MAX_RIG_SLOTS,
  MAX_HASHRATE_TH_S,
  SUPPORTED_POOLS,
  clampHashrate,
  createRigSlots,
  createNonCustodialState,
  createClaimReview,
} = require('../dist');

test('creates exactly ten bounded rig slots', () => {
  const slots = createRigSlots();
  assert.equal(slots.length, MAX_RIG_SLOTS);
  assert.equal(slots[0].targetHashrateTHs, 0);
  assert.equal(slots[9].workerName, 'rig-10');
  assert.equal(clampHashrate(-3), 0);
  assert.equal(clampHashrate(MAX_HASHRATE_TH_S + 1), MAX_HASHRATE_TH_S);
});

test('pool catalog requires the user wallet and authorization', () => {
  assert.deepEqual(SUPPORTED_POOLS.map((pool) => pool.id), ['braiins-pool', 'btc-com', 'binance-pool']);
  assert.ok(SUPPORTED_POOLS.every((pool) => pool.requiresUserWallet && pool.requiresUserAuthorization));
});

test('collect all creates a review intent and never a transfer', () => {
  const state = createNonCustodialState({ walletAddress: 'bc1qexample', availableProfit: 12.5 });
  const review = createClaimReview(state);
  assert.equal(review.kind, 'claim-review');
  assert.equal(review.amount, 12.5);
  assert.equal(review.custodialTransfer, false);
  assert.equal(review.requiresUserConfirmation, true);
});

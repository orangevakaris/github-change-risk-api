import assert from "node:assert/strict";
import test from "node:test";
import { BASE_USDC, MINIMUM_USDC, PAY_TO, createPaymentVerifier, paymentInstructions } from "../src/payments.js";

const HASH = "0x" + "a".repeat(64);
const recipientTopic = "0x" + "0".repeat(24) + PAY_TO.slice(2);

function rpc(method) {
  if (method === "eth_blockNumber") return Promise.resolve("0x11");
  return Promise.resolve({
    status: "0x1",
    blockNumber: "0xf",
    logs: [{
      address: BASE_USDC,
      topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "0x", recipientTopic],
      data: `0x${MINIMUM_USDC.toString(16)}`,
    }],
  });
}

test("reserves and permanently consumes a valid USDC payment once", async () => {
  let saved = [];
  const verifier = createPaymentVerifier({ rpc, consumed: [], persist: (transactions) => { saved = transactions; } });
  const reservation = await verifier.reserve(HASH);
  assert.deepEqual(reservation, { status: "reserved", hash: HASH });
  verifier.consume(HASH);
  assert.deepEqual(saved, [HASH]);
  assert.deepEqual(await verifier.reserve(HASH), { status: "used" });
});

test("rejects payment logs below the minimum amount", async () => {
  const verifier = createPaymentVerifier({
    rpc: async (method) => method === "eth_blockNumber" ? "0x11" : ({
      status: "0x1", blockNumber: "0xf", logs: [{ address: BASE_USDC, topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "0x", recipientTopic], data: "0x1" }],
    }),
    consumed: [],
    persist: () => {},
  });
  assert.deepEqual(await verifier.reserve(HASH), { status: "unverified" });
});

test("publishes an exact Base-USDC payment link", () => {
  assert.equal(
    paymentInstructions().paymentLink,
    `ethereum:${BASE_USDC}@8453/transfer?address=${PAY_TO}&uint256=${MINIMUM_USDC}`,
  );
});

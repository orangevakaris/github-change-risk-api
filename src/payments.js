export const BASE_USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
export const PAY_TO = "0x5157e1783c81da37daa8bb490c68b30ab0e9d3a7";
export const MINIMUM_USDC = 10_000;
export const MINIMUM_ETH_WEI = 10_000_000_000_000n;
export const PAYMENT_NETWORK = "Base mainnet";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const TRANSACTION_HASH = /^0x[a-fA-F0-9]{64}$/;

export function paymentInstructions() {
  return {
    network: PAYMENT_NETWORK,
    chainId: 8453,
    asset: "native USDC",
    assetContract: BASE_USDC,
    payTo: PAY_TO,
    minimumAmount: "0.01 USDC",
    minimumBaseUnits: MINIMUM_USDC,
    confirmationsRequired: 3,
    onePaymentPerFullReport: true,
    paymentLink: `ethereum:${BASE_USDC}@8453/transfer?address=${PAY_TO}&uint256=${MINIMUM_USDC}`,
    nativeEth: {
      asset: "native ETH",
      minimumAmount: "0.00001 ETH",
      minimumWei: MINIMUM_ETH_WEI.toString(),
      paymentLink: `ethereum:${PAY_TO}@8453?value=1e13`,
    },
  };
}

function validUsdcTransfer(receipt) {
  const recipientTopic = "0x" + "0".repeat(24) + PAY_TO.slice(2);
  return (receipt.logs || []).some((log) => {
    const topics = (log.topics || []).map((topic) => String(topic).toLowerCase());
    if (
      String(log.address || "").toLowerCase() !== BASE_USDC
      || topics.length < 3
      || topics[0] !== TRANSFER_TOPIC
      || topics[2] !== recipientTopic
    ) {
      return false;
    }
    try {
      return BigInt(String(log.data || "0x0")) >= BigInt(MINIMUM_USDC);
    } catch {
      return false;
    }
  });
}

function validNativeEthTransfer(transaction) {
  if (String(transaction?.to || "").toLowerCase() !== PAY_TO) return false;
  try {
    return BigInt(String(transaction.value || "0x0")) >= MINIMUM_ETH_WEI;
  } catch {
    return false;
  }
}

export function createPaymentVerifier({ rpc, consumed, persist }) {
  const used = new Set(consumed.map((hash) => hash.toLowerCase()));
  const pending = new Set();

  async function reserve(transactionHash) {
    const hash = String(transactionHash || "").toLowerCase();
    if (!TRANSACTION_HASH.test(hash)) return { status: "malformed" };
    if (used.has(hash)) return { status: "used" };
    if (pending.has(hash)) return { status: "pending" };
    const receipt = await rpc("eth_getTransactionReceipt", [hash]);
    if (!receipt || receipt.status !== "0x1") return { status: "unverified" };
    if (!validUsdcTransfer(receipt)) {
      const transaction = await rpc("eth_getTransactionByHash", [hash]);
      if (!validNativeEthTransfer(transaction)) return { status: "unverified" };
    }
    const latestBlock = BigInt(await rpc("eth_blockNumber", []));
    const receiptBlock = BigInt(String(receipt.blockNumber));
    if (latestBlock - receiptBlock + 1n < 3n) return { status: "unconfirmed" };
    pending.add(hash);
    return { status: "reserved", hash };
  }

  function release(hash) {
    pending.delete(hash);
  }

  function consume(hash) {
    pending.delete(hash);
    used.add(hash);
    persist([...used].sort());
  }

  return { reserve, release, consume };
}

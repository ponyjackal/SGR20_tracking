import { ethers } from "ethers";
import "dotenv/config";

import { decodeEvent, decodeTransaction } from "./utils";

const TOKEN_ADDRESS = "0x43C3EBaFdF32909aC60E80ee34aE46637E743d65"; // SRG20 token address
const START_BLOCK = 0; // Start block for historical data retrieval

async function getHistoricalData(startBlock: number, endBlock: number) {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const latestBlockNumber = await provider.getBlockNumber();
  const historicalData: any[] = [];

  for (let blockNumber = startBlock; blockNumber <= endBlock; blockNumber++) {
    const block = await provider.getBlock(blockNumber);
    if (!block) continue;

    const timestamp = block.timestamp;
    // loop transactions
    for (const tx of block.transactions) {
      const transaction = await provider.getTransaction(tx);
      if (!transaction) continue;
      ethers.TransactionResponse;
      // parse transaction
      const transactionDescription = decodeTransaction(transaction.data);
      // check if its buy event
      if (transactionDescription?.fragment.name === "_buy") {
        // parse logs
        const receipt = await provider.getTransactionReceipt(transaction.hash);
        const logs = receipt?.logs;
        if (!logs) continue;

        for (const log of logs) {
          const logDescriptor = decodeEvent(log.topics as string[], log.data);
          // check bought event
          if (logDescriptor?.fragment.name === "Bought") {
          }
        }
      }
    }

    // historicalData.push({
    //   timestamp,
    //   price,
    //   volume: volume.toString(),
    //   liquidity: liquidity.toString(),
    // });
  }

  return historicalData;
}

(async () => {
  try {
    const historicalData = await getHistoricalData(29443557, 30701582);
    console.log(historicalData);
  } catch (error) {
    console.error("Error:", error);
  }
})();

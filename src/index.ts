import { ethers } from "ethers";
import BigNumber from "bignumber.js";
import "dotenv/config";

import { decodeEvent, decodeTransaction } from "./utils";

const TOKEN_ADDRESS = "0x43C3EBaFdF32909aC60E80ee34aE46637E743d65"; // SRG20 token address
const START_BLOCK = 0; // Start block for historical data retrieval
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

async function processTransaction(txHash: string) {
  const transaction = await provider.getTransaction(txHash);
  if (!transaction) return new BigNumber(0);

  const transactionDescription = decodeTransaction(transaction.data);
  if (
    transactionDescription?.fragment.name !== "_buy" &&
    transactionDescription?.fragment.name !== "_sell"
  )
    return new BigNumber(0);

  const receipt = await provider.getTransactionReceipt(transaction.hash);
  if (!receipt || !receipt.logs) return new BigNumber(0);

  const volume = receipt.logs.reduce((acc, log) => {
    const logDescriptor = decodeEvent(log.topics as string[], log.data);
    if (
      logDescriptor?.fragment.name === "Bought" ||
      logDescriptor?.fragment.name === "Sold"
    ) {
      const buyAmount = new BigNumber(logDescriptor.args[3]);
      return acc.plus(buyAmount);
    }
    return acc;
  }, new BigNumber(0));

  return volume;
}

async function getHistoricalData(startBlock: number, endBlock: number) {
  const latestBlockNumber = await provider.getBlockNumber();
  const historicalData: any[] = [];

  const blockPromises = [];
  for (let blockNumber = startBlock; blockNumber <= endBlock; blockNumber++) {
    blockPromises.push(provider.getBlock(blockNumber));
  }

  const blocks = await Promise.all(blockPromises);

  const transactionPromises = blocks.flatMap((block) => {
    return block?.transactions.map((tx) => processTransaction(tx));
  });

  const transactionVolumes = await Promise.all(transactionPromises);

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (!block) continue;

    const volume = transactionVolumes
      .slice(i * block.transactions.length, (i + 1) * block.transactions.length)
      .reduce((acc, vol) => {
        if (!acc) {
          acc = new BigNumber(0);
        }
        if (!vol) {
          vol = new BigNumber(0);
        }

        return acc.plus(vol);
      }, new BigNumber(0));

    historicalData.push({
      timestamp: block.timestamp,
      volume: volume?.toString(),
    });
  }

  return historicalData;
}

(async () => {
  try {
    const historicalData = await getHistoricalData(28809408, 28809409);
    console.log(historicalData);
  } catch (error) {
    console.error("Error:", error);
  }
})();

import { ethers } from "ethers";
import BigNumber from "bignumber.js";
import "dotenv/config";
import { decodeEvent, decodeTransaction } from "./utils";
import abi from "./abi/SGR20.json";

const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS as string; // SRG20 token address
const RPC_URL = process.env.RPC_URL as string;
const START_BLOCK = 0; // Start block for historical data retrieval
const provider = new ethers.JsonRpcProvider(RPC_URL);
// Create a contract instance
const contract = new ethers.Contract(TOKEN_ADDRESS, abi, provider);

async function processTransactionVolume(txHash: string) {
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

async function processTransactionLiquidity(txHash: string) {
  const transaction = await provider.getTransaction(txHash);
  if (!transaction) return new BigNumber(0);

  const transactionDescription = decodeTransaction(transaction.data);
  if (transactionDescription?.fragment.name !== "addLiquidity")
    return new BigNumber(0);

  const receipt = await provider.getTransactionReceipt(transaction.hash);
  if (!receipt || !receipt.logs) return new BigNumber(0);

  const liquidity = receipt.logs.reduce((acc, log) => {
    const logDescriptor = decodeEvent(log.topics as string[], log.data);
    if (logDescriptor?.fragment.name === "Transfer") {
      const tokensToAdd = new BigNumber(logDescriptor.args[3]);
      return acc.plus(tokensToAdd);
    }
    return acc;
  }, new BigNumber(0));

  return liquidity;
}

async function getPrice(
  blockTag: string | null | undefined
): Promise<BigNumber> {
  if (!blockTag) return new BigNumber(0);

  const price = (await contract.getFunction("calculatePrice").call({
    blockTag,
  })) as BigNumber;

  return price;
}

async function getLiquidity(
  blockTag: string | null | undefined
): Promise<BigNumber> {
  if (!blockTag) return new BigNumber(0);

  const liquidity = (await contract.getFunction("liquidity").call({
    blockTag,
  })) as BigNumber;

  return liquidity;
}

async function getHistoricalData(startBlock: number, endBlock: number) {
  const latestBlockNumber = await provider.getBlockNumber();
  const historicalData: any[] = [];

  const blockPromises = [];
  for (let blockNumber = startBlock; blockNumber <= endBlock; blockNumber++) {
    blockPromises.push(provider.getBlock(blockNumber));
  }

  const blocks = await Promise.all(blockPromises);

  const transactionVolumePromises = blocks.flatMap((block) => {
    return block?.transactions.map((tx) => processTransactionVolume(tx));
  });
  // const transactionLiquidityPromises = blocks.flatMap((block) => {
  //   return block?.transactions.map((tx) => processTransactionLiquidity(tx));
  // });
  const transactionLiquidityPromises = blocks.flatMap((block) => {
    return getLiquidity(block?.hash);
  });
  const transactionPricePromises = blocks.flatMap((block) => {
    return getPrice(block?.hash);
  });

  const transactionVolumes = await Promise.all(transactionVolumePromises);
  const transactionLiquidities = await Promise.all(
    transactionLiquidityPromises
  );
  const transactionPrices = await Promise.all(transactionPricePromises);

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (!block) continue;

    const volume = transactionVolumes
      .slice(i * block.transactions.length, (i + 1) * block.transactions.length)
      .reduce((acc, val) => {
        if (!acc) {
          acc = new BigNumber(0);
        }
        if (!val) {
          val = new BigNumber(0);
        }

        return acc.plus(val);
      }, new BigNumber(0));

    // const liquidity = transactionLiquidities
    //   .slice(i * block.transactions.length, (i + 1) * block.transactions.length)
    //   .reduce((acc, val) => {
    //     if (!acc) {
    //       acc = new BigNumber(0);
    //     }
    //     if (!val) {
    //       val = new BigNumber(0);
    //     }

    //     return acc.plus(val);
    //   }, new BigNumber(0));
    const liquidity = transactionLiquidities[i];

    const price = transactionPrices[i];

    historicalData.push({
      timestamp: block.timestamp,
      volume: volume?.toString(),
      liquidity: liquidity?.toString(),
      price: price?.toString(),
    });
  }

  return historicalData;
}

(async () => {
  try {
    const historicalData = await getHistoricalData(26097386, 26097387);
    console.log(historicalData);
  } catch (error) {
    console.error("Error:", error);
  }
})();

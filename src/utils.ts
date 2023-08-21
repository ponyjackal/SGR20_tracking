import { ethers } from "ethers";
import abi from "./abi/SRG20";

export function decodeTransaction(
  input: string
): ethers.TransactionDescription | null {
  try {
    const iface = new ethers.Interface(abi);
    const transactionDescriptor = iface.parseTransaction({
      data: input,
    });
    return transactionDescriptor;
  } catch (err) {
    return null;
  }
}

export function decodeEvent(
  topics: string[],
  data: string
): ethers.LogDescription | null {
  try {
    const iface = new ethers.Interface(abi);
    const logDescriptor = iface.parseLog({
      topics,
      data,
    });
    return logDescriptor;
  } catch (err) {
    return null;
  }
}

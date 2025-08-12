import {encodeFunctionData, type WalletClient, type PublicClient, type Abi } from 'viem'
import {BITE} from "@skalenetwork/bite";


export async function readContract(publicClient: PublicClient, contractABI: Abi, contractAddress: `0x${string}` ,funcName: string, args: unknown[] = []) {
  
  const result = await publicClient.readContract({
    abi: contractABI,
    address: contractAddress,
    functionName: funcName,
    args: args
  });

  return result;
}

export async function writeContract(walletClient: WalletClient,contractABI: Abi, contractAddress: `0x${string}`, funcName: string, args: unknown[] = []) {
  if (!walletClient.account) {
    throw new Error("Wallet client account is undefined");
  }

  const data = encodeFunctionData({
    abi: contractABI,
    functionName: funcName,
    args: args
  });

  const bite = new BITE(walletClient.chain?.rpcUrls.default.http[0] || "");

  const transaction = {
    to: contractAddress,
    data: data,
  };

  const encryptedTransaction = await bite.encryptTransaction(transaction);

  const tx = await walletClient.sendTransaction({
    account: walletClient.account,
    to: encryptedTransaction.to as `0x${string}`,
    data: encryptedTransaction.data as `0x${string}`,
    value: 0n,
    gas: encryptedTransaction.gasLimit
    ? BigInt(encryptedTransaction.gasLimit)
    : undefined,
    chain: walletClient.chain
  });

  return tx;
}
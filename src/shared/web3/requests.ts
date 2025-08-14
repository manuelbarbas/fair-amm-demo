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

export async function writeContract(walletClient: WalletClient,contractABI: Abi, contractAddress: `0x${string}`, funcName: string, args: unknown[] = [], isBite:boolean) {
  if (!walletClient.account) {
    throw new Error("Wallet client account is undefined");
  }

  const data = encodeFunctionData({
    abi: contractABI,
    functionName: funcName,
    args: args
  });

  const transaction = {
    to: contractAddress,
    data: data,
    gas: 300000n
  };

  if(isBite) {
    const bite = new BITE(walletClient.chain?.rpcUrls.default.http[0] || "");
    const encryptedTransaction = await bite.encryptTransaction(transaction);

    transaction.to = encryptedTransaction.to as `0x${string}`;
    transaction.data = encryptedTransaction.data as `0x${string}`;
    transaction.gas = BigInt(encryptedTransaction.gasLimit ?? "300000");
  }

  const tx = await walletClient.sendTransaction({
    account: walletClient.account,
    to: transaction.to,
    data: transaction.data,
    value: 0n,
    gas: transaction.gas,
    chain: walletClient.chain
  });

  return tx;
}
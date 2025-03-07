import {
  type Address,
  extractChain,
  http,
  type PublicClient,
  type WalletClient,
  publicActions,
  createWalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as chains from "viem/chains";
import type { ChainIds } from "../types";

export const getWalletClient = (
  chainId: ChainIds
): WalletClient & PublicClient => {
  const pkEnv = process.env.WALLET_PRIVATE_KEY;

  if (!pkEnv) {
    throw new Error("Wallet private key is required");
  }
  if (!/^(0x)?[0-9a-fA-F]{64}$/.test(pkEnv)) {
    throw new Error("Invalid private key format");
  }

  const privateKey = pkEnv.startsWith("0x")
    ? (pkEnv as Address)
    : (`0x${pkEnv}` as Address);

  const account = privateKeyToAccount(privateKey);

  const chain = extractChain({
    chains: Object.values(chains),
    id: chainId as any,
  });

  if (!chain) {
    throw new Error("Chain not supported");
  }

  return createWalletClient({
    chain,
    transport: http(),
    account,
  }).extend(publicActions) as WalletClient & PublicClient;
};

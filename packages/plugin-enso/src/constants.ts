import { ChainIds } from "./types";

export const ENSO_SUPPORTED_CHAINS = new Set(Object.values(ChainIds));

export const ENSO_API_KEY = "1e02632d-6feb-4a75-a157-documentation" as const;
export const ENSO_ETH = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as const;

export const CHAIN_EXPLORERS: Record<number, string> = {
  [ChainIds.ethereum]: "https://etherscan.io",
  [ChainIds.optimism]: "https://optimistic.etherscan.io",
  [ChainIds.binance]: "https://bscscan.com",
  [ChainIds.gnosis]: "https://gnosisscan.io",
  [ChainIds.polygon]: "https://polygonscan.com",
  [ChainIds.sonic]: "https://sonicscan.org",
  [ChainIds.zksync]: "https://era.zksync.network",
  [ChainIds.base]: "https://basescan.org",
  [ChainIds.arbitrum]: "https://arbiscan.io",
  [ChainIds.avalanche]: "https://snowtrace.io",
  [ChainIds.linea]: "https://lineascan.build",
  [ChainIds.berachain]: "https://berascan.com",
} as const;

export const MIN_ERC20_ABI = [
  {
    constant: false,
    inputs: [
    {
        name: "_spender",
        type: "address",
    },
    {
        name: "_value",
        type: "uint256",
    },
    ],
    name: "approve",
    outputs: [
    {
        name: "",
        type: "bool",
    },
    ],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

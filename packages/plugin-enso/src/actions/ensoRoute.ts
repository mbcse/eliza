import {
  type Action,
  composeContext,
  elizaLogger,
  generateObject,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelClass,
  type State,
} from "@elizaos/core";
import { ChainIds } from "../types";
import { getWalletClient } from "../hooks/useGetWalletClient";
import { swapTemplate } from "../templates";
import { z } from "zod";
import { EnsoClient, type RouteParams } from "@ensofinance/sdk";
import { type Address, type Hash, parseUnits } from "viem";
import { CHAIN_EXPLORERS, ENSO_ETH, MIN_ERC20_ABI } from "../constants";

export const EnsoRouteSchema = z.object({
  tokenIn: z.string().nullable(),
  tokenOut: z.string().nullable(),
  amount: z.string().nullable(),
  chain: z.string().nullable(),
});

export interface EnsoRouteContent {
  tokenIn: Address;
  tokenOut: Address;
  amount: string;
  chain: string;
}

export const routeAction: Action = {
  name: "ROUTE_ENSO",
  similes: [
    "SWAP_TOKENS_ENSO",
    "ROUTE_TOKENS_ENSO",
    "EXECUTE_SWAP_ENSO",
    "TOKEN_SWAP_ENSO",
  ],
  description: "Find the most optimal route between tokens and execute it",
  validate: async (runtime: IAgentRuntime) => {
    return (
    !!runtime.getSetting("WALLET_PRIVATE_KEY") &&
    !!runtime.getSetting("ENSO_API_KEY")
    );
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: Record<string, unknown>,
    callback?: HandlerCallback
  ) => {
    // Initialize or update state
    const supportedChains = Object.keys(ChainIds)
    .map((c) => c.toLowerCase())
    .join(" | ");
    const currentState = !state
    ? await runtime.composeState(message, { supportedChains })
    : await runtime.updateRecentMessageState(state);

    currentState.supportedChains = supportedChains;

    try {
    const context = composeContext({
        state: currentState,
        template: swapTemplate,
    });

    const content = await generateObject({
        runtime,
        context,
        modelClass: ModelClass.MEDIUM,
        schema: EnsoRouteSchema,
    });

    if (!isEnsoRouteContent(content.object)) {
        const missingFields = getMissingEnsoRouteContent(content.object);
        callback({
        text: `Need more information about the swap. Please provide me ${missingFields}`,
        });
        return;
    }

    const { tokenIn, tokenOut, amount, chain } = content.object;

    const chainId = ChainIds[chain.toLowerCase() as keyof typeof ChainIds];
    if (!chainId) {
        callback({
        text: `Unsupported chain: ${chain}. Supported chains are: ${Object.keys(
            ChainIds
        )
            .filter((k) => !Number.isNaN(Number(k)))
            .join(", ")}`,
        });
        return;
    }

    const ensoClient = new EnsoClient({
        apiKey: runtime.getSetting("ENSO_API_KEY"),
    });
    const client = getWalletClient(chainId);
    const [fromAddress] = await client.getAddresses();

    const tokenInRes = await ensoClient.getTokenData({
        chainId,
        address: tokenIn,
        includeMetadata: true,
    });

    if (
        tokenInRes.data.length === 0 ||
        typeof tokenInRes.data[0].decimals !== "number"
    ) {
        throw Error(`Token ${tokenIn} is not supported`);
    }
    const tokenInData = tokenInRes.data[0];
    const amountInWei = parseUnits(amount.toString(), tokenInData.decimals);

    const params: RouteParams = {
        chainId,
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        amountIn: amountInWei.toString(),
        fromAddress,
        receiver: fromAddress,
        spender: fromAddress,
    };
    const routeData = await ensoClient.getRouterData(params);

    if (tokenIn.toLowerCase() !== ENSO_ETH) {
        elizaLogger.info(`Token in data ${tokenInData.symbol}`);
        const { request } = await client.simulateContract({
        address: tokenIn,
        abi: MIN_ERC20_ABI,
        functionName: "approve",
        args: [routeData.tx.to as Address, BigInt(amountInWei)],
        });
        const txHash = await client.writeContract(request);

        const receipt = await client.waitForTransactionReceipt({
        hash: txHash,
        });

        if (receipt.status !== "success") {
        callback({
            text: `❌ Approval failed! Tx: ${txHash}`,
            content: { hash: txHash, status: "failed" },
        });
        return;
        }

        callback({
        text: `✅ Approval succeeded, going to continue with route execution! Tx: ${txHash}`,
        content: { hash: txHash, status: "success" },
        });
    }

    const nonce = await client.getTransactionCount({
        address: fromAddress,
    });

    const txHash = await client.sendTransaction({
        account: client.account,
        chain: client.chain,
        nonce,
        to: routeData.tx.to,
        data: routeData.tx.data as Hash,
        value: BigInt(routeData.tx.value),
        kzg: undefined,
    });

    const receipt = await client.waitForTransactionReceipt({
        hash: txHash,
    });

    if (receipt.status === "success") {
        callback({
        text: `✅ Route executed successfully, spent ${amount} ${tokenInData.symbol}!\nTransaction: ${CHAIN_EXPLORERS[chainId]}/tx/${txHash}`,
        content: { hash: txHash, status: "success" },
        });
        return true;
    }
    callback({
        text: `❌ Route execution failed!\nTransaction: ${CHAIN_EXPLORERS[chainId]}/tx/${txHash}`,
        content: { hash: txHash, status: "failed" },
    });
    return false;
    } catch (e) {
    elizaLogger.error(`Route execution failed: ${e.message || String(e)}`);

    callback({
        text: "❌ Failed to execute route!",
        content: { error: e.message || String(e) },
    });
    }
  },
  examples: [
    [
    {
        user: "{{user1}}",
        content: {
        text: "I want to swap 1 0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2 (WETH) to 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 (USDC) on Ethereum",
        },
    },
    {
        user: "{{agent}}",
        content: {
        text: "Let me execute the swap for you",
        action: "ROUTE_ENSO",
        },
    },
    ],

    [
    {
        user: "{{user1}}",
        content: {
        text: "I want to route 2 0x4200000000000000000000000000000000000006 (WETH) to 0x4e65fe4dba92790696d040ac24aa414708f5c0ab (aBasUSDC) on Base",
        },
    },
    {
        user: "{{agent}}",
        content: {
        text: "Let me execute the swap for you",
        action: "ROUTE_ENSO",
        },
    },
    ],
  ],
};

export const isEnsoRouteContent = (object: any): object is EnsoRouteContent => {
  return EnsoRouteSchema.safeParse(object).success;
};

export const getMissingEnsoRouteContent = (
  content: Partial<EnsoRouteContent>
): string => {
  const missingFields = [];

  if (typeof content.tokenIn !== "string") missingFields.push("token in");
  if (typeof content.tokenOut !== "string") missingFields.push("token out");
  if (typeof content.amount !== "number") missingFields.push("sell amount");

  return missingFields.join(" and ");
};

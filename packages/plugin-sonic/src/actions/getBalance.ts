import {
    IAgentRuntime,
    Memory,
    State,
    HandlerCallback,
    elizaLogger,
    Action,
    composeContext,
    ModelClass,
    generateObjectDeprecated,
    ActionExample,
} from "@elizaos/core";
import { ethers } from "ethers";
import { DEFAULT_SONIC_RPC_URL, GET_BALANCE_TEMPLATE } from "../constant";
import { BalanceContent } from "../types";

function isBalanceContent(
    _runtime: IAgentRuntime,
    content: unknown
): content is BalanceContent {
    return typeof (content as BalanceContent).address === "string";
}

export const getBalance: Action = {
    name: "GET_BALANCE",
    description: "Get the balance of a specific address on the Sonic blockchain",
    similes: [
        "GET_BALANCE",
        "CHECK_BALANCE",
        "CHECK_BALANCE_OF",
        "CHECK_BALANCE_OF_ADDRESS",
        "LOOKUP_BALANCE",
        "LOOKUP_BALANCE_OF",
        "LOOKUP_BALANCE_OF_ADDRESS",
        "LIST_BALANCE",
        "LIST_BALANCE_OF",
        "LIST_BALANCE_OF_ADDRESS",
        "GET_BALANCE_OF",
        "GET_BALANCE_OF_ADDRESS",
        "GET_BALANCE_OF_WALLET",
        "GET_BALANCE_OF_WALLET_ADDRESS",
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        elizaLogger.info("Validating get balance action");
        return true;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.info("Getting balance");

        let currentState: State;
        if (!state) {
            currentState = (await runtime.composeState(message)) as State;
        } else {
            currentState = await runtime.updateRecentMessageState(state);
        }

        const balanceContext = composeContext({
            state: currentState,
            template: GET_BALANCE_TEMPLATE,
        });

        const content = await generateObjectDeprecated({
            runtime,
            context: balanceContext,
            modelClass: ModelClass.LARGE,
        });

        if (!isBalanceContent(runtime, content) || !content.address || content.address === "{{walletAddress}}") {
            elizaLogger.error("No wallet address provided for GET_BALANCE action.");
            if (callback) {
                callback({
                    text: "I need a wallet address to check the balance. Please provide a wallet address.",
                    content: { error: "Missing wallet address" },
                });
            }
            return false;
        }

        const sonicRPCUrl = runtime.getSetting("SONIC_RPC_URL") as string || DEFAULT_SONIC_RPC_URL;

        try {
            const provider = new ethers.JsonRpcProvider(sonicRPCUrl);
            const walletAddress = content.address;
            const balance = await provider.getBalance(walletAddress);
            const balanceInSonic = ethers.formatEther(balance);

            if (callback) {
                callback({
                    text: `Balance: ${balanceInSonic} S`,
                    content: { balance: balanceInSonic },
                });
            }
            return true;
        } catch (error) {
            elizaLogger.error("Error getting balance", error);
            if (callback) {
                callback({
                    text: `Error getting balance: ${error}`,
                    content: { error: error },
                });
            }
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Check my balance of SONIC",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll help you check your balance of SONIC",
                    action: "GET_BALANCE",
                    content: {
                        address: "{{walletAddress}}",
                    },
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Check my balance of token 0x5C951583CEb79828b1fAB7257FE497A9Dc5896e6",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll help you check your balance of token 0x5C951583CEb79828b1fAB7257FE497A9Dc5896e6",
                    action: "GET_BALANCE",
                    content: {
                        address: "{{walletAddress}}",
                        token: "0x5C951583CEb79828b1fAB7257FE497A9Dc5896e6",
                    },
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Get SONIC balance of 0x5C951583CEb79828b1fAB7257FE497A9Dc5896e6",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll help you check SONIC balance of 0x5C951583CEb79828b1fAB7257FE497A9Dc5896e6",
                    action: "GET_BALANCE",
                    content: {
                        address: "0x5C951583CEb79828b1fAB7257FE497A9Dc5896e6",
                    },
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Check my wallet balance on SONIC",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll help you check your wallet balance on SONIC",
                    action: "GET_BALANCE",
                    content: {
                        address: "{{walletAddress}}",
                    },
                },
            }
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What is my balance?",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I need a wallet address to check the balance. Please provide a wallet address.",
                    content: { error: "Missing wallet address" },
                },
            }
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What is my balance?",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I need a wallet address to check the balance. Please provide a wallet address.",
                    content: { error: "Missing wallet address" },
                },
            },
            {
                user: "{{user1}}",
                content: {
                    text: "My wallet address is 0x5C951583CEb79828b1fAB7257FE497A9Dc5896e6",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll help you check the balance for 0x5C951583CEb79828b1fAB7257FE497A9Dc5896e6",
                    action: "GET_BALANCE",
                    content: {
                        address: "0x5C951583CEb79828b1fAB7257FE497A9Dc5896e6",
                    },
                },
            }
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Check balance",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I need a wallet address to check the balance. Please provide a wallet address.",
                    content: { error: "Missing wallet address" },
                },
            }
        ]
    ] as ActionExample[][],
} as Action;
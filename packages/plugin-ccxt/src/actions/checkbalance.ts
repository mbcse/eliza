import {
    composeContext,
    Content,
    elizaLogger,
    generateObject,
    HandlerCallback,
} from "@elizaos/core";
import ccxt from "ccxt";
import {
    type Action,
    type ActionExample,
    type IAgentRuntime,
    type Memory,
    ModelClass,
    type State,
} from "@elizaos/core";
import { getExchangeAssetTemplate } from "../templates/getexchnageandasset";
import { z } from "zod";
import { GetExchangeAssetSchema } from "../Schemas/exchnageandassetSchema";
type GetExchnageandAsset = z.infer<typeof GetExchangeAssetSchema> & Content;
const isGetExchangeandAsset = (obj: unknown): obj is GetExchnageandAsset => {
    return GetExchangeAssetSchema.safeParse(obj).success;
};

export const checkbalance: Action = {
    name: "checkbalance",
    similes: ["CHECK_BALANCE", "CHECK_ASSET_BALANCE", "BALANCE"],
    description:
        "The action will check the balance of a specified asset on the chosen exchange.",

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        return true;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ) => {
        try {
            let currentState = state;
            if (!currentState) {
                currentState = (await runtime.composeState(message)) as State;
            } else {
                currentState = await runtime.updateRecentMessageState(
                    currentState
                );
            }
         
            elizaLogger.log("Composing price context...");
            const ExchnageandAsset = composeContext({
                state: currentState,
                template: getExchangeAssetTemplate,
            });

            elizaLogger.log("Generating content from template...");
            const result = await generateObject({
                runtime,
                context: ExchnageandAsset,
                modelClass: ModelClass.SMALL,
                schema: GetExchangeAssetSchema,
            });

            if (!isGetExchangeandAsset(result.object)) {
                callback(
                    {
                        text: `Somethig went wrong. Please try again.`,
                    },
                    []
                );
                return false;
            }

            const content = result.object;
            console.log(content);
            if (content.exchange==undefined || content.asset==undefined || content.exchange=="" || content.asset=="") {
                callback(
                    {
                        text: `Please provide the exchange and asset to check the balance.`,
                    },
                    []
                );
                return false;
                
            }
            elizaLogger.log("Generated content:", content);
            if (!ccxt.exchanges.includes(content.exchange)) {
                throw new Error(
                    `Exchange ${content.exchange} is not supported.`
                );
            }
            const apiKey =
                process.env[
                    "CCXT_" + content.exchange.toUpperCase() + "_API_KEY"
                ];
            const secret =
                process.env[
                    "CCXT_" + content.exchange.toUpperCase() + "_API_SECRET"
                ];
                console.log(apiKey, secret);
            if (!apiKey || !secret) {
                throw new Error(
                    `Missing API credentials for ${content.exchange}. Check environment variables.`
                );
            }

            const exchange = new ccxt[content.exchange]({
                apiKey: process.env[
                    "CCXT_" + content.exchange.toUpperCase() + "_API_KEY"
                ],
                secret: process.env[
                    "CCXT_" + content.exchange.toUpperCase() + "_API_SECRET"
                ],
            });
          
            // exchange.setSandboxMode(true);
            await exchange.loadMarkets();
            const balance = await exchange.fetchBalance();
            console.log(balance);
            if (balance.total[content.asset]) {
            callback(
                {
                    text: `Your balance for ${content.asset} is ${balance.total[content.asset]}.`,
                },
                []
            )}else{
                callback(
                    {
                        text: `You don't have any ${content.asset} in your account.`,
                    },
                    []
                );
            }
            return;
            
        } 
    catch (error) {
        callback(
            {
                text: error.message,
            },
            []
        );
        return;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Can you check my BTC balance on Binance?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Sure, let me check your BTC balance on Binance.",
                    action: "checkbalance",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What's my Ethereum balance on Coinbase?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Let me check your Ethereum balance on Coinbase.",
                    action: "checkbalance",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Can you tell me how much Litecoin I have on Kraken?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Checking your Litecoin balance on Kraken now.",
                    action: "checkbalance",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Do I have any Dogecoin on KuCoin?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Let me see if you have any Dogecoin on KuCoin.",
                    action: "checkbalance",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;

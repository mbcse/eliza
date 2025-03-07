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
import { z } from "zod";
import { getArbitrageOpportunityTemplate } from "../templates/getspatialarbitrageopportunity";
import { GetArbitrageOpportunitySchema } from "../Schemas/arbitrageopportunitySchema";
type GetArbitrageOpportunity = z.infer<typeof GetArbitrageOpportunitySchema> & Content;
const isArbitrageObj = (obj: unknown): obj is GetArbitrageOpportunity => {
    return GetArbitrageOpportunitySchema.safeParse(obj).success;
};

async function getBestArbitrage(asset: string) {
    // Get only configured exchanges
    const exchanges = ccxt.exchanges.filter(id => 
        process.env[`CCXT_${id.toUpperCase()}_API_KEY`] &&
        process.env[`CCXT_${id.toUpperCase()}_API_SECRET`]
    );

    if (exchanges.length < 2) {
        return { error: "At least two configured exchanges are required for arbitrage." };
    }

    const prices: Record<string, number> = {};

    for (const id of exchanges) {
        try {
            const exchange = new (ccxt as any)[id]({
                apiKey: process.env[`CCXT_${id.toUpperCase()}_API_KEY`],
                secret: process.env[`CCXT_${id.toUpperCase()}_API_SECRET`],
            });
            // exchange.setSandboxMode(true);
            const ticker = await exchange.fetchTicker(`${asset}/USDT`);
            prices[id] = ticker.last;
        } catch (error) {
            console.error(`⚠️ Failed to fetch price from ${id}:`, error);
        }
    }

    if (Object.keys(prices).length < 2) {
        return { message: "Insufficient price data for arbitrage." };
    }

    // Find min (best buy) and max (best sell) price
    const [minEx, minPrice] = Object.entries(prices).reduce((a, b) => (a[1] < b[1] ? a : b));
    const [maxEx, maxPrice] = Object.entries(prices).reduce((a, b) => (a[1] > b[1] ? a : b));

    return minPrice < maxPrice 
        ? { buyFrom: minEx, sellOn: maxEx, buyPrice: minPrice, sellPrice: maxPrice, profit: `${((maxPrice - minPrice) / minPrice * 100).toFixed(2)}%` }
        : { message: "No arbitrage opportunity found." };
}

async function replyWithArbitrage(asset: string) {
    const result = await getBestArbitrage(asset);

    if ("error" in result) {
        return `❌ ${result.error}`;
    } else if ("message" in result) {
        return `ℹ️ ${result.message}`;
    } else {
        return `💰 **Arbitrage Opportunity Found!**  
        - **Buy From:** ${result.buyFrom} at **$${result.buyPrice}**  
        - **Sell On:** ${result.sellOn} at **$${result.sellPrice}**  
        - **Potential Profit:** ${result.profit}`;
    }
}

export const getarbitrageopportunity: Action = {
    name: "getarbitrageopportunity",
    similes: ["GET_ARBITRAGE_OPPORTUNITY", "ARBITRAGE_OPPORTUNITY"],
    description:
        "The action will find the best arbitrage opportunity for a specified asset across all configured exchanges.",

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
            // try {
            elizaLogger.log("Composing price context...");
            const Arbitrageopportunity = composeContext({
                state: currentState,
                template: getArbitrageOpportunityTemplate,
            });

            elizaLogger.log("Generating content from template...");
            const result = await generateObject({
                runtime,
                context: Arbitrageopportunity,
                modelClass: ModelClass.SMALL,
                schema: GetArbitrageOpportunitySchema,
            });

            if (!isArbitrageObj(result.object)) {
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
            if ( content.asset==undefined ||  content.asset=="") {
                callback(
                    {
                        text: `Please provide the asset to check the arbitrage opportunity.`,
                    },
                    []
                );
                return false;
                
            }
            callback(
                {
                    text: "🔄 Searching for arbitrage opportunity...",
                },
                [])
            
            elizaLogger.log("Generated content:", content);
           const response = await replyWithArbitrage(content.asset);


           callback(
            {
                text: response,
            },
            [])
            return;
    }catch (error) {
        callback(
            {
                text: "Something went wrong try again later",
            },
            [])
            console.error("Error fetching balance:", error);
        }
    },
    examples: [
        [
            {
                "user": "{{user1}}",
                "content": {
                    "text": "Find the best arbitrage opportunity for BTC."
                }
            },
            {
                "user": "{{user2}}",
                "content": {
                    "text": "Checking for BTC arbitrage opportunities across all exchanges.",
                    "action": "getarbitrageopportunity"
                }
            }
        ],
        [
            {
                "user": "{{user1}}",
                "content": {
                    "text": "Are there any price differences for Ethereum?"
                }
            },
            {
                "user": "{{user2}}",
                "content": {
                    "text": "Scanning exchanges for Ethereum price variations.",
                    "action": "getarbitrageopportunity"
                }
            }
        ],
        [
            {
                "user": "{{user1}}",
                "content": {
                    "text": "Can I profit from arbitrage on Dogecoin?"
                }
            },
            {
                "user": "{{user2}}",
                "content": {
                    "text": "Analyzing Dogecoin prices across exchanges for arbitrage potential.",
                    "action": "getarbitrageopportunity"
                }
            }
        ],
        [
            {
                "user": "{{user1}}",
                "content": {
                    "text": "Check if USDT has arbitrage opportunities."
                }
            },
            {
                "user": "{{user2}}",
                "content": {
                    "text": "Looking for USDT arbitrage opportunities across exchanges.",
                    "action": "getarbitrageopportunity"
                }
            }
        ],
        [
            {
                "user": "{{user1}}",
                "content": {
                    "text": "Where can I buy SOL cheap and sell for a profit?"
                }
            },
            {
                "user": "{{user2}}",
                "content": {
                    "text": "Finding the best buy and sell prices for SOL across exchanges.",
                    "action": "getarbitrageopportunity"
                }
            }
        ]
    ]as ActionExample[][],
} as Action;

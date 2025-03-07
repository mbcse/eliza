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
import { placeOrderTemplate } from "../templates/placeordertemplate";
import { z } from "zod";
import { PlaceOrderSchema } from "../Schemas/placeorderschema";
type PlaceOrderType = z.infer<typeof PlaceOrderSchema> & Content;
const isPlaceOrderobj = (obj: unknown): obj is PlaceOrderType => {
    return PlaceOrderSchema.safeParse(obj).success;
};

export const placeorder: Action = {
    name: "placeorder",
    similes: [
        "MAKE_ORDER",
        "PLACE_ORDER",
        "BUY_ASSET",
        "SELL_ASSET",
        "TRADE",
        "TRADE_ASSET",
    ],
    description:
        "The action will place a market or limit order to buy or sell a specified asset on the chosen exchange.",

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
            elizaLogger.log("Composing order context...");
            const ExchnageandAsset = composeContext({
                state: currentState,
                template: placeOrderTemplate,
            });

            elizaLogger.log("Generating content from template...");
            const result = await generateObject({
                runtime,
                context: ExchnageandAsset,
                modelClass: ModelClass.SMALL,
                schema: PlaceOrderSchema,
            });

            if (!isPlaceOrderobj(result.object)) {
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
            elizaLogger.log("Generated content:", content);

            const { exchange, symbol, orderType, side, amount, price } =
                content;
                if (![exchange, symbol, orderType, side, amount, price].every(value => value !== null && value !== undefined && value !== "")) {
                    throw new Error("Please provide all required parameters.");
                }
            // 🔹 Validate exchange existence
            if (!ccxt.exchanges.includes(exchange)) {
                throw new Error(`Exchange "${exchange}" is not supported.`);
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
            // 🔹 Initialize exchange with API credentials
            const exchangeInstance = new ccxt[exchange]({
                apiKey: process.env[`CCXT_${exchange.toUpperCase()}_API_KEY`],
                secret: process.env[
                    `CCXT_${exchange.toUpperCase()}_API_SECRET`
                ],
                // enableRateLimit: true,
            });
         

            // exchangeInstance.setSandboxMode(true);
            // 🔹 Load available markets
            await exchangeInstance.loadMarkets();

            // 🔹 Check if symbol is available on the exchange
            if (!exchangeInstance.markets[symbol]) {
                throw new Error(
                    `Trading pair "${symbol}" is NOT available on ${exchange}.`
                );
            }

            // 🔹 Validate order type
            const validOrderTypes: string[] = ["market", "limit"];
            if (!validOrderTypes.includes(orderType)) {
                throw new Error(
                    `Invalid order type "${orderType}". Must be "market" or "limit".`
                );
            }

            // 🔹 Validate order side
            const validSides: string[] = ["buy", "sell"];
            if (!validSides.includes(side)) {
                throw new Error(
                    `Invalid order side "${side}". Must be "buy" or "sell".`
                );
            }

            // 🔹 Validate amount
            if (amount <= 0) {
                throw new Error("Order amount must be greater than 0.");
            }

            // 🔹 Check if price is required (for limit orders)
            if (orderType === "limit" && (price === undefined || price <= 0)) {
                throw new Error(
                    "Limit orders require a valid price greater than 0."
                );
            }

            // 🔹 Determine base and quote currency from symbol (e.g., "BTC/USDT")
            const [base, quote] = symbol.split("/");

            // 🔹 Check balance for BUY orders (ensure enough QUOTE currency)
            if (side === "buy") {
                const balance = await exchangeInstance.fetchBalance();
                const availableBalance = balance.total[quote] || 0;

                const ticker = await exchangeInstance.fetchTicker(symbol);
                const requiredBalance =
                    orderType === "market"
                        ? amount * ticker.last
                        : amount * price;

                if (availableBalance < requiredBalance) {
                    throw new Error(
                        `Insufficient ${quote} balance. Required: ${requiredBalance}, Available: ${availableBalance}`
                    );
                }
            }

            // 🔹 Check balance for SELL orders (ensure enough BASE currency)
            if (side === "sell") {
                const balance = await exchangeInstance.fetchBalance();
                const availableBalance = balance.total[base] || 0;

                if (availableBalance < amount) {
                    throw new Error(
                        `Insufficient ${base} balance. Required: ${amount}, Available: ${availableBalance}`
                    );
                }
            }

            // 🔹 Prepare order parameters
            const orderParams: any = {
                symbol,
                type: orderType,
                side,
                amount,
            };

            // Include price for limit orders
            if (orderType === "limit") {
                orderParams.price = price;
            }

            // 🔹 Execute the order
            const order = await exchangeInstance.createOrder(
                orderParams.symbol,
                orderParams.type,
                orderParams.side,
                orderParams.amount,
                orderParams.price
            );
            if (order) {
                callback(
                    {
                        text: `
✅ Order Placed Successfully  

📌 **Order Details:**  
- **Symbol:** ${order.symbol}  
- **Order ID:** ${order.id}  
- **Order Type:** ${order.type}  
- **Side:** ${order.side.toUpperCase()}  
- **Status:** ${order.status.toUpperCase()}  

💰 **Price:** ${order.price.toLocaleString()} USDT  
📊 **Amount:** ${order.amount} BTC  
💵 **Total Cost:** ${order.cost.toFixed(2)} USDT  

Thank you for trading! 🚀  
`,
                    },
                    []
                );
            }else{
                callback(
                    {
                        text: `Order failed. Please try again.`,
                    },
                    []
                );
            }
            console.log("✅ Order placed successfully:", order);
            return order;
        } catch (error) {
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
                    text: "Buy 0.05 BTC on Binance at market price.",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Placing a market buy order for 0.05 BTC on Binance.",
                    action: "placeorder",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Sell 2 ETH on Coinbase at $3,000.",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Placing a limit sell order for 2 ETH at $3,000 on Coinbase.",
                    action: "placeorder",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Can you place a market order to sell 5 LTC on Kraken?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Placing a market sell order for 5 LTC on Kraken.",
                    action: "placeorder",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Buy 1000 DOGE on KuCoin at $0.08.",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Placing a limit buy order for 1000 DOGE at $0.08 on KuCoin.",
                    action: "placeorder",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;

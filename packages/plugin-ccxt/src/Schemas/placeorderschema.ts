import { z } from "zod";
export const PlaceOrderSchema = z.object({
    
    exchange: z.string().toLowerCase(), // Ensures exchange names match CCXT's lowercase format
    symbol: z.string(), // Trading pair (e.g., "BTC/USDT", "ETH/USD")
    orderType: z.enum(["market", "limit"]), // Only market or limit orders
    side: z.enum(["buy", "sell"]), // Ensures order side is either "buy" or "sell"
    amount: z.number().positive(), // Amount must be positive
    price: z.number().positive().optional(), // Required for limit orders, optional for market orders
    
});


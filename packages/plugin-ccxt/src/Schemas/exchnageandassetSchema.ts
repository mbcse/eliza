import { z } from "zod";

export const GetExchangeAssetSchema = z.object({
    exchange: z.string().toLowerCase(), // Ensures exchange names match CCXT's lowercase format
    asset: z.string() // Allows only a single asset (e.g., "BTC", "ETH")
});



import { z } from "zod";

export const GetArbitrageOpportunitySchema = z.object({
    asset: z.string(), // Ensures only a single asset (e.g., "BTC", "ETH")
    // exchanges: z.array(z.string().toLowerCase()) // Ensures exchange names are lowercase and in an array
});
import { type IAgentRuntime } from "@elizaos/core";
import { z } from "zod";

export const gigEnvSchema = z.object({
    GIGBOT_API_URL: z.string().url().default("https://www.gigbot.xyz/api"),
    GIG_SEARCH_INTERVAL: z.string().transform(s => s || "3").default("3"), // hours
    GIG_ACTION_INTERVAL: z.string().transform(s => s || "12").default("12"), // hours
    GIG_CLAIM_INTERVAL: z.string().transform(s => s || "24").default("24"), // hours
    GIG_CLAIM_PLATFORM: z.enum(['x', 'farcaster']).default('x'),
    EVM_PRIVATE_KEY: z.string().startsWith("0x"),
});

export type GigConfig = z.infer<typeof gigEnvSchema>;

export async function validateGigConfig(runtime: IAgentRuntime): Promise<GigConfig> {
    const config = {
        GIGBOT_API_URL: runtime.getSetting("GIGBOT_API_URL") || process.env.GIGBOT_API_URL || "https://www.gigbot.xyz/api",
        GIG_SEARCH_INTERVAL: runtime.getSetting("GIG_SEARCH_INTERVAL") || process.env.GIG_SEARCH_INTERVAL || "3",
        GIG_ACTION_INTERVAL: runtime.getSetting("GIG_ACTION_INTERVAL") || process.env.GIG_ACTION_INTERVAL || "12",
        GIG_CLAIM_INTERVAL: runtime.getSetting("GIG_CLAIM_INTERVAL") || process.env.GIG_CLAIM_INTERVAL || "24",
        GIG_CLAIM_PLATFORM: runtime.getSetting("GIG_CLAIM_PLATFORM") || process.env.GIG_CLAIM_PLATFORM || "x",
        EVM_PRIVATE_KEY: runtime.getSetting("EVM_PRIVATE_KEY") || process.env.EVM_PRIVATE_KEY,
    };

    return gigEnvSchema.parse(config);
} 
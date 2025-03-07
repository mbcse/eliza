import type { IAgentRuntime } from "@elizaos/core";
import { z } from "zod";

export const sonicEnvironmentSchema = z.object({
    SONIC_WALLET_ADDRESS: z.string().min(1, "Sonic wallet address is required"),
    SONIC_PRIVATE_KEY: z.string().min(1, "Sonic private key is required"),
});

export type SonicConfig = z.infer<typeof sonicEnvironmentSchema>;

export async function validateSonicConfig(runtime: IAgentRuntime): Promise<SonicConfig> {
   try {
    const config = {
        SONIC_WALLET_ADDRESS: runtime.getSetting("SONIC_WALLET_ADDRESS") || process.env.SONIC_WALLET_ADDRESS,
        SONIC_PRIVATE_KEY: runtime.getSetting("SONIC_PRIVATE_KEY") || process.env.SONIC_PRIVATE_KEY,
    };

    return sonicEnvironmentSchema.parse(config);
   } catch (error) {
    if (error instanceof z.ZodError) {
        const errorMessage = error.errors.map((e) => e.message).join("\n");
        throw new Error(`Invalid Sonic configuration: ${errorMessage}`);
    }
    throw new Error("Invalid Sonic configuration");
   }
};
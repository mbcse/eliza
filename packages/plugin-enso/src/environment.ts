import type { IAgentRuntime } from "@elizaos/core";
import { z } from "zod";

export const ensoEnvSchema = z.object({
  ENSO_API_KEY: z.string().optional(),
  WALLET_PRIVATE_KEY: z.string().min(1, "Wallet private key is required"),
});

export type ensoConfig = z.infer<typeof ensoEnvSchema>;

export async function validateEnsoConfig(
  runtime: IAgentRuntime
): Promise<ensoConfig> {
  try {
    const config = {
    ENSO_API_KEY: runtime.getSetting("ENSO_API_KEY"),
    ENSO_PRIVATE_KEY: runtime.getSetting("ENSO_PRIVATE_KEY"),
    };

    return ensoEnvSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
    const errorMessages = error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join("\n");
    throw new Error(
        `Enso configuration validation failed:\n${errorMessages}`
    );
    }
    throw error;
  }
}

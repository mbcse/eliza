import type { IAgentRuntime } from "@elizaos/core";
import { z } from "zod";

export const weChatEnvSchema = z.object({
    WECHAT_SERVER_URL: z.string()
});

export type WeChatConfig = z.infer<typeof weChatEnvSchema>;

export async function validateWeChatConfig(
    runtime: IAgentRuntime
): Promise<WeChatConfig> {
    try {
        const config = {
            WECHAT_SERVER_URL:
                runtime.getSetting("WECHAT_SERVER_URL") ||
                process.env.WECHAT_SERVER_URL || 
                "https://wechaty.js.org/qrcode/",
        };

        return weChatEnvSchema.parse(config);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            throw new Error(
                `WeChat configuration validation failed:\n${errorMessages}`
            );
        }
        throw error;
    }
}
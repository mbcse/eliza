import {
    IAgentRuntime,
    UUID,
    Content,
    Memory,
    HandlerCallback,
    ModelClass,
    State,
    Media,
    elizaLogger,
    getEmbeddingZeroVector,
    composeContext,
    generateMessageResponse,
    stringToUuid
} from "@elizaos/core";

import { WechatyBuilder, Wechaty } from "wechaty";

export class WeChatClient {
    private runtime: IAgentRuntime;
    private client: WeChatClient;
    private bot: Wechaty;

    constructor(runtime: IAgentRuntime) {
        elizaLogger.log("📱 Constructing new WeChat Client...");

        this.runtime = runtime;

        const options = {
            name: 'wechat',
        }

        const bot = WechatyBuilder.build(options);

        this.bot = bot;
        elizaLogger.log("✅ WeChat mClient constructor completed");
    }

    public async start(url: string): Promise<void> {
        elizaLogger.log("🚀 Starting WeChat account...");

            this.bot
            .on('scan', (qrcode, status) => elizaLogger.log(`Scan QR Code to login: ${status}\n${url}${encodeURIComponent(qrcode)}`))
            .on('login',            user => elizaLogger.log(`User ${user} logged in`))
            .on('message',       message => elizaLogger.log(`Message: ${message}`))
            .start()
            .catch(
                async error => {
                    elizaLogger.error("❌ Failed to launch WeChat account:", error);

                    await this.bot.stop()
                    process.exit(-1)
                }
            )

    }

    async stop() {
        elizaLogger.warn("WeChat client does not need stopping yet");
    }
}
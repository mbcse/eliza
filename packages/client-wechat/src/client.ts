import {
    elizaLogger,
} from "@elizaos/core";
import type { Client, IAgentRuntime } from "@elizaos/core";
import { validateWeChatConfig } from "./environment.ts";
import { WeChatClient } from "./weChatClient.ts"

export const WeChatClientInterface: Client = {
    name: 'weChat',

    start: async (runtime: IAgentRuntime) => {
        const weChatConfig = await validateWeChatConfig(runtime);
        const weChatClient = new WeChatClient(
            runtime, 
        );
        
        await weChatClient.start(weChatConfig.WECHAT_SERVER_URL);

        elizaLogger.success(`✅ WeChat client successfully started for character ${runtime.character.name}`);

        return weChatClient;
    },
};
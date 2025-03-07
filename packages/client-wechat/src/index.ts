import { WeChatClientInterface } from "./client";

const telegramAccountPlugin = {
    name: "weChat",
    description: "WeChat client plugin",
    clients: [WeChatClientInterface],
};
export default telegramAccountPlugin;
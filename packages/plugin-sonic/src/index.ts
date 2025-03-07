import type { Plugin } from "@elizaos/core";
import { getBalance, transferToken } from "./actions";

export const sonicPlugin: Plugin = {
    name: "sonic",
    description: "Sonic blockchain plugin for ElizaOS",
    actions: [
        transferToken,
        getBalance,
    ],
    clients: [],
    adapters: [],
    providers: [],
};

export default sonicPlugin;
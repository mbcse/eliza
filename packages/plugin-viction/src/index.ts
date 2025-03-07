import type { Plugin } from "@elizaos/core";
import transferToken from "./actions/transfer.ts";
import transferVic from "./actions/transfer_vic.ts";
import infoVic from "./actions/vic_infomation.ts";

export const victionPlugin: Plugin = {
    name: "viction",
    description: "Viction Plugin for Eliza",
    actions: [transferToken, transferVic, infoVic],
    evaluators: [],
    providers: [],
};
export default victionPlugin;

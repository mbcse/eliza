import type { Plugin } from "@elizaos/core";
import { createAndRegisterAgent } from "./actions/createAndRegisterAgent";
import { verifyData } from "./actions/verifyData";
import { attpsPriceQuery } from "./actions/attpsPriceQuery";

export const attpsPlugin: Plugin = {
    name: "ATTPs",
    description: "ATTPs Plugin for Eliza",
    actions: [
        createAndRegisterAgent,
        verifyData,
        attpsPriceQuery,
    ],
    evaluators: [],
    providers: [],
};

export default attpsPlugin;
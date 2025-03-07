import type { Plugin } from "@elizaos/core";
import { checkbalance } from "./actions/checkbalance";
import { placeorder } from "./actions/placeorder";
import { getarbitrageopportunity } from "./actions/getspatialarbitrageopprtunityopportunity";


export const ccxtplugin: Plugin = {
    name: "ccxtplugin",
    description: "The plugin can get arbitrage opportunity, place order and check balance",
    actions: [getarbitrageopportunity,placeorder,checkbalance],
    providers: [],
    evaluators: [],
};

export default ccxtplugin;

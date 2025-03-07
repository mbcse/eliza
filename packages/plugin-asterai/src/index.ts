import {asteraiProvider} from "./providers/asterai.provider";
import { queryAction } from "./actions/query";
import { AsteraiClient } from "@asterai/client";

let asteraiClient: AsteraiClient | null = null;

export const getInitAsteraiClient = (
  agentId: string,
  publicQueryKey: string
): AsteraiClient => {
    if (!asteraiClient) {
        asteraiClient = new AsteraiClient({
            appId: agentId,
            queryKey: publicQueryKey,
        })
    }
    return asteraiClient;
};

export const asteraiPlugin = {
    name: "asterai",
    description: "asterai Plugin for Eliza",
    providers: [asteraiProvider],
    actions: [queryAction],
    evaluators: [],
    services: [],
};

export default asteraiPlugin;

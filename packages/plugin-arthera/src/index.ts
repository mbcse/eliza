export * from "./types";

import { transferAction } from "./actions/transfer";
import { artheraWalletProvider } from "./providers/wallet";

export const artheraPlugin = {
    name: "arthera",
    description: "Arthera blockchain integration plugin",
    providers: [artheraWalletProvider],
    evaluators: [],
    services: [],
    actions: [transferAction],
};

export default artheraPlugin;


import transfer from "./actions/transfer.ts";

export const lensPlugin = {
    name: "Lens",
    description: "Lens Plugin for Eliza",
    actions: [transfer],
    evaluators: [],
    providers: [],
};

export default lensPlugin;

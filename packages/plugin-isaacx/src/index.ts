import { Plugin } from "@elizaos/core";
import { answerResearchQuestion } from "./actions/answer-research-question";
import { isaacXProvider } from "./providers/isaacx";

export const isaacXPlugin: Plugin = {
    name: "isaacXPlugin",
    description: "Isaac X Plugin for academic research queries with citations",
    actions: [answerResearchQuestion],
    evaluators: [],
    providers: [isaacXProvider],
};

export default isaacXPlugin;

import {
    Action,
    ActionExample,
    composeContext,
    Content,
    elizaLogger,
    generateObjectDeprecated,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
} from "@elizaos/core";
import { IsaacXProvider } from "../providers/isaacx";
import { ResearchQuestionContent } from "../types";

function isResearchQuestionContent(
    _runtime: IAgentRuntime,
    content: unknown
): content is ResearchQuestionContent {
    return typeof (content as ResearchQuestionContent).question === "string";
}

const researchTemplate = `Respond with a JSON markdown block containing only the extracted research question. Use null if no question can be determined.

Example response:
\`\`\`json
{
    "question": "What are the latest developments in quantum computing?"
}
\`\`\`

{{recentMessages}}

Given the recent messages, extract the academic or research question being asked.
Only extract questions that require scholarly or academic answers.

Respond with a JSON markdown block containing only the extracted question.`;

export const answerResearchQuestion: Action = {
    name: "ANSWER_RESEARCH_QUESTION",
    similes: [
        "RESEARCH_TOPIC",
        "ACADEMIC_QUERY",
        "SCHOLARLY_SEARCH",
        "ASK_ISAAC",
        "GET_RESEARCH_ANSWER",
        "FIND_ACADEMIC_SOURCES",
        "GET_SCHOLARLY_INFO",
    ],
    description:
        "Ask an academic or research question and get an answer with scholarly citations",
    validate: async (runtime: IAgentRuntime, _message: Memory) => {
        const apiKey = runtime.getSetting("ISAACX_API_KEY");
        return typeof apiKey === "string" && apiKey.startsWith("ix_");
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        let currentState = state;
        if (!currentState) {
            currentState = (await runtime.composeState(message)) as State;
        } else {
            currentState = await runtime.updateRecentMessageState(currentState);
        }

        const researchContext = composeContext({
            state: currentState,
            template: researchTemplate,
        });

        const content = await generateObjectDeprecated({
            runtime,
            context: researchContext,
            modelClass: ModelClass.LARGE,
        });

        if (!isResearchQuestionContent(runtime, content)) {
            if (callback) {
                callback({
                    text: "Unable to process research question. Please ask an academic or scholarly question.",
                    content: { error: "Invalid research question" },
                });
            }
            return false;
        }

        try {
            const isaacXProvider = new IsaacXProvider(runtime);
            const response = await isaacXProvider.answerResearchQuestion(
                content.question
            );

            if (callback) {
                callback({
                    text: `Research Findings:
${response.answer}

Academic Sources:
${response.references.join("\n")}`,
                });
            }
            return true;
        } catch (e) {
            elizaLogger.error("Failed to get research answer:", e.message);
            if (callback) {
                callback({
                    text: `Failed to retrieve research findings: ${e.message}`,
                });
            }
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What are the recent breakthroughs in CRISPR gene editing technology?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll search academic sources for information about recent CRISPR developments.",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Can you research the impact of meditation on cognitive function?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll look up scholarly research about meditation's effects on cognition.",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;

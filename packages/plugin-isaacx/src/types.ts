import type { Content } from "@elizaos/core";

/**
 * Configuration options for the Isaac X provider
 */
export interface IsaacXProviderOptions {
    apiUrl: string;
}

/**
 * Response structure from the Isaac X API
 */
export interface IsaacXResponse {
    answer: string;
    references: string[];
}

/**
 * Content structure for research question actions
 */
export interface ResearchQuestionContent extends Content {
    question: string;
} 
import type { IAgentRuntime, Provider, Memory, State } from "@elizaos/core";
import type { IsaacXProviderOptions, IsaacXResponse } from "../types";

const DEFAULT_ISAACX_CONFIG: IsaacXProviderOptions = {
    apiUrl: "https://api.isaacx.ai",
};

export class IsaacXProvider {
    private apiKey: string | null = null;
    private requestCount: number = 0;
    private lastRequestDate: Date = new Date();

    async initialize(
        runtime: IAgentRuntime,
        options: IsaacXProviderOptions = DEFAULT_ISAACX_CONFIG
    ) {
        const apiKey = runtime.getSetting("ISAACX_API_KEY");
        if (!apiKey) throw new Error("ISAACX_API_KEY is not configured");

        this.apiKey = apiKey;
    }

    constructor(
        runtime: IAgentRuntime,
        options: IsaacXProviderOptions = DEFAULT_ISAACX_CONFIG
    ) {
        this.initialize(runtime, options);
    }

    async answerResearchQuestion(question: string): Promise<IsaacXResponse> {
        if (!this.apiKey) {
            throw new Error("Isaac X API is not configured.");
        }

        const response = await fetch(`${DEFAULT_ISAACX_CONFIG.apiUrl}/qa`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": this.apiKey,
            },
            body: JSON.stringify({ question }),
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }

        return await response.json();
    }

    async getStatus(): Promise<string> {
        const today = new Date().toDateString();
        if (today !== this.lastRequestDate.toDateString()) {
            this.requestCount = 0;
        }

        return `Isaac X Research API is available for academic queries.
Features:
- Research-grade AI responses
- Academic citations
- ${10 - this.requestCount}/10 free requests remaining today
- 40 $ISAACX per request`;
    }
}

export const isaacXProvider: Provider = {
    async get(
        runtime: IAgentRuntime,
        _message: Memory,
        _state?: State
    ): Promise<string | null> {
        if (!runtime.getSetting("ISAACX_API_KEY")) {
            return null;
        }

        try {
            const provider = new IsaacXProvider(runtime);
            await provider.initialize(runtime);
            return await provider.getStatus();
        } catch (e) {
            console.error("Error during configuring Isaac X provider", e);
            return null;
        }
    },
};

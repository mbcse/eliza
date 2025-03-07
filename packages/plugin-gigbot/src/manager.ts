import { type Client, elizaLogger, type IAgentRuntime } from "@elizaos/core";
import { ClientBase } from "./base";
import { validateGigConfig, type GigConfig } from "./environment";
import { GigSearchClient } from "./search";
import { GigActionClient } from "./actions";
import { GigClaimClient } from "./claim";

/**
 * A manager that orchestrates all GigBot-related logic:
 * - client: base operations (login, API connection, etc.)
 * - search: finding and analyzing gigs
 * - actions: performing gig-related actions
 */
class GigManager {
    client: ClientBase;
    search: GigSearchClient;
    actions: GigActionClient;
    claim: GigClaimClient;

    constructor(runtime: IAgentRuntime, gigConfig: GigConfig) {
        this.client = new ClientBase(runtime, gigConfig);
        this.search = new GigSearchClient(this.client, runtime);
        this.actions = new GigActionClient(this.client, runtime);
        this.claim = new GigClaimClient(this.client, runtime);
    }
}

export const GigClientInterface: Client = {
    async start(runtime: IAgentRuntime) {
        const gigConfig = await validateGigConfig(runtime);
        
        elizaLogger.log("GigBot client started");
        
        const manager = new GigManager(runtime, gigConfig);
        
        // Initialize API connection
        await manager.client.init();
        
        // Start all the loops
        await manager.search.start();
        await manager.actions.start();
        await manager.claim.start();
        
        return manager;
    },

    async stop(_runtime: IAgentRuntime) {
        elizaLogger.warn("GigBot client does not support stopping yet");
    },
};

export default GigClientInterface; 
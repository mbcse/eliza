import {
  elizaLogger,
  type IAgentRuntime,
  type Memory,
  type UUID,
  stringToUuid,
  getEmbeddingZeroVector,
} from '@elizaos/core';
import type { ClientBase } from './base';
import { Gig } from './types';

export class GigSearchClient {
  client: ClientBase;
  runtime: IAgentRuntime;
  private isProcessing = false;
  private lastProcessTime = 0;

  constructor(client: ClientBase, runtime: IAgentRuntime) {
    this.client = client;
    this.runtime = runtime;
  }

  async start() {
    const searchLoop = () => {
      this.searchGigs();
      const intervalHours = parseInt(this.client.gigConfig.GIG_SEARCH_INTERVAL, 10);
      setTimeout(searchLoop, intervalHours * 3600 * 1000);
    };
    setTimeout(searchLoop, 15 * 1000); // 15 seconds
  }

  private async searchGigs() {
    if (this.isProcessing) {
      elizaLogger.warn('Skipping gig search - already in progress');
      return;
    }

    try {
      this.isProcessing = true;
      elizaLogger.log('Starting gig search cycle');

      elizaLogger.log(`Fetching gigs from ${this.client.gigConfig.GIGBOT_API_URL}/gigs`);
      const response = await fetch(`${this.client.gigConfig.GIGBOT_API_URL}/gigs?status=active`, {
        headers: this.client.apiClient.headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch gigs: ${response.status}`);
      }

      const gigs: { data: Gig[] } = await response.json();

      for (const gig of gigs.data) {
        elizaLogger.debug(`Processing gig`, {
          id: gig.id,
          type: gig.gig_type.display.x.label,
          platform: gig.platform,
        });
        await this.processGig(gig);
      }

      this.lastProcessTime = Date.now();
      elizaLogger.debug(
        `Completed gig search cycle. Next cycle in ${this.client.gigConfig.GIG_SEARCH_INTERVAL} hours`,
      );
    } catch (error) {
      elizaLogger.error('Error searching gigs:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processGig(gig: Gig) {
    const roomId = this.createGigRoomId(gig.id.toString());
    elizaLogger.debug(`Processing gig ${gig.id}`, { roomId });

    // Check for existing
    const existing = await this.runtime.messageManager.getMemoriesByRoomIds({
      roomIds: [roomId],
    });

    if (existing.length > 0) {
      elizaLogger.debug(`Gig ${gig.id} already processed, skipping`, {
        existingMemories: existing.length,
      });
      return;
    }

    // Store gig directly without analysis
    const memory: Memory = {
      id: stringToUuid(gig.id),
      userId: this.runtime.agentId,
      agentId: this.runtime.agentId,
      roomId,
      content: {
        text: `${gig.gig_type.display.x.label}\n\n${gig.how_to_earn}`,
        source: 'gigbot',
        metadata: {
          ...gig,
        },
      },
      embedding: getEmbeddingZeroVector(),
      createdAt: Date.parse(gig.created_at),
    };
    await this.runtime.messageManager.createMemory(memory, true);
  }

  private createGigRoomId(gigId: string): UUID {
    return stringToUuid(`gig-${gigId}-${this.runtime.agentId}`);
  }
}

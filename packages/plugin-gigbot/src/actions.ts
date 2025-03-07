import {
  elizaLogger,
  type IAgentRuntime,
  type Memory,
  type UUID,
  stringToUuid,
  getEmbeddingZeroVector,
} from '@elizaos/core';
import type { ClientBase } from './base';
import { GigHandlerManager } from './handlers/base';
import { gigService } from './services/gig.service';
import { Gig } from './types';

export type PlatformTask = {
  platform: 'x' | 'farcaster';
  type: 'boost' | 'like' | 'follow' | 'comment';
  targetUrl?: string;
  targetId?: string;
};

export class GigActionClient {
  client: ClientBase;
  runtime: IAgentRuntime;
  handlerManager: GigHandlerManager;
  private isProcessing = false;
  private activeGigs: Set<string> = new Set();

  constructor(client: ClientBase, runtime: IAgentRuntime) {
    this.client = client;
    this.runtime = runtime;
    this.handlerManager = new GigHandlerManager(runtime);
    // console.log("clients", runtime.clients);
    // console.log("twitter client", runtime.clients.twitter.client.twitterClient);
  }

  async start() {
    const actionLoop = () => {
      this.processActions();
      const intervalHours = parseInt(this.client.gigConfig.GIG_ACTION_INTERVAL, 10);
      setTimeout(actionLoop, intervalHours * 3600 * 1000);
    };
    setTimeout(actionLoop, 45 * 1000); // 45 seconds
  }

  private async processActions() {
    if (this.isProcessing) {
      elizaLogger.debug('Skipping action processing - already in progress');
      return;
    }

    try {
      this.isProcessing = true;
      elizaLogger.log('Starting action processing cycle');

      const gigs = await gigService.getGigs();
      if (!gigs?.length) return;

      // Get completed gigs
      const completedGigRoomIds = gigs.map(gig => 
        this.createCompletedGigRoomId(gig.id.toString())
      );
      const completedMemories = await this.runtime.messageManager.getMemoriesByRoomIds({
        roomIds: completedGigRoomIds,
      });
      const completedGigIds = new Set(
        completedMemories.map(memory => 
          (memory.content.metadata as Gig).id.toString()
        )
      );

      // Get uncompleted gigs
      const gigsToProcess = gigs.filter(gig => 
        !completedGigIds.has(gig.id.toString())
      );
      
      const memories = await this.runtime.messageManager.getMemoriesByRoomIds({
        roomIds: gigsToProcess.map(gig => this.createGigRoomId(gig.id.toString())),
      });

      // Process each gig
      for (const memory of memories) {
        await this.handleGigAction(memory);
      }
    } catch (error) {
      elizaLogger.error('Error processing gig actions:', error);
    } finally {
      this.isProcessing = false;
      elizaLogger.debug('Completed action processing cycle');
    }
  }

  private determineTask(gig: Gig): PlatformTask | null {
    const gigType = gig.gig_type.id;
    const platform = gig.platform.toLowerCase() as 'x' | 'farcaster';
    const url = gig.external_url;

    // Map gig types to actions
    switch (gigType) {
      case 'boost':
      case 'retweet':
        return {
          platform,
          type: 'boost',
          targetUrl: url,
        };

      case 'like':
        return {
          platform,
          type: 'like',
          targetUrl: url,
        };

      default:
        elizaLogger.debug(`Unknown gig type: ${gigType}`);
        return null;
    }
  }

  private async handleGigAction(memory: Memory) {
    const metadata = memory.content.metadata as Gig;
    if (!metadata) {
      elizaLogger.debug('Skipping memory - no metadata found', { memoryId: memory.id });
      return;
    }

    const gigId = metadata.id.toString();
    elizaLogger.info(`Processing gig: ${gigId}`);

    if (this.activeGigs.has(gigId)) {
      elizaLogger.debug(`Gig ${gigId} is already being processed`);
      return;
    }

    // Double check completion status
    if (await this.isGigCompleted(gigId)) {
      elizaLogger.debug(`Gig ${gigId} was already completed`);
      console.log(`Gig ${gigId} already completed`);
      return;
    }

    try {
      this.activeGigs.add(gigId);
      elizaLogger.debug(`Added gig ${gigId} to active gigs`);

      const task = this.determineTask(metadata);
      if (!task) {
        elizaLogger.debug(`No action determined for gig ${gigId}`);
        return;
      }

      elizaLogger.debug(`Executing ${task.platform} ${task.type} for gig ${gigId}`);
      const success = await this.handlerManager.getHandler(task.platform).executeTask(task);

      if (success) {
        elizaLogger.debug(`Successfully completed gig ${gigId}`);
        await this.markGigAsCompleted(metadata);
        // TODO: Submit proof to GigBot API
      } else {
        elizaLogger.error(`Failed to complete gig ${gigId}`);
      }
    } catch (error) {
      console.log('error', error);
      elizaLogger.error(`Error handling gig ${gigId}:`, error);
    } finally {
      this.activeGigs.delete(gigId);
      elizaLogger.debug(`Removed gig ${gigId} from active gigs`);
    }
  }

  private createGigRoomId(gigId: string): UUID {
    return stringToUuid(`gig-${gigId}-${this.runtime.agentId}`);
  }

  private createCompletedGigRoomId(gigId: string): UUID {
    return stringToUuid(`gig-completed-${gigId}-${this.runtime.agentId}`);
  }

  private async markGigAsCompleted(gig: Gig) {
    const roomId = this.createCompletedGigRoomId(gig.id.toString());
    console.log(`Marking gig ${gig.id} as completed with roomId:`, roomId);

    const memory: Memory = {
      id: stringToUuid(`completed-${gig.id}`),
      userId: this.runtime.agentId,
      agentId: this.runtime.agentId,
      roomId,
      content: {
        text: `Completed gig: ${gig.gig_type.display.x.label}`,
        source: 'gigbot-completed',
        metadata: {
          ...gig,
          completedAt: Date.now(),
        },
      },
      embedding: getEmbeddingZeroVector(),
      createdAt: Date.now(),
    };

    try {
      await this.runtime.messageManager.createMemory(memory, true);
      console.log(`Successfully marked gig ${gig.id} as completed`);
    } catch (error) {
      console.error(`Error marking gig ${gig.id} as completed:`, error);
    }
  }

  private async isGigCompleted(gigId: string): Promise<boolean> {
    const roomId = this.createCompletedGigRoomId(gigId);
    console.log(`Checking completion for gig ${gigId} with roomId:`, roomId);

    try {
      const memories = await this.runtime.messageManager.getMemoriesByRoomIds({
        roomIds: [roomId],
      });
      // console.log(`Found ${memories.length} completion memories for gig ${gigId}`);
      console.log(`Gig ${gigId} is completed:`, memories.length > 0);
      return memories.length > 0;
    } catch (error) {
      console.error(`Error checking gig ${gigId} completion:`, error);
      return false;
    }
  }
}

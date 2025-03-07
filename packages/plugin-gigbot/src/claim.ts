import { type IAgentRuntime, type UUID, stringToUuid } from '@elizaos/core';
import type { ClientBase } from './base';
import { GigHandlerManager } from './handlers/base';

export class GigClaimClient {
  client: ClientBase;
  runtime: IAgentRuntime;
  handlerManager: GigHandlerManager;

  private isProcessing = false;

  constructor(client: ClientBase, runtime: IAgentRuntime) {
    this.client = client;
    this.runtime = runtime;
    this.handlerManager = new GigHandlerManager(runtime);
  }

  async start() {
    const claimLoop = () => {
      this.processClaims();
      const intervalHours = parseInt(this.client.gigConfig.GIG_CLAIM_INTERVAL, 10);
      setTimeout(claimLoop, intervalHours * 3600 * 1000);
    };
    setTimeout(claimLoop, 90 * 1000); // 90 seconds
  }

  private async processClaims() {
    if (this.isProcessing) {
      console.log('Skipping claim processing - already in progress');
      return;
    }

    try {
      this.isProcessing = true;

      const handler = this.handlerManager.getHandler(this.client.gigConfig.GIG_CLAIM_PLATFORM);
      const success = await handler.claimRewards();

      if (success) {
        await this.storeClaimMemory();
      }
    } catch (error) {
      console.error('Error processing claims:', error);
    } finally {
      this.isProcessing = false;
      console.log('Completed claim processing cycle');
    }
  }

  private async storeClaimMemory() {
    const now = Date.now();
    const date = new Date(now).toISOString();
    const roomId = this.createClaimRoomId(now.toString());
    console.log(`Storing claim memory for gig ${now}`);

    const memory = {
      id: stringToUuid(`claim-${now}`),
      userId: this.runtime.agentId,
      agentId: this.runtime.agentId,
      roomId,
      content: {
        text: `Claimed reward at ${date}`,
        source: 'gigbot-claimed',
        metadata: {
          claimedAt: date,
          platform: 'x',
        },
      },
      createdAt: Date.now(),
    };

    await this.runtime.messageManager.createMemory(memory, true);
    console.log(`Successfully stored claim memory for gig ${now}`);
  }

  private createClaimRoomId(gigId: string): UUID {
    return stringToUuid(`gig-claimed-${gigId}-${this.runtime.agentId}`);
  }
}

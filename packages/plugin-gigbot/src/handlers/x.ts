import { elizaLogger, IAgentRuntime } from '@elizaos/core';
import { PlatformTask } from '../actions';
import { PrivateKeyAccount, privateKeyToAccount } from 'viem/accounts';
import { gigService } from '../services/gig.service';
import { GigHandler } from './base';

export class XGigHandler implements GigHandler {
  private wallet: PrivateKeyAccount;
  constructor(private runtime: IAgentRuntime) {
    if (this.runtime.getSetting('EVM_PRIVATE_KEY')) {
      this.wallet = privateKeyToAccount(this.runtime.getSetting('EVM_PRIVATE_KEY') as `0x${string}`);
    }
  }
  async executeTask(task: PlatformTask): Promise<boolean> {
    const twitterManager = this.runtime.clients.find(client => 
      typeof client === 'object' && 'client' in client && 'twitterClient' in (client as any).client
  ) as any
    if (!twitterManager) {
      elizaLogger.error('Twitter client not available');
      return false;
    }
    switch (task.type) {
      case 'boost':
        const tweetId = await this.extractPostId(task.targetUrl);
        console.log('tweet id: ', tweetId);

        await Promise.all([twitterManager.client.twitterClient.retweet(tweetId), twitterManager.client.twitterClient.likeTweet(tweetId)]);
        return true;
    }
  }
  async extractPostId(url: string): Promise<string | null> {
    if (!url) return null;
    const match = url.match(/(?:twitter|x)\.com\/\w+\/status\/(\d+)/);
    return match ? match[1] : null;
  }

  async claimRewards(): Promise<boolean> {
    const twitterManager = this.runtime.clients.find(client => 
      typeof client === 'object' && 'client' in client && 'twitterClient' in (client as any).client
    ) as any;

    if (!twitterManager) {
      elizaLogger.error('Twitter client not available');
      return false;
    }

    const res = await twitterManager.client.twitterClient.sendTweet(`@gigbot_ Claim my rewards ${this.wallet?.address}`);

    if (!res.ok) {
      elizaLogger.error('Failed to claim rewards');
      return false;
    }

    return true;
  }
}

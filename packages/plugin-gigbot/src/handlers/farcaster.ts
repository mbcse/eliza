import { elizaLogger, IAgentRuntime } from '@elizaos/core';
import { PlatformTask } from '../actions';
import { getFarcasterCastByHash, getFarcasterCastByUrl, postFarcasterCast, postFarcasterReaction } from '../utils';
import { PrivateKeyAccount, privateKeyToAccount } from 'viem/accounts';
import { gigService } from '../services/gig.service';
import { GigHandler } from './base';

export class FarcasterGigHandler implements GigHandler {
  private wallet: PrivateKeyAccount;
  constructor(private runtime: IAgentRuntime) {
    if (this.runtime.getSetting('EVM_PRIVATE_KEY')) {
      this.wallet = privateKeyToAccount(this.runtime.getSetting('EVM_PRIVATE_KEY') as `0x${string}`);
    }
  }

  async executeTask(task: PlatformTask): Promise<boolean> {
    const signerUuid = this.runtime.getSetting('FARCASTER_NEYNAR_SIGNER_UUID');
    const neynarApiKey = this.runtime.getSetting('FARCASTER_NEYNAR_API_KEY');
    const castHash = await this.extractPostId(task.targetUrl, neynarApiKey);
    if (!castHash || !signerUuid || !neynarApiKey) {
      elizaLogger.error('Cast hash or signer uuid or neynar api key not found');
      return false;
    }

    switch (task.type) {
      case 'boost':
        await Promise.all([
          postFarcasterReaction({
            reactionType: 'recast',
            castHash,
            signerUuid,
            neynarApiKey,
          }),
          postFarcasterReaction({
            reactionType: 'like',
            castHash,
            signerUuid,
            neynarApiKey,
          }),
        ]);
        return true;
      default:
        return false;
    }
  }

  async extractPostId(url: string, apiKey?: string) {
    const {
      cast: { hash },
    } = await getFarcasterCastByUrl(url, apiKey);

    return hash;
  }

  async claimRewards(): Promise<boolean> {
    const signerUuid = this.runtime.getSetting('FARCASTER_NEYNAR_SIGNER_UUID');
    const neynarApiKey = this.runtime.getSetting('FARCASTER_NEYNAR_API_KEY');

    if (!signerUuid || !neynarApiKey) {
      elizaLogger.error('Signer uuid or neynar api key not found');
      return false;
    }

    const { success } = await postFarcasterCast({
      text: `@gigbot.eth Claim my rewards ${this.wallet.address}`,
      signerUuid,
      neynarApiKey,
    });

    if (!success) {
      elizaLogger.error('Failed to post claim cast');
      return false;
    }

    return true;
  }
}

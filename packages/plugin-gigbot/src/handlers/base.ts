import { IAgentRuntime } from '@elizaos/core';
import { PlatformTask } from '../actions';
import { PrivateKeyAccount, privateKeyToAccount } from 'viem/accounts';
import { FarcasterGigHandler } from './farcaster';
import { XGigHandler } from './x';

export interface GigHandler {
  executeTask(task: PlatformTask): Promise<boolean>;
  claimRewards(): Promise<boolean>;
  extractPostId(url: string, apiKey?: string): Promise<string | null>;
}

export class GigHandlerManager {
  private handlers: Map<string, GigHandler> = new Map();
  private wallet: PrivateKeyAccount;
  constructor(private runtime: IAgentRuntime) {
    this.handlers.set('x', new XGigHandler(runtime));
    this.handlers.set('farcaster', new FarcasterGigHandler(runtime));
    if (this.runtime.getSetting('EVM_PRIVATE_KEY')) {
      this.wallet = privateKeyToAccount(this.runtime.getSetting('EVM_PRIVATE_KEY') as `0x${string}`);
    }
  }

  getHandler(platform: 'x' | 'farcaster'): GigHandler {
    return this.handlers.get(platform) || new DefaultGigHandler(this.runtime);
  }

  getWallet(): PrivateKeyAccount | undefined {
    return this.wallet;
  }
}

class DefaultGigHandler implements GigHandler {
  constructor(private runtime: IAgentRuntime) {}

  async executeTask(task: PlatformTask): Promise<boolean> {
    return false;
  }

  async extractPostId(url: string): Promise<string | null> {
    return null;
  }

  async claimRewards(): Promise<boolean> {
    return false;
  }
}

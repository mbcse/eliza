import { type IAgentRuntime, elizaLogger } from '@elizaos/core';
import type { GigConfig } from './environment';

export class ClientBase {
  runtime: IAgentRuntime;
  gigConfig: GigConfig;
  apiClient: any; // TODO: Replace with actual API client type

  constructor(runtime: IAgentRuntime, gigConfig: GigConfig) {
    this.runtime = runtime;
    this.gigConfig = gigConfig;
  }

  async init() {
    try {
      // Initialize API client with config
      this.apiClient = {
        baseURL: this.gigConfig.GIGBOT_API_URL,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      // Test connection
      const response = await fetch(`${this.gigConfig.GIGBOT_API_URL}/gigs?status=active`, {
        headers: this.apiClient.headers,
      });

      if (!response.ok) {
        throw new Error('Failed to connect to GigBot API');
      }

      elizaLogger.log('Successfully connected to GigBot API');
    } catch (error) {
      elizaLogger.error('Error initializing GigBot client:', error);
      throw error;
    }
  }
}

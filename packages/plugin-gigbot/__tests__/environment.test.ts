import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateGigConfig, gigEnvSchema } from '../src/environment';
import type { IAgentRuntime } from '@elizaos/core';

describe('Gig Environment Configuration', () => {
  let mockRuntime: IAgentRuntime;

  beforeEach(() => {
    mockRuntime = {
      getSetting: vi.fn(),
    } as unknown as IAgentRuntime;

    // Clear process.env before each test
    process.env = {};
  });

  it('uses default values when no config is provided', async () => {
    vi.mocked(mockRuntime.getSetting).mockImplementation(() => null);

    // Should throw since EVM_PRIVATE_KEY is required
    await expect(validateGigConfig(mockRuntime)).rejects.toThrow()
  });

  it('prioritizes runtime settings over process.env', async () => {
    const runtimeConfig = {
      GIGBOT_API_URL: 'https://runtime.example.com',
      GIG_SEARCH_INTERVAL: '5',
      GIG_ACTION_INTERVAL: '15',
      GIG_CLAIM_INTERVAL: '30',
      GIG_CLAIM_PLATFORM: 'x',
      EVM_PRIVATE_KEY: '0x1234567890abcdef'
    };

    process.env = {
      GIGBOT_API_URL: 'https://env.example.com',
      GIG_SEARCH_INTERVAL: '1',
      GIG_ACTION_INTERVAL: '2',
      GIG_CLAIM_INTERVAL: '3',
      GIG_CLAIM_PLATFORM: 'farcaster',
      EVM_PRIVATE_KEY: '0xdeadbeef'
    };

    vi.mocked(mockRuntime.getSetting).mockImplementation((key: string) => runtimeConfig[key as keyof typeof runtimeConfig]);

    const config = await validateGigConfig(mockRuntime);
    expect(config).toEqual(runtimeConfig);
  });

  it('uses process.env when runtime settings are undefined', async () => {
    vi.mocked(mockRuntime.getSetting).mockImplementation(() => null);

    process.env = {
      GIGBOT_API_URL: 'https://env.example.com',
      GIG_SEARCH_INTERVAL: '1',
      GIG_ACTION_INTERVAL: '2',
      GIG_CLAIM_INTERVAL: '3',
      GIG_CLAIM_PLATFORM: 'farcaster',
      EVM_PRIVATE_KEY: '0x1234567890abcdef'
    };

    const config = await validateGigConfig(mockRuntime);
    expect(config).toEqual(process.env);
  });

  it('transforms empty interval values to defaults', async () => {
    const configWithEmpty = {
      GIGBOT_API_URL: 'https://example.com',
      GIG_SEARCH_INTERVAL: '',
      GIG_ACTION_INTERVAL: '12',
      GIG_CLAIM_INTERVAL: '24',
      GIG_CLAIM_PLATFORM: 'x',
      EVM_PRIVATE_KEY: '0x1234567890abcdef'
    }

    vi.mocked(mockRuntime.getSetting).mockImplementation((key: string) => configWithEmpty[key as keyof typeof configWithEmpty])

    const config = await validateGigConfig(mockRuntime)
    expect(config.GIG_SEARCH_INTERVAL).toBe('3') // Should use default value
  });

  describe('validation errors', () => {
    it('throws error for missing EVM_PRIVATE_KEY', async () => {
      const configWithoutKey = {
        GIGBOT_API_URL: 'https://example.com',
        GIG_SEARCH_INTERVAL: '3',
        GIG_ACTION_INTERVAL: '12',
        GIG_CLAIM_INTERVAL: '24',
        GIG_CLAIM_PLATFORM: 'x'
      };

      vi.mocked(mockRuntime.getSetting).mockImplementation((key: string) => configWithoutKey[key as keyof typeof configWithoutKey]);

      await expect(validateGigConfig(mockRuntime)).rejects.toThrow();
    });

    it('throws error for invalid EVM_PRIVATE_KEY format', async () => {
      const configWithInvalidKey = {
        GIGBOT_API_URL: 'https://example.com',
        GIG_SEARCH_INTERVAL: '3',
        GIG_ACTION_INTERVAL: '12',
        GIG_CLAIM_INTERVAL: '24',
        GIG_CLAIM_PLATFORM: 'x',
        EVM_PRIVATE_KEY: 'invalid-key'
      };

      vi.mocked(mockRuntime.getSetting).mockImplementation((key: string) => configWithInvalidKey[key as keyof typeof configWithInvalidKey]);

      await expect(validateGigConfig(mockRuntime)).rejects.toThrow();
    });

    it('throws error for invalid GIG_CLAIM_PLATFORM value', async () => {
      vi.mocked(mockRuntime.getSetting).mockImplementation(() => 'invalid_platform');

      await expect(validateGigConfig(mockRuntime)).rejects.toThrow();
    });

    it('throws error for invalid URL format', async () => {
      const invalidConfig = {
        GIGBOT_API_URL: 'not-a-url',
        GIG_SEARCH_INTERVAL: '3',
        GIG_ACTION_INTERVAL: '12',
        GIG_CLAIM_INTERVAL: '24',
        GIG_CLAIM_PLATFORM: 'x'
      };

      vi.mocked(mockRuntime.getSetting).mockImplementation((key: string) => invalidConfig[key as keyof typeof invalidConfig]);

      await expect(validateGigConfig(mockRuntime)).rejects.toThrow();
    });
  });

  describe('schema validation', () => {
    it('validates schema directly with valid data', () => {
      const validData = {
        GIGBOT_API_URL: 'https://example.com',
        GIG_SEARCH_INTERVAL: '5',
        GIG_ACTION_INTERVAL: '10',
        GIG_CLAIM_INTERVAL: '15',
        GIG_CLAIM_PLATFORM: 'farcaster' as const,
        EVM_PRIVATE_KEY: '0x1234567890abcdef'
      };

      const result = gigEnvSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    it('applies default values for missing fields', () => {
      const partialData = {
        EVM_PRIVATE_KEY: '0x1234567890abcdef'
      };
      
      const result = gigEnvSchema.parse(partialData);
      expect(result).toEqual({
        GIGBOT_API_URL: 'https://www.gigbot.xyz/api',
        GIG_SEARCH_INTERVAL: '3',
        GIG_ACTION_INTERVAL: '12',
        GIG_CLAIM_INTERVAL: '24',
        GIG_CLAIM_PLATFORM: 'x',
        EVM_PRIVATE_KEY: '0x1234567890abcdef'
      });
    });
  });
});
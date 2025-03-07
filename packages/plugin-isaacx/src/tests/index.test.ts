import { isaacXPlugin } from '../index';
import { IsaacXProvider } from '../providers/isaacx';
import { describe, expect, it, vi } from 'vitest';

// Simple mock runtime with just what we need
const mockRuntime = {
    getSetting: vi.fn()
};

describe('IsaacX Plugin', () => {
    it('should have correct structure', () => {
        expect(isaacXPlugin.name).toBe('isaacXPlugin');
        expect(isaacXPlugin.description).toBe('Isaac X Plugin for academic research queries with citations');
        expect(isaacXPlugin.actions).toHaveLength(1);
        expect(isaacXPlugin.providers).toHaveLength(1);
        expect(isaacXPlugin.evaluators).toHaveLength(0);
    });

    it('should have ASK_RESEARCH_QUESTION action with correct properties', () => {
        const action = isaacXPlugin.actions[0];
        expect(action.name).toBe('ANSWER_RESEARCH_QUESTION');
        expect(action.description).toBeDefined();
        expect(action.similes).toBeInstanceOf(Array);
        expect(action.handler).toBeInstanceOf(Function);
    });

    describe('IsaacXProvider', () => {
        it('should handle missing API key', async () => {
            mockRuntime.getSetting.mockReturnValue(null);
            const provider = new IsaacXProvider(mockRuntime as any);
            
            await expect(provider.initialize(mockRuntime as any))
                .rejects.toThrow('ISAACX_API_KEY is not configured');
        });

        it('should initialize with valid API key', async () => {
            mockRuntime.getSetting.mockReturnValue('ix_test_key');
            const provider = new IsaacXProvider(mockRuntime as any);
            
            await expect(provider.initialize(mockRuntime as any))
                .resolves.not.toThrow();
        });
    });
});
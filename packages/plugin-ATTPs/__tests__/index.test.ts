import { vi, describe, it, expect } from 'vitest';

vi.mock('@elizaos/core', () => ({
    Plugin: class {},
    Action: class {},
    composeContext: vi.fn(),
    elizaLogger: {
        info: vi.fn(),
        error: vi.fn()
    },
    generateObject: vi.fn(),
    ModelClass: {
        LARGE: 'LARGE'
    }
}));

vi.mock('attps-sdk-js', () => ({
    ATTPsSDK: {
        createAndRegisterAgent: vi.fn(),
        verify: vi.fn()
    },
    AgentSettings: class {},
    VerifyParams: class {},
    parseNewAgentAddress: vi.fn()
}));

import { attpsPlugin } from '../src';

describe('attpsPlugin', () => {
    it('should have correct plugin metadata', () => {
        expect(attpsPlugin.name).toBe('ATTPs');
        expect(attpsPlugin.description).toBe('ATTPs Plugin for Eliza');
    });

    it('should register all required actions', () => {
        expect(attpsPlugin.actions).toHaveLength(3);
        
        const actionNames = attpsPlugin.actions?.map(action => action.name);
        expect(actionNames).toContain('CREATE_AND_REGISTER_AGENT');
        expect(actionNames).toContain('VERIFY');
        expect(actionNames).toContain('ATTPS_PRICE_QUERY');
    });

    it('should have correct similes for each action', () => {
        const createAction = attpsPlugin.actions?.find(a => a.name === 'CREATE_AND_REGISTER_AGENT');
        expect(createAction?.similes).toContain('CREATE_AGENT');
        expect(createAction?.similes).toContain('REGISTER_AGENT');

        const verifyAction = attpsPlugin.actions?.find(a => a.name === 'VERIFY');
        expect(verifyAction?.similes).toContain('VERIFY_DATA');

        const priceAction = attpsPlugin.actions?.find(a => a.name === 'ATTPS_PRICE_QUERY');
        expect(priceAction?.similes).toContain('ATTPS_PRICE_FETCH');
    });
});

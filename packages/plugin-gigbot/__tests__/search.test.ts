import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GigSearchClient } from '../src/search';
import { ClientBase } from '../src/base';
import type { GigConfig } from '../src/environment';
import type { Gig } from '../src/types';

// Mock @elizaos/core
vi.mock('@elizaos/core', () => ({
    elizaLogger: {
        debug: vi.fn(),
        error: vi.fn()
    },
    stringToUuid: (str: string) => str,
    getEmbeddingZeroVector: () => new Array(1536).fill(0)
}));

describe('GigSearchClient', () => {
    let mockRuntime: any;
    let mockConfig: GigConfig;
    let baseClient: ClientBase;
    let searchClient: GigSearchClient;

    const mockGig: Gig = {
        id: 123,
        created_at: '2024-03-20T12:00:00Z',
        start_time_ms: Date.now(),
        end_time_ms: Date.now() + 86400000,
        duration_ms: 86400000,
        amount: '100',
        payout_interval_ms: 3600000,
        how_to_earn: 'Test instructions',
        earning_criteria: 'Test criteria',
        ticker: 'TEST',
        gigbot_transactions_id: 1,
        platform: 'x',
        external_url: 'https://x.com/test/status/123',
        token: {
            id: 1,
            image_url: 'https://test.com/image.png',
            symbol: 'TEST',
            coingecko_id: 'test',
            address: '0x123',
            decimals: 18
        },
        chain: {
            id: 1,
            name: 'Test Chain',
            image_url: 'https://test.com/chain.png',
            chain_id: 1
        },
        gig_type: {
            id: 'boost',
            display: {
                x: {
                    icon: '🔄',
                    label: 'Boost Post',
                    filter_id: 'boost',
                    with_input: false,
                    how_to_earn: 'Boost this post',
                    earning_criteria: 'Must boost post',
                    input_placeholder: ''
                },
                farcaster: {
                    icon: '🔄',
                    label: 'Boost Cast',
                    filter_id: 'boost',
                    with_input: false,
                    how_to_earn: 'Boost this cast',
                    earning_criteria: 'Must boost cast',
                    input_placeholder: ''
                }
            }
        }
    };

    beforeEach(() => {
        mockRuntime = {
            agentId: 'test-agent-id',
            messageManager: {
                getMemoriesByRoomIds: vi.fn(),
                createMemory: vi.fn()
            }
        };

        mockConfig = {
            GIGBOT_API_URL: 'https://api.test.com',
            GIG_SEARCH_INTERVAL: '1',
            GIG_ACTION_INTERVAL: '1',
            GIG_CLAIM_INTERVAL: '1',
            GIG_CLAIM_PLATFORM: 'x',
            EVM_PRIVATE_KEY: '0x1234567890abcdef'
        };

        baseClient = {
            gigConfig: mockConfig,
            apiClient: {
                headers: { 'Authorization': 'Bearer test-token' }
            }
        } as unknown as ClientBase;

        searchClient = new GigSearchClient(baseClient, mockRuntime);
        global.fetch = vi.fn();
    });

    it('should create search client instance', () => {
        expect(searchClient).toBeDefined();
        expect(searchClient.client).toBe(baseClient);
        expect(searchClient.runtime).toBe(mockRuntime);
    });

    it('should process new gigs and store in memory', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: [mockGig] })
        } as Response);

        vi.mocked(mockRuntime.messageManager.getMemoriesByRoomIds).mockResolvedValueOnce([]);

        await searchClient['searchGigs']();

        expect(mockRuntime.messageManager.createMemory).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'test-agent-id',
                agentId: 'test-agent-id',
                roomId: expect.any(String),
                content: expect.objectContaining({
                    text: expect.stringContaining('Boost Post'),
                    source: 'gigbot',
                    metadata: expect.objectContaining({
                        id: 123
                    })
                })
            }),
            true
        );
    });

    it('should handle API errors gracefully', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: false,
            status: 500
        } as Response);

        await expect(searchClient['searchGigs']()).resolves.not.toThrow();
    });

    it('should prevent concurrent processing', async () => {
        // Start first processing
        const firstProcess = searchClient['searchGigs']();
        
        // Try to start second processing immediately
        await searchClient['searchGigs']();

        // Verify fetch was only called once
        expect(global.fetch).toHaveBeenCalledTimes(1);

        await firstProcess;
    });

    it('should set up search interval on start', () => {
        vi.useFakeTimers()
        const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
        const intervalHours = parseInt(mockConfig.GIG_SEARCH_INTERVAL, 10)
        
        searchClient.start()
        
        expect(setTimeoutSpy).toHaveBeenCalledWith(
            expect.any(Function),
            intervalHours * 3600 * 1000 // Convert hours to milliseconds
        )
        
        setTimeoutSpy.mockRestore()
        vi.useRealTimers()
    })

    it('should skip already processed gigs', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: [mockGig] })
        } as Response)

        // Mock that we found an existing memory for this gig
        vi.mocked(mockRuntime.messageManager.getMemoriesByRoomIds).mockResolvedValueOnce([{ id: '123' }])

        await searchClient['searchGigs']()

        // Verify memory was not created again
        expect(mockRuntime.messageManager.createMemory).not.toHaveBeenCalled()
    })

    it('should handle malformed API responses', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: [{ ...mockGig, gig_type: undefined }] })
        } as Response)

        await expect(searchClient['searchGigs']()).resolves.not.toThrow()
    })

    it('should handle network timeouts', async () => {
        vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network timeout'))

        await expect(searchClient['searchGigs']()).resolves.not.toThrow()
        expect(mockRuntime.messageManager.createMemory).not.toHaveBeenCalled()
    })

    it('should correctly format gig memory content', async () => {
        const customGig = {
            ...mockGig,
            gig_type: {
                ...mockGig.gig_type,
                display: {
                    x: {
                        ...mockGig.gig_type.display.x,
                        label: 'Custom Label',
                    },
                    farcaster: mockGig.gig_type.display.farcaster
                }
            },
            how_to_earn: 'Custom Instructions'
        }

        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: [customGig] })
        } as Response)

        vi.mocked(mockRuntime.messageManager.getMemoriesByRoomIds).mockResolvedValueOnce([])

        await searchClient['searchGigs']()

        expect(mockRuntime.messageManager.createMemory).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.objectContaining({
                    text: 'Custom Label\n\nCustom Instructions'
                })
            }),
            true
        )
    })

    it('should process multiple gigs in one cycle', async () => {
        const secondGig = { ...mockGig, id: 456 }
        
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: [mockGig, secondGig] })
        } as Response)

        vi.mocked(mockRuntime.messageManager.getMemoriesByRoomIds).mockResolvedValue([])

        await searchClient['searchGigs']()

        expect(mockRuntime.messageManager.createMemory).toHaveBeenCalledTimes(2)
    })

    it('should create unique room IDs for different gigs', () => {
        const roomId1 = searchClient['createGigRoomId']('123')
        const roomId2 = searchClient['createGigRoomId']('456')

        expect(roomId1).not.toBe(roomId2)
    })
});

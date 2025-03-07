import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GigActionClient } from '../src/actions'
import { ClientBase } from '../src/base'
import type { GigConfig } from '../src/environment'
import type { Gig } from '../src/types'
import { gigService } from '../src/services/gig.service'

// Mock @elizaos/core
vi.mock('@elizaos/core', () => ({
    elizaLogger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn()
    },
    stringToUuid: (str: string) => str,
    getEmbeddingZeroVector: () => new Array(1536).fill(0)
}))

// Mock gig service
vi.mock('../src/services/gig.service', () => ({
    gigService: {
        getGigs: vi.fn()
    }
}))

// Mock handler execution
const mockExecuteTask = vi.fn().mockResolvedValue(true)

// Mock the handlers
vi.mock('../src/handlers/base', () => ({
    GigHandlerManager: vi.fn().mockImplementation(() => ({
        getHandler: () => ({
            executeTask: mockExecuteTask
        })
    }))
}))

vi.mock('../src/handlers/x', () => ({
    XGigHandler: vi.fn()
}))

vi.mock('../src/handlers/farcaster', () => ({
    FarcasterGigHandler: vi.fn()
}))

describe('GigActionClient', () => {
    let mockRuntime: any
    let mockConfig: GigConfig
    let baseClient: ClientBase
    let actionClient: GigActionClient
    let getMemoriesMock: any

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
    }

    beforeEach(() => {
        mockExecuteTask.mockClear()
        vi.mocked(gigService.getGigs).mockClear()
        
        getMemoriesMock = vi.fn()
        mockRuntime = {
            agentId: 'test-agent-id',
            messageManager: {
                getMemoriesByRoomIds: getMemoriesMock,
                createMemory: vi.fn()
            }
        }

        mockConfig = {
            GIGBOT_API_URL: 'https://api.test.com',
            GIG_SEARCH_INTERVAL: '1',
            GIG_ACTION_INTERVAL: '1',
            GIG_CLAIM_INTERVAL: '1',
            GIG_CLAIM_PLATFORM: 'x',
            EVM_PRIVATE_KEY: '0x1234567890abcdef'
        }

        baseClient = {
            gigConfig: mockConfig,
            apiClient: {
                headers: { 'Authorization': 'Bearer test-token' }
            }
        } as unknown as ClientBase

        actionClient = new GigActionClient(baseClient, mockRuntime)
    })

    it('should process all uncompleted gigs', async () => {
        const gigs = [
            { ...mockGig, id: 1 },
            { ...mockGig, id: 2 },
            { ...mockGig, id: 3 }
        ]

        // Mock getGigs
        vi.mocked(gigService.getGigs).mockResolvedValueOnce(gigs)

        // Mock completed gigs check - none completed
        getMemoriesMock.mockResolvedValueOnce([])

        // Mock uncompleted gigs memories
        const memories = gigs.map(gig => ({
            id: `gig-${gig.id}`,
            content: {
                metadata: gig,
                text: 'test'
            }
        }))
        getMemoriesMock.mockResolvedValueOnce(memories)

        // Mock individual gig completion checks
        getMemoriesMock.mockResolvedValue([])

        await actionClient['processActions']()

        // Should process all gigs
        expect(mockExecuteTask).toHaveBeenCalledTimes(3)
    })

    it('should prevent concurrent processing', async () => {
        vi.mocked(gigService.getGigs).mockResolvedValue([mockGig])
        getMemoriesMock.mockResolvedValue([])

        const firstProcess = actionClient['processActions']()
        await actionClient['processActions']() // Should return immediately

        expect(gigService.getGigs).toHaveBeenCalledTimes(1)
        await firstProcess
    })

    it('should prevent duplicate gig processing', async () => {
        const gig = { ...mockGig, id: 1 }
        
        vi.mocked(gigService.getGigs).mockResolvedValueOnce([gig])
        getMemoriesMock
            .mockResolvedValueOnce([]) // completed check
            .mockResolvedValueOnce([{  // get memories
                id: `gig-${gig.id}`,
                content: { metadata: gig, text: 'test' }
            }])
            .mockResolvedValue([]) // completion checks

        // Simulate active gig
        actionClient['activeGigs'].add('1')

        await actionClient['processActions']()
        expect(mockExecuteTask).not.toHaveBeenCalled()
    })

    it('should handle failed task execution', async () => {
        mockExecuteTask.mockResolvedValueOnce(false)
        
        vi.mocked(gigService.getGigs).mockResolvedValueOnce([mockGig])
        getMemoriesMock
            .mockResolvedValueOnce([]) // completed check
            .mockResolvedValueOnce([{  // get memories
                id: `gig-${mockGig.id}`,
                content: { metadata: mockGig, text: 'test' }
            }])
            .mockResolvedValue([]) // completion checks

        await actionClient['processActions']()
        expect(mockRuntime.messageManager.createMemory).not.toHaveBeenCalled()
    })

    it('should skip completed gigs', async () => {
        vi.mocked(gigService.getGigs).mockResolvedValueOnce([mockGig])
        getMemoriesMock.mockResolvedValueOnce([{
            content: { metadata: mockGig }
        }])

        await actionClient['processActions']()
        expect(mockExecuteTask).not.toHaveBeenCalled()
    })

    it('should determine correct task type for boost gigs', () => {
        const task = actionClient['determineTask'](mockGig)
        
        expect(task).toEqual({
            platform: 'x',
            type: 'boost',
            targetUrl: mockGig.external_url
        })
    })
}) 
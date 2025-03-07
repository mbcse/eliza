import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GigClaimClient } from '../src/claim'
import { ClientBase } from '../src/base'
import type { GigConfig } from '../src/environment'

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

// Mock handler modules
const mockClaimRewards = vi.fn().mockResolvedValue(true)
const mockGetHandler = vi.fn().mockReturnValue({
    claimRewards: mockClaimRewards
})

vi.mock('../src/handlers/base', () => ({
    GigHandlerManager: vi.fn().mockImplementation(() => ({
        getHandler: mockGetHandler
    }))
}))

describe('GigClaimClient', () => {
    let mockRuntime: any
    let mockConfig: GigConfig
    let baseClient: ClientBase
    let claimClient: GigClaimClient

    beforeEach(() => {
        // Clear mocks
        mockClaimRewards.mockClear()
        mockGetHandler.mockClear()
        
        // Setup memory manager mock
        const getMemoriesMock = vi.fn()
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

        claimClient = new GigClaimClient(baseClient, mockRuntime)
    })

    it('should set up claim interval on start', () => {
        vi.useFakeTimers()
        const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
        const intervalHours = parseInt(mockConfig.GIG_CLAIM_INTERVAL, 10)
        
        claimClient.start()
        
        expect(setTimeoutSpy).toHaveBeenCalledWith(
            expect.any(Function),
            intervalHours * 3600 * 1000
        )
        
        setTimeoutSpy.mockRestore()
        vi.useRealTimers()
    })

    it('should prevent concurrent processing', async () => {
        const firstProcess = claimClient['processClaims']()
        await claimClient['processClaims']()

        expect(mockClaimRewards).toHaveBeenCalledTimes(1)
        await firstProcess
    })

    it('should store claim memory after successful claim', async () => {
        await claimClient['processClaims']()

        expect(mockRuntime.messageManager.createMemory).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.objectContaining({
                    source: 'gigbot-claimed',
                    metadata: expect.objectContaining({
                        platform: 'x'
                    })
                })
            }),
            true
        )
    })

    it('should handle failed claims', async () => {
        mockClaimRewards.mockResolvedValueOnce(false)
        
        await claimClient['processClaims']()
        
        expect(mockRuntime.messageManager.createMemory).not.toHaveBeenCalled()
    })

    it('should use configured claim platform', async () => {
        mockConfig.GIG_CLAIM_PLATFORM = 'farcaster'
        
        await claimClient['processClaims']()
        
        expect(mockGetHandler).toHaveBeenCalledWith('farcaster')
    })

    it('should handle errors during claim processing', async () => {
        mockClaimRewards.mockRejectedValueOnce(new Error('Network error'))
        
        await expect(claimClient['processClaims']()).resolves.not.toThrow()
        expect(mockRuntime.messageManager.createMemory).not.toHaveBeenCalled()
    })

    it('should store correct claim memory data', async () => {
        vi.useFakeTimers()
        const fakeNow = new Date('2024-03-20T12:00:00Z').getTime()
        vi.setSystemTime(fakeNow)
        
        await claimClient['processClaims']()

        expect(mockRuntime.messageManager.createMemory).toHaveBeenCalledWith(
            expect.objectContaining({
                id: `claim-${fakeNow}`,
                userId: 'test-agent-id',
                agentId: 'test-agent-id',
                roomId: `gig-claimed-${fakeNow}-test-agent-id`,
                content: expect.objectContaining({
                    text: `Claimed reward at ${new Date(fakeNow).toISOString()}`,
                    source: 'gigbot-claimed',
                    metadata: {
                        claimedAt: new Date(fakeNow).toISOString(),
                        platform: 'x'
                    }
                }),
                createdAt: fakeNow
            }),
            true
        )
        
        vi.useRealTimers()
    })

    it('should create unique room IDs for different claims', () => {
        const roomId1 = claimClient['createClaimRoomId']('123')
        const roomId2 = claimClient['createClaimRoomId']('456')

        expect(roomId1).not.toBe(roomId2)
    })
}) 
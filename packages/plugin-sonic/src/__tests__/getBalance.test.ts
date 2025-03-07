import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Memory, IAgentRuntime, ModelClass, State } from '@elizaos/core'
import { getBalance } from '../actions/getBalance'

// Mock the core module functions
vi.mock('@elizaos/core', async () => {
    const actual = await vi.importActual('@elizaos/core')
    return {
        ...actual,
        generateObjectDeprecated: vi.fn(),
        composeContext: vi.fn(),
    }
})

// Fix ethers mock
vi.mock('ethers', () => ({
    ethers: {
        JsonRpcProvider: vi.fn(() => ({
            getBalance: vi.fn()
        })),
        formatEther: vi.fn()
    }
}))

// Mock runtime
const mockRuntime = {
    composeState: vi.fn(),
    updateRecentMessageState: vi.fn(),
    getSetting: vi.fn(),
    elizaLogger: {
        info: vi.fn(),
        error: vi.fn(),
    },
} as unknown as IAgentRuntime

describe('getBalance', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should validate successfully', async () => {
        const result = await getBalance.validate(mockRuntime, {} as Memory)
        expect(result).toBe(true)
    })

    it('should fail when no wallet address is provided', async () => {
        // Mock the necessary functions
        const { generateObjectDeprecated } = await import('@elizaos/core')
        vi.mocked(generateObjectDeprecated).mockResolvedValue({ address: '' })
        vi.mocked(mockRuntime.composeState).mockResolvedValue({} as State)
        const mockCallback = vi.fn()

        const result = await getBalance.handler(
            mockRuntime,
            {} as Memory,
            undefined,
            {},
            mockCallback
        )

        expect(result).toBe(false)
        expect(mockCallback).toHaveBeenCalledWith({
            text: "I need a wallet address to check the balance. Please provide a wallet address.",
            content: { error: "Missing wallet address" }
        })
    })

    it('should successfully retrieve balance for a valid address', async () => {
        // Mock the necessary functions
        const { generateObjectDeprecated } = await import('@elizaos/core')
        const { ethers } = await import('ethers')

        const validAddress = '0x5C951583CEb79828b1fAB7257FE497A9Dc5896e6'
        const mockBalance = '1000000000000000000' // 1 SONIC in wei
        const formattedBalance = '1.0' // 1 SONIC in human readable format

        // Mock generateObjectDeprecated to return a valid address
        vi.mocked(generateObjectDeprecated).mockResolvedValue({ address: validAddress })

        // Mock ethers provider
        const mockGetBalance = vi.fn().mockResolvedValue(mockBalance)
        const mockProvider = {
            getBalance: mockGetBalance
        }
        vi.mocked(ethers.JsonRpcProvider).mockImplementation(() => mockProvider as any)
        vi.mocked(ethers.formatEther).mockReturnValue(formattedBalance)

        // Mock runtime settings
        vi.mocked(mockRuntime.getSetting).mockReturnValue('mock-rpc-url')
        vi.mocked(mockRuntime.composeState).mockResolvedValue({} as State)

        const mockCallback = vi.fn()

        const result = await getBalance.handler(
            mockRuntime,
            {} as Memory,
            undefined,
            {},
            mockCallback
        )

        expect(result).toBe(true)
        expect(mockCallback).toHaveBeenCalledWith({
            text: `Balance: ${formattedBalance} S`,
            content: { balance: formattedBalance }
        })
        expect(mockGetBalance).toHaveBeenCalledWith(validAddress)
        expect(ethers.JsonRpcProvider).toHaveBeenCalledWith('mock-rpc-url')
    })
})

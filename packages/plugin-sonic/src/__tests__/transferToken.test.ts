import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Memory, IAgentRuntime, ModelClass, State } from '@elizaos/core'
import { transferToken } from '../actions/transferToken/transferToken'
import { generateObjectDeprecated, composeContext } from '@elizaos/core'

// Mock the core module functions
vi.mock('@elizaos/core', async () => {
    const actual = await vi.importActual('@elizaos/core')
    return {
        ...actual,
        generateObjectDeprecated: vi.fn(),
        composeContext: vi.fn(),
        elizaLogger: {
            info: vi.fn(),
            error: vi.fn(),
        }
    }
})

// Mock ethers
vi.mock('ethers', () => ({
    ethers: {
        JsonRpcProvider: vi.fn(() => ({
            getBalance: vi.fn()
        })),
        Wallet: vi.fn(() => ({
            sendTransaction: vi.fn(),
        })),
        parseEther: vi.fn()
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

describe('transferToken', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should fail validation when SONIC_WALLET_PRIVATE_KEY is not provided', async () => {
        // Mock getSetting to return undefined for SONIC_WALLET_PRIVATE_KEY
        vi.mocked(mockRuntime.getSetting).mockReturnValue(null)

        const result = await transferToken.validate(mockRuntime, {} as Memory)
        expect(result).toBe(false)
    })

    it('should pass validation when SONIC_WALLET_PRIVATE_KEY is provided', async () => {
        // Mock getSetting to return a private key
        vi.mocked(mockRuntime.getSetting).mockReturnValue('mock-private-key')

        const result = await transferToken.validate(mockRuntime, {} as Memory)
        expect(result).toBe(true)
    })

    it('should fail when transfer content is invalid', async () => {
        // Mock the necessary functions
        vi.mocked(mockRuntime.composeState).mockResolvedValue({} as State)
        vi.mocked(composeContext).mockReturnValue('mock context')
        vi.mocked(generateObjectDeprecated).mockResolvedValue({
            // Invalid content missing required fields
            someOtherField: 'value'
        })

        const callback = vi.fn()

        const result = await transferToken.handler(
            mockRuntime,
            {} as Memory,
            undefined as unknown as State,
            {},
            callback
        )

        expect(result).toBe(false)
        expect(callback).toHaveBeenCalledWith({
            text: 'Unable to process transfer request. Invalid content provided.',
            content: { error: 'Invalid transfer content' }
        })
    })

    it('should successfully transfer tokens when content is valid', async () => {
        const { ethers } = await import('ethers')
        // Mock successful state and content generation
        vi.mocked(mockRuntime.composeState).mockResolvedValue({} as State)
        vi.mocked(composeContext).mockReturnValue('mock context')
        vi.mocked(generateObjectDeprecated).mockResolvedValue({
            recipient: '0x123456789',
            amount: '1.0'
        })

        // Mock ethers functions
        const mockTx = {
            wait: vi.fn().mockResolvedValue({ hash: 'mock-tx-hash' })
        }
        vi.mocked(ethers.Wallet).mockImplementation(() => ({
            sendTransaction: vi.fn().mockResolvedValue(mockTx)
        } as any))
        vi.mocked(ethers.parseEther).mockReturnValue(BigInt(1000000000000000000)) // 1 ETH in wei

        // Mock runtime settings
        vi.mocked(mockRuntime.getSetting).mockImplementation((key) => {
            if (key === 'SONIC_WALLET_PRIVATE_KEY') return 'mock-private-key'
            if (key === 'SONIC_RPC_URL') return 'mock-rpc-url'
            return null
        })

        const callback = vi.fn()

        const result = await transferToken.handler(
            mockRuntime,
            {} as Memory,
            undefined as unknown as State,
            {},
            callback
        )

        expect(result).toBe(true)
        expect(callback).toHaveBeenCalledWith({
            text: 'Successfully transferred 1.0 to 0x123456789 \nTransaction: mock-tx-hash',
            content: {
                success: true,
                signature: 'mock-tx-hash',
                amount: '1.0',
                recipient: '0x123456789'
            }
        })
    })
}) 
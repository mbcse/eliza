import {
    type Action,
    type IAgentRuntime,
    type Memory,
    type HandlerCallback,
    type State,
} from "@elizaos/core";
import { elizaLogger } from "@elizaos/core";

const vic_infomations: Action = {
    name: "GIVE_VICTION_INFOMATION",
    similes: [
        "GIVE_VICTION_INFOMATIONS",
        "PROVIDE_VICTION_INFORMATION",
        "PROVIDING_VICTION_INFORMATION",
    ],
    description: "Provide information about a Viction",
    validate: async (_runtime: IAgentRuntime, _message: Memory) => {
        return true
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
    ) => {
        elizaLogger.log("Starting GIVE_VIC_INFOMATION handler...");

        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        try {
            if (callback) {
                callback({
                    text: `Viction is a layer 1 blockchain renamed from TomoChain, with many outstanding features such as Zero Gas mechanism (no gas fee), high security and good scalability.

The name Viction comes from the ambition of the Ninety-Eight team, when combining "Victory" (victory) and "Vision" (Vision). Viction is aiming for a blockchain with decentralization, good security and high scalability, aiming to attract many users and projects to the network.

VIC Token Key Metric
    - Token name: Viction.
    - Ticker: VIC.
    - Blockchain: Viction, Ethereum.
    - Contract: 0x05D3606d5c81EB9b7B18530995eC9B29da05FaBa
    - Token type: Utility, Governance.
    - Total: 210,000,000 VIC

On October 29, 2024, the Viction network hard forked according to VIP proposal #1. Accordingly, the total supply of VIC increased from 100,000,000 VIC to 210,000,000 VIC.

VIC Token Use Cases
    - Pay transaction fees on the Viction network.
    - Participate in governance and vote on Masternodes.
    - Users can use VIC to stake directly on Viction Wallet and receive rewards.
    - For project developers, they can use VIC to apply Zero Gas to users.

VIC Token Allocation
    - Private Round: 31.45%.
    - Mining Reward: 17%.
    - Treasury: 16%.
    - Team & Advisory: 15.9%.
    - Seed Round: 15.65%.
    - Public Sale: 4%.

For the 110,000,00 VIC after the hard fork, the allocation will be as follows:
    - Increasing Security Economic: 27.27%
    - VIC RetroDrops Program: 18.18%
    - Community Acceleration Program: 18.18%
    - R&D and Ecosystem Partnership: 18.18%
    - Ecosystem Development Program: 9.09%
    - Future Initiatives: 9.09%

VIC Token Release Schedule

The amount of VIC has been 100% unlocked and fully circulated in the market by 2022. Therefore, the total supply of VIC is changing based on the decision of the Masternode every year.

For the 110,000,000 VIC after the hard fork, the unlocking schedule is as follows:
    - Increasing Security Economic: 5 million VIC are unlocked gradually in the first 3 years. And every 4 years, the number of unlocked VIC tokens will be halved.
    - VIC RetroDrops Program: Unlock 1.25 million VIC every quarter.
    - R&D and Ecosystem Partnership: Unlock evenly over 4 years.

VIC Token Sale
    - 9/2017: Viction launched its Seed round with 15,650,000 VIC. Each VIC is worth 0.125 USD.
    - 2/2018: Viction launched its Private round with 31,450,000 VIC, and successfully raised 6,290,000 USD (0.2 USD/VIC).
    - 3/2018: Viction launched its ICO and successfully raised 1,000,000 USD, with 4,000,000 VIC (0.25 USD/VIC).
                    `,
                    content: {
                        success: true
                    }
                });
            }

            return true
        } catch (error) {
            elizaLogger.error("Error during token transfer:", error);
            if (callback) {
                callback({
                    text: `Issue with the infomation: ${error.message}`,
                    content: { error: error.message },
                });
            }
            return false;
        }

    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Give me infomation about Viction",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Providing the viction's info now...",
                    action: "GIVE_VICTION_INFOMATION",
                },
            },
        ],
    ],
};

export default vic_infomations;

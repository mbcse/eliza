import {
    ActionExample,
    Content,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
    ModelClass,
    type Action,
} from "@elizaos/core";
import { elizaLogger } from "@elizaos/core";
import { composeContext } from "@elizaos/core";
import { generateObjectDeprecated } from "@elizaos/core";
import Web3 from 'web3'
const { toHex, toWei } = Web3.utils

interface VicTransferContent extends Content {
    recipient: string;
    amount: number;
}

const vicTransferTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
    "recipient": "0xe3FE2dc5Bd9c5516D3895ab3A931b5B545De658E",
    "amount": 98
}
\`\`\`

{{recentMessages}}

Extract the following information about the requested VIC transfer:
- Recipient wallet address
- Amount of VIC to transfer
`;

function isVicTransferContent(content: any): content is VicTransferContent {
    return (
        typeof content.recipient === "string" &&
        typeof content.amount === "string"
    );
}

export default {
    name: "SEND_VIC",
    similes: ["TRANSFER_VIC", "PAY_VIC", "TRANSACT_VIC"],
    validate: async (_runtime: IAgentRuntime, message: Memory) => {
        // Always return true for VIC transfers, letting the handler deal with specifics
        elizaLogger.log("Validating VIC transfer from user:", message.userId);
        return true;
    },
    description: "Transfer native VIC from agent's wallet to specified address",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
    ): Promise<boolean> => {
        elizaLogger.log("Starting SEND_VIC handler...");

        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        const transferContext = composeContext({
            state,
            template: vicTransferTemplate,
        });

        const content = await generateObjectDeprecated({
            runtime,
            context: transferContext,
            modelClass: ModelClass.LARGE,
        });

        if (!isVicTransferContent(content)) {
            if (callback) {
                callback({
                    text: "Need an address and the amount of VIC to send.",
                    content: { error: "Invalid transfer content" },
                });
            }
            return false;
        }

        try {
            const privateKey = runtime.getSetting("VICTION_PRIVATE_KEY")
            const sender = runtime.getSetting("VICTION_ADDRESS")
            const rpcUrl = runtime.getSetting("VICTION_RPC_URL")

            const client = new Web3(new Web3.providers.HttpProvider(rpcUrl))

            const nonce = await client.eth.getTransactionCount(sender)

            const transaction = {
                from : sender,
                nonce,
                to : content.recipient,
                data : '0x',
                value: toWei(content.amount.toString())
            }

            const gas = await client.eth.estimateGas(transaction)

            //@ts-ignore
            transaction.gas = toHex(gas)
            //@ts-ignore
            transaction.gasLimit = toHex(gas)

            const { rawTransaction: signedTransaction } = await client.eth.accounts.signTransaction(transaction as any, privateKey as string)

            const { transactionHash }  = await client.eth.sendSignedTransaction(signedTransaction as string)

            if (callback) {
                callback({
                    text: `Sent ${content.amount} VIC. Transaction hash: ${transactionHash}`,
                    content: {
                        success: true,
                        signature: signedTransaction,
                        amount: content.amount,
                        recipient: content.recipient,
                    },
                });
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error during VIC transfer:", error);
            if (callback) {
                callback({
                    text: `Problem with the VIC transfer: ${error.message}`,
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
                    text: "Send 98 VIC to 0xe3FE2dc5Bd9c5516D3895ab3A931b5B545De658E",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Sure thing, VIC on its way.",
                    action: "SEND_VIC",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;

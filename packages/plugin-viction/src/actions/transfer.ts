import {
    type ActionExample,
    type Content,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
    type Action,
    ModelClass
} from "@elizaos/core";
import { generateObjectDeprecated } from "@elizaos/core";
import { elizaLogger } from "@elizaos/core";
import { composeContext } from "@elizaos/core";
import Web3 from 'web3'
import { ERC20ABI } from "../abi";
import { unit } from "../constants";

const { toWei, toHex } = Web3.utils

export interface TransferContent extends Content {
    tokenAddress: string;
    recipient: string;
    amount: string | number;
}

function isTransferContent(
    _runtime: IAgentRuntime,
    content: any,
): content is TransferContent {
    elizaLogger.log("Content for transfer", content);
    return (
        typeof content.tokenAddress === "string" &&
        typeof content.recipient === "string" &&
        (typeof content.amount === "string" ||
            typeof content.amount === "number")
    );
}

const transferTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
    "tokenAddress": "0x0Fd0288AAAE91eaF935e2eC14b23486f86516c8C",
    "recipient": "0xe3FE2dc5Bd9c5516D3895ab3A931b5B545De658E",
    "amount": "98"
}
\`\`\`

{{recentMessages}}

Extract the following information about the requested token transfer:
- Token contract address
- Recipient wallet address
- Amount to transfer

If no token address is mentioned, respond with null.
`;


export default {
    name: "SEND_TOKEN",
    similes: [
        "TRANSFER_TOKEN",
        "TRANSFER_TOKENS",
        "SEND_TOKENS",
        "PAY_TOKEN",
        "PAY_TOKENS",
        "PAY",
    ],
    validate: async (_runtime: IAgentRuntime, message: Memory) => {
        // Always retrn true for token transfers, letting the handler deal with specifics
        elizaLogger.log("Validating token transfer from user:", message.userId);
        return true;
    },
    description: "Transfer Viciotn tokens from agent's wallet to another address",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
    ): Promise<boolean> => {
        elizaLogger.log("Starting SEND_TOKEN handler...");

        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        const transferContext = composeContext({
            state,
            template: transferTemplate,
        });

        const content = await generateObjectDeprecated({
            runtime,
            context: transferContext,
            modelClass: ModelClass.LARGE,
        });

        if (!isTransferContent(runtime, content)) {
            if (callback) {
                callback({
                    text: "Token address needed to send the token.",
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

            const contract = new client.eth.Contract(ERC20ABI as any, content.tokenAddress)

            const decimals = await contract.methods.decimals().call()

            const name = await contract.methods.name().call()

            const transaction = {
                from : sender,
                nonce,
                to : content.tokenAddress,
                value: '0'
            }

            //@ts-expect-error
            transaction.data = contract.methods.transfer(content.recipient, String(toWei(content.amount.toString(), unit[decimals]))).encodeABI()

            const gas = await client.eth.estimateGas(transaction)

            //@ts-ignore
            transaction.gas = toHex(gas)
            //@ts-ignore
            transaction.gasLimit = toHex(gas)
            const { rawTransaction: signedTransaction } = await client.eth.accounts.signTransaction(transaction as any, privateKey as string)

            const { transactionHash }  = await client.eth.sendSignedTransaction(signedTransaction as string)

            if (callback) {
                callback({
                    text: `Sent ${content.amount} ${name}. Transaction hash: ${transactionHash}`,
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
            elizaLogger.error("Error during token transfer:", error);
            if (callback) {
                callback({
                    text: `Issue with the transfer: ${error.message}`,
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
                    text: "Send 89 C98 0x0Fd0288AAAE91eaF935e2eC14b23486f86516c8C to 0xe3FE2dc5Bd9c5516D3895ab3A931b5B545De658E",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Sending the tokens now...",
                    action: "SEND_TOKEN",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;

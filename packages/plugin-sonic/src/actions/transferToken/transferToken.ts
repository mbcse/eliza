import {
    elizaLogger,
    ModelClass,
    type Action,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
} from "@elizaos/core";
import { composeContext, generateObjectDeprecated } from "@elizaos/core";
import { ethers } from "ethers";
import { DEFAULT_SONIC_RPC_URL, TRANSFER_TEMPLATE } from "../../constant";
import { TransferContent } from "../../types";

async function transferSimpleToken(
    runtime: IAgentRuntime,
    recipient: string,
    amount: string
): Promise<string | undefined> {
    const sonicRPCUrl = runtime.getSetting("SONIC_RPC_URL") as string || DEFAULT_SONIC_RPC_URL;
    const walletPrivateKey = runtime.getSetting("SONIC_WALLET_PRIVATE_KEY") as string;
    const provider = new ethers.JsonRpcProvider(sonicRPCUrl);
    const wallet = new ethers.Wallet(walletPrivateKey, provider);

    const recipientAddress = recipient;
    const amountToTransfer = ethers.parseEther(amount);

    try {
        // create txn object
        const txn = {
            to: recipientAddress,
            value: amountToTransfer,
            gasLimit: 21000,
        }

        // send the transaction
        const tx = await wallet.sendTransaction(txn);
        elizaLogger.info("Transaction sent:", tx);

        // wait for the transaction to be mined
        const receipt = await tx.wait();

        elizaLogger.info("Transaction successful:", receipt);
        return receipt?.hash ?? "";
    } catch (error) {
        elizaLogger.error("Error transferring token", error);
        throw error;
    }
}

function isTransferContent(
    _runtime: IAgentRuntime,
    content: unknown
): content is TransferContent {
    return (
        typeof (content as TransferContent).recipient === "string" &&
        (typeof (content as TransferContent).amount === "string" ||
            typeof (content as TransferContent).amount === "number")
    );
}

export const transferToken: Action = {
    name: "TRANSFER_TOKEN",
    description: "Transfer SONIC token to a specific address",
    similes: ["TRANSFER_TOKENS", "SEND_TOKENS", "SEND_TOKEN", "SEND_TOKENS_TO_ADDRESS"],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        elizaLogger.info("Validating transfer token action");
        // Check if SONIC_WALLET_PRIVATE_KEY is provided
        const walletPrivateKey = runtime.getSetting("SONIC_WALLET_PRIVATE_KEY") as string;
        if (!walletPrivateKey) {
            elizaLogger.error("Missing SONIC_WALLET_PRIVATE_KEY");
            return false;
        }
        return true;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.info("Transferring token");

        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        const transferContext = composeContext({
            state,
            template: TRANSFER_TEMPLATE,
        });

        const content = await generateObjectDeprecated({
            runtime,
            context: transferContext,
            modelClass: ModelClass.LARGE,
        });

        // Validate transfer content
        if (!isTransferContent(runtime, content)) {
            elizaLogger.error("Invalid content for TRANSFER_TOKEN action.");
            if (callback) {
                callback({
                    text: "Unable to process transfer request. Invalid content provided.",
                    content: { error: "Invalid transfer content" },
                });
            }
            return false;
        }

        try {
            const txnHash = await transferSimpleToken(
                runtime,
                content.recipient,
                content.amount.toString(),
            );

            if (!txnHash) {
                elizaLogger.error("Error transferring token");
                if (callback) {
                    callback({
                        success: false,
                        text: `Error transferring token`,
                        content: { error: "Error transferring token" },
                    });
                }
                return false;
            }

            if (callback) {
                callback({
                    text: `Successfully transferred ${content.amount} to ${content.recipient} \nTransaction: ${txnHash}`,
                    content: {
                        success: true,
                        signature: txnHash,
                        amount: content.amount,
                        recipient: content.recipient,
                    },
                });
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error transferring token", error);
            if (callback) {
                callback({
                    text: `Error transferring token: ${error}`,
                    content: { error: error },
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
                    text: "Transfer 0.1 S token to 0x5C951583CEb79828b1fAB7257FE497A9Dc5896e6",
                    action: "TRANSFER_TOKEN",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I want to transfer 1 SONIC token to 0x5C951583CEb79828b1fAB7257FE497A9Dc5896e6",
                    action: "TRANSFER_TOKEN",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Successfully sent 0.1 S token to 0x5C951583CEb79828b1fAB7257FE497A9Dc5896e6",
                },
            },
        ],
    ],
} as Action;

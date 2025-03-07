export const DEFAULT_SONIC_RPC_URL = "https://rpc.blaze.soniclabs.com";

export const TRANSFER_TEMPLATE = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.
Example response:
\`\`\`json
{
    "recipient": "0x5C951583CEb79828b1fAB7257FE497A9Dc5896e6",
    "amount": "1.5",
}
\`\`\`

{{recentMessages}}

Extract the following information about the requested token transfer:
- Recipient address (Sonic wallet address)
- Amount to transfer
- Token contract address (null for native SONIC transfers, Sonic native token is "S")

Respond with a JSON markdown block containing only the extracted values.`;


export const GET_BALANCE_TEMPLATE = `
Given the recent messages and wallet information below:

Example response:
\`\`\`json
{
    "address": "B62qkGSBuLmqYApYoWTmAzUtwFVx6Fe9ZStJVPzCwLjWZ5NQDYTiqEU",
    "balance": "100" // balance in SONIC
}
\`\`\`

{{recentMessages}}

{{walletInfo}}

Extract the following information about the requested Balance request:
- Address to check balance for.

Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.
`;
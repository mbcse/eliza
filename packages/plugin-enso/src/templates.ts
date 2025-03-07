export const swapTemplate = `
    You are helping users to find the most optimal route between tokens and execute it across different blockchains.

    Extract the following information:
    - tokenIn: Address of token that user wants to sell (e.g., 0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2, 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48)
    - tokenOut: Address of token that user wants to receive (e.g., 0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2, 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48)
    - amount: The amount of tokens to sell (numeric value only)
    - chain: The blockchain network where route should happen (e.g., ethereum, base, avalance, berachain)

    Return in JSON format:
    {
        "tokenIn": "<token address>",
        "tokenOut": "<token address>",
        "amount": "<amount as string>",
        "chain": {{supportedChains}}
    }

    Examples:

    "I want to swap 1 0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2 (WETH) to 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 (USDC) on Ethereum"
    {
        tokenIn: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        tokenOut: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        amount: "1",
        chain: "ethereum"
    }

    "I want to route 2 0x4200000000000000000000000000000000000006 (WETH) to 0x4e65fe4dba92790696d040ac24aa414708f5c0ab (aBasUSDC) on Base"
    {
        tokenIn: "0x4200000000000000000000000000000000000006",
        tokenOut: "0x4e65fe4dba92790696d040ac24aa414708f5c0ab",
        amount: "2",
        chain: "base"
    }


    Notes:
    - If the chain is not specified, by default assume it is "ethereum"
    - If you are unsure, just return null for any missing fields

    Recent conversation:
    {{recentMessages}}
`;

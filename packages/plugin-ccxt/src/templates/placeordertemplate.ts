
export const placeOrderTemplate = `
Extract the following parameters:
- **exchange** (string): The exchange name (e.g., "binance", "coinbasepro").
- **symbol** (string): The trading pair (e.g., "BTC/USDT").
- **orderType** (string): Order type, either "market" or "limit".
- **side** (string): Order direction, either "buy" or "sell".
- **amount** (number): The quantity of the asset to buy/sell.
- **price** (number, optional): Required for "limit" orders, ignored for "market" orders.

Provide the values in the following JSON format:

\`\`\`json
{
    "exchange": "<exchange>",
    "symbol": "<symbol>",
    "orderType": "<market | limit>",
    "side": "<buy | sell>",
    "amount": <number>,
    "price": <number (only for limit orders)>
}
\`\`\`

### **Example Requests & Responses:**

#### **Example request:**  
*"Buy 0.01 BTC on Binance at market price."*  
**Example response:**  
\`\`\`json
{
    "exchange": "binance",
    "symbol": "BTC/USDT",
    "orderType": "market",
    "side": "buy",
    "amount": 0.01
}
\`\`\`

#### **Example request:**  
*"Sell 2 ETH on Coinbase at market price."*  
**Example response:**  
\`\`\`json
{
    "exchange": "coinbasepro",
    "symbol": "ETH/USDT",
    "orderType": "market",
    "side": "sell",
    "amount": 2
}
\`\`\`

#### **Example request:**  
*"Buy 0.5 BTC on Binance at $29,000."*  
**Example response:**  
\`\`\`json
{
    "exchange": "binance",
    "symbol": "BTC/USDT",
    "orderType": "limit",
    "side": "buy",
    "amount": 0.5,
    "price": 29000
}
\`\`\`

#### **Example request:**  
*"Sell 3 LTC on Kraken at $120."*  
**Example response:**  
\`\`\`json
{
    "exchange": "kraken",
    "symbol": "LTC/USDT",
    "orderType": "limit",
    "side": "sell",
    "amount": 3,
    "price": 120
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}

If the request is related to placing an order, extract the parameters and return a JSON object. Otherwise, respond with null.
`;

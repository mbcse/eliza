export const getExchangeAssetTemplate = `
Extract the following parameters:
- **exchange** (string): The exchange name (e.g., "binance", "coinbasepro").
- **asset** (string): The asset symbol(s) (e.g., "BTC","ETH).

Provide the values in the following JSON format:

\`\`\`json
{
    "exchange": "<exchange>",
    "asset": "<asset>"
}
\`\`\`

### **Example Requests & Responses:**

#### **Example request:**  
*"Get Bitcoin price from Binance."*  
**Example response:**  
\`\`\`json
{
    "exchange": "binance",
    "asset": "BTC"
}
\`\`\`

#### **Example request:**  
*"Show me ETH from Coinbase."*  
**Example response:**  
\`\`\`json
{
    "exchange": "coinbase",
    "asset": "ETH"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}

If the request is related to exchange and asset data, extract the parameters and return a JSON object. Otherwise, respond with null.
`



export const getArbitrageOpportunityTemplate = `
Extract the following parameters:

- **asset** (string): The asset symbol (e.g., "BTC", "ETH").

Provide the values in the following JSON format:

\`\`\`json
{
    "asset": "<asset>"
}
\`\`\`

### **Example Requests & Responses:**

#### **Example request:**  
*"Find the best arbitrage opportunity for Bitcoin."*  
**Example response:**  
\`\`\`json
{
    "asset": "BTC"
}
\`\`\`

#### **Example request:**  
*"Look for arbitrage on ETH."*  
**Example response:**  
\`\`\`json
{
    "asset": "ETH"
}
\`\`\`

#### **Example request:**  
*"Tell me if there are any price differences for Dogecoin."*  
**Example response:**  
\`\`\`json
{
    "asset": "DOGE"
}
\`\`\`

Here are the recent user messages for context:  
{{recentMessages}}

If the request is related to finding arbitrage opportunities, extract the asset parameter and return a JSON object. Otherwise, respond with null.
`;
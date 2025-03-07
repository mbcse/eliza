# `@elizaos/plugin-enso`

## Description

The Enso Plugin provides integration with Enso's route API to find the most optimal route between two tokens across 180+ protocols.

## Features

- Find the most optimal route between 2 tokens
- Perform various onchain actions such as swap, deposit, redeem, withdraw etc.
- More than 180 protocols are available

## Installation

```bash
pnpm install @elizaos/plugin-enso
```

## Configuration

### Required Environment Variables

```env
# Required
WALLET_PRIVATE_KEY= # Your Private Key
ENSO_API_KEY= # Request an API key from https://shortcuts.enso.finance/developers
```

### Chains Supported

- Ethereum Mainnet
- Optimism
- BNB Chain
- Gnosis Chain
- Polygon
- ZKSync
- Base
- Arbitrum
- Avalanche
- Linea
- Berachain

## Actions

### Route

Find the most optimal route between two tokens and execute it.

```
I want to route 2 0x4200000000000000000000000000000000000006 (WETH) to 0x4e65fe4dba92790696d040ac24aa414708f5c0ab (aBasUSDC) on Base
```

## Development

1. Clone the repository
2. Install dependencies:

```bash
pnpm install
```

3. Build the plugin:

```bash
pnpm run build
```

4. Run tests:

```bash
pnpm test
```

## License

This plugin is part of the Eliza project. See the main project repository for license information.
oject. See the main project repository for license information.

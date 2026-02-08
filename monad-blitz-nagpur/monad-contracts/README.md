# Monad Contracts

Smart contracts for the P2P USDT exchange, deployed to Monad testnet.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Add your private key to `.env`:
```
MONAD_RPC_URL=https://rpc.monad.xyz
MONAD_PRIVATE_KEY=your_private_key_here
```

## Compile

```bash
npm run compile
```

## Deploy

```bash
npm run deploy
```

This will deploy `TokenEscrow.sol` to Monad testnet and print the contract address.

## Contract Address

After deployment, add the contract address to your Next.js `.env.local`:
```
NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=<deployed_address>
PRIVATE_KEY=<same_private_key_used_for_deployment>
```

The `PRIVATE_KEY` must be the same as the deployer, as it becomes the contract owner and can release tokens from escrow.

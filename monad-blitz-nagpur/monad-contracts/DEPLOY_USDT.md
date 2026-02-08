# Deploy MockUSDT Contract

## Quick Deploy

1. **Create `.env` file in `monad-contracts/` directory:**

```bash
cd monad-contracts
cat > .env << EOF
MONAD_RPC_URL=https://rpc.monad.xyz
MONAD_PRIVATE_KEY=your_private_key_here_without_0x_prefix
EOF
```

**Important:** Use the same private key that deployed TokenEscrow (owner: 0x066cc122239d2113312E1ccfAB49Ea516fb17504)

2. **Deploy:**

```bash
npm run deploy:usdt
```

3. **Copy the contract address to your Next.js `.env.local`:**

After deployment, you'll see:
```
NEXT_PUBLIC_USDT_CONTRACT_ADDRESS=0x...
```

Add this to your root `.env.local` file.

## Contract Details

- **Name:** Mock Tether USD
- **Symbol:** USDT
- **Decimals:** 6 (same as real USDT)
- **Total Supply:** 1,000,000,000 USDT
- **Initial Holder:** Deployer address (has all tokens)

## Usage

After deployment, users can:
1. Get USDT from the deployer (for testing)
2. Approve the escrow contract to spend their USDT
3. Lock USDT in escrow when creating sell ads
4. Receive USDT when buying (released from escrow)

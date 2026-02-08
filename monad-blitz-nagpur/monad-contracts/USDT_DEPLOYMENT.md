# Deploy MockUSDT to Monad Testnet

## ✅ Contract Ready

The `MockUSDT.sol` contract is created and ready to deploy:
- **Name:** Mock Tether USD  
- **Symbol:** USDT
- **Decimals:** 6 (same as real USDT)
- **Total Supply:** 1,000,000,000 USDT
- **Features:** Standard ERC20 with mint function for testing

## 🚀 Deployment Steps

### Step 1: Set Private Key

Create `monad-contracts/.env` file:

```bash
cd monad-contracts
cat > .env << EOF
MONAD_RPC_URL=https://rpc.monad.xyz
MONAD_PRIVATE_KEY=your_private_key_without_0x_prefix
EOF
```

**Important:** Use the same private key that deployed TokenEscrow:
- Owner address: `0x066cc122239d2113312E1ccfAB49Ea516fb17504`
- This ensures the deployer has funds and can mint USDT for testing

### Step 2: Deploy

```bash
npm run deploy:usdt
```

### Step 3: Copy Contract Address

After successful deployment, you'll see:
```
✅ MockUSDT deployed successfully!
📍 Contract address: 0x...
```

Add this to your Next.js root `.env.local`:
```env
NEXT_PUBLIC_USDT_CONTRACT_ADDRESS=0x...
```

## 📋 What You'll Get

After deployment:
- ✅ MockUSDT contract address on Monad testnet
- ✅ 1 billion USDT minted to deployer address
- ✅ Ready to use in your P2P exchange

## 🔧 Alternative: Auto-Setup from Parent .env.local

If you have `.env.local` in the root with `PRIVATE_KEY` or `MONAD_PRIVATE_KEY`:

```bash
npm run setup-env
npm run deploy:usdt
```

## ⚠️ Requirements

- Private key with MON balance for gas fees
- Same private key as TokenEscrow deployer (recommended)
- Network: Monad testnet (Chain ID: 10143)

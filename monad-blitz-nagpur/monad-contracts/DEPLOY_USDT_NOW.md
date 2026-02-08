# 🚀 Deploy MockUSDT - Quick Guide

## ✅ What's Ready

1. ✅ **MockUSDT Contract** - Compiled and ready
2. ✅ **Deployment Script** - Fixed for Hardhat v3
3. ✅ **Auto-Update Script** - Will update backend automatically

## 📝 Step 1: Add Private Key

Create or edit `monad-contracts/.env`:

```bash
cd monad-contracts
echo "MONAD_RPC_URL=https://rpc.monad.xyz" > .env
echo "MONAD_PRIVATE_KEY=your_private_key_without_0x" >> .env
```

**Important:** Use the same private key that deployed TokenEscrow (owner: `0x066cc122239d2113312E1ccfAB49Ea516fb17504`)

## 🚀 Step 2: Deploy & Auto-Update

Run the automated deployment:

```bash
npm run deploy:usdt:auto
```

This will:
1. ✅ Deploy MockUSDT to Monad testnet
2. ✅ Print the contract address
3. ✅ Automatically update `../env.example` with the address
4. ✅ Automatically update `../.env.local` (if it exists)

## 📋 Step 3: Verify

After deployment, check:

1. **Contract Address** - Printed in terminal
2. **env.example** - Should have `NEXT_PUBLIC_USDT_CONTRACT_ADDRESS=0x...`
3. **.env.local** - Should be updated automatically

## 📍 Current Contract Addresses

- **TokenEscrow:** `0xE3F874e3D0c462351BC525a752Fc7d0e7ad8482B`
- **MockUSDT:** Will be printed after deployment

## 🎯 Next Steps

After deployment:
1. Copy the MockUSDT address from terminal
2. Add to Vercel environment variables: `NEXT_PUBLIC_USDT_CONTRACT_ADDRESS`
3. Your backend is ready to use MockUSDT!

---

**Note:** The deployer wallet will receive the entire supply (1 billion USDT) for testing.

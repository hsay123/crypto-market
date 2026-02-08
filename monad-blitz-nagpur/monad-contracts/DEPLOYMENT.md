# Deployment Guide

## ✅ What Was Fixed

### 1. Directory Structure
- ✅ All contracts moved to `/monad-contracts/contracts/`
- ✅ Deploy script in `/monad-contracts/scripts/deploy.ts`
- ✅ Hardhat config isolated in `/monad-contracts/`
- ✅ No Hardhat config in Next.js root

### 2. Solidity Fixes
- ✅ Updated all contracts to Solidity `^0.8.28`
- ✅ Fixed `TokensReleased` event: removed `token` from indexed params
  - Before: 4 indexed params (adId, seller, buyer, token) ❌
  - After: 3 indexed params (adId, seller, buyer) ✅
- ✅ All contracts compile successfully

### 3. Hardhat v3 Compatibility
- ✅ Fixed deploy script to use `hre.ethers` instead of importing `ethers` from "hardhat"
- ✅ ESM module support configured
- ✅ Network configuration for Monad testnet

### 4. Network Configuration
- ✅ Monad testnet configured:
  - RPC: `https://rpc.monad.xyz`
  - Chain ID: `10143`
  - Network type: `http`

## 📁 Final Structure

```
monad-contracts/
├── contracts/
│   ├── TokenEscrow.sol    ✅ Fixed events
│   ├── Payment.sol
│   ├── Lock.sol
│   └── Certificate.sol
├── scripts/
│   └── deploy.ts           ✅ Fixed for Hardhat v3
├── hardhat.config.ts       ✅ Monad network configured
├── package.json            ✅ ESM + Hardhat v3
├── tsconfig.json
└── .env.example            ✅ Created
```

## 🚀 Deployment Steps

### 1. Set Environment Variables

Create `monad-contracts/.env`:
```env
MONAD_RPC_URL=https://rpc.monad.xyz
MONAD_PRIVATE_KEY=your_private_key_without_0x_prefix
```

### 2. Compile Contracts

```bash
cd monad-contracts
npm run compile
```

Expected output:
```
✅ Compiled 4 Solidity files with solc 0.8.28
```

### 3. Deploy TokenEscrow

```bash
npm run deploy
```

Expected output:
```
✅ TokenEscrow deployed successfully!
📍 Contract address: 0x...
```

### 4. Update Backend Environment

Add to Next.js root `.env.local`:
```env
NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=<deployed_address>
PRIVATE_KEY=<same_as_MONAD_PRIVATE_KEY>
```

⚠️ **CRITICAL**: The `PRIVATE_KEY` in Next.js must be the same as `MONAD_PRIVATE_KEY` used for deployment. This account becomes the contract owner and can release tokens from escrow.

## 📋 Backend Environment Variables

After deployment, your Next.js backend needs:

```env
# Escrow Contract
NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=0x...  # From deployment output
PRIVATE_KEY=...                            # Same as deployer (contract owner)

# Monad Network
NEXT_PUBLIC_RPC_URL=https://rpc.monad.xyz
NEXT_PUBLIC_CHAIN_ID=10143

# USDT Contract (on Monad testnet)
NEXT_PUBLIC_USDT_CONTRACT_ADDRESS=0x...   # Get from Monad docs
```

## 🔍 Verification

To verify deployment worked:
1. Check contract address is printed
2. Verify address on Monad explorer (when available)
3. Test contract functions using ethers.js in backend

## 📝 Notes

- All contracts compile with Solidity 0.8.28
- TokenEscrow is the main contract for escrow functionality
- Other contracts (Payment, Lock, Certificate) are available but not deployed by default
- Deploy script only deploys TokenEscrow (modify to deploy others if needed)

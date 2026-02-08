#!/bin/bash
# Deploy MockUSDT and automatically update backend configuration

set -e

echo "🚀 Deploying MockUSDT to Monad testnet..."

# Deploy the contract
npm run deploy:usdt > /tmp/usdt-deploy.log 2>&1

# Extract contract address from deployment output
USDT_ADDRESS=$(grep "Contract address:" /tmp/usdt-deploy.log | awk '{print $3}' | head -1)

if [ -z "$USDT_ADDRESS" ]; then
    echo "❌ Failed to extract contract address from deployment"
    cat /tmp/usdt-deploy.log
    exit 1
fi

echo ""
echo "✅ MockUSDT deployed!"
echo "📍 Contract Address: $USDT_ADDRESS"
echo ""

# Update env.example in root
ROOT_ENV="../env.example"
if [ -f "$ROOT_ENV" ]; then
    # Update USDT contract address
    if grep -q "NEXT_PUBLIC_USDT_CONTRACT_ADDRESS=" "$ROOT_ENV"; then
        sed -i "s|NEXT_PUBLIC_USDT_CONTRACT_ADDRESS=.*|NEXT_PUBLIC_USDT_CONTRACT_ADDRESS=$USDT_ADDRESS|" "$ROOT_ENV"
    else
        echo "NEXT_PUBLIC_USDT_CONTRACT_ADDRESS=$USDT_ADDRESS" >> "$ROOT_ENV"
    fi
    echo "✅ Updated $ROOT_ENV with USDT contract address"
fi

# Update API routes with default address
echo ""
echo "📝 Updating backend API routes..."

# Update sell-ads route
SELL_ADS_ROUTE="../app/api/sell-ads/route.ts"
if [ -f "$SELL_ADS_ROUTE" ]; then
    sed -i "s|const USDT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_USDT_CONTRACT_ADDRESS || '0x...';|const USDT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_USDT_CONTRACT_ADDRESS || '$USDT_ADDRESS';|" "$SELL_ADS_ROUTE"
    echo "✅ Updated sell-ads route"
fi

# Update webhook route
WEBHOOK_ROUTE="../app/api/razorpay/webhook/route.ts"
if [ -f "$WEBHOOK_ROUTE" ]; then
    sed -i "s|const USDT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_USDT_CONTRACT_ADDRESS || '0x...';|const USDT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_USDT_CONTRACT_ADDRESS || '$USDT_ADDRESS';|" "$WEBHOOK_ROUTE"
    echo "✅ Updated webhook route"
fi

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📋 Add to your .env.local:"
echo "NEXT_PUBLIC_USDT_CONTRACT_ADDRESS=$USDT_ADDRESS"
echo ""
echo "📍 TokenEscrow: 0xE3F874e3D0c462351BC525a752Fc7d0e7ad8482B"
echo "📍 MockUSDT: $USDT_ADDRESS"

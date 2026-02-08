#!/bin/bash
# Script to setup .env from parent directory's .env.local

PARENT_ENV="../.env.local"
CURRENT_ENV=".env"

if [ -f "$PARENT_ENV" ]; then
    echo "Found parent .env.local, extracting MONAD_PRIVATE_KEY..."
    MONAD_PRIVATE_KEY=$(grep "^MONAD_PRIVATE_KEY=" "$PARENT_ENV" | cut -d'=' -f2 | tr -d '"' | tr -d "'" | head -1)
    PRIVATE_KEY=$(grep "^PRIVATE_KEY=" "$PARENT_ENV" | cut -d'=' -f2 | tr -d '"' | tr -d "'" | head -1)
    
    # Use PRIVATE_KEY if MONAD_PRIVATE_KEY not found (they should be the same)
    if [ -z "$MONAD_PRIVATE_KEY" ] && [ -n "$PRIVATE_KEY" ]; then
        MONAD_PRIVATE_KEY="$PRIVATE_KEY"
    fi
    
    if [ -n "$MONAD_PRIVATE_KEY" ] && [ "$MONAD_PRIVATE_KEY" != "your_private_key_here_without_0x_prefix" ]; then
        echo "MONAD_RPC_URL=https://rpc.monad.xyz" > "$CURRENT_ENV"
        echo "MONAD_PRIVATE_KEY=$MONAD_PRIVATE_KEY" >> "$CURRENT_ENV"
        echo "✅ .env file created from parent .env.local"
    else
        echo "❌ No valid MONAD_PRIVATE_KEY found in parent .env.local"
        echo "Please add MONAD_PRIVATE_KEY to monad-contracts/.env manually"
    fi
else
    echo "Parent .env.local not found. Please create monad-contracts/.env manually"
fi

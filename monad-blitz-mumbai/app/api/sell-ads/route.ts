import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { ethers } from 'ethers';

// USDT contract address on Polygon Amoy testnet
// Note: You'll need to get the actual USDT testnet address
const USDT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_USDT_CONTRACT_ADDRESS || '0x...';
const ESCROW_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS || '0x...';
const PRIVATE_KEY = process.env.PRIVATE_KEY; // Server's private key for escrow release

// ERC20 ABI (minimal for USDT)
const ERC20_ABI = [
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

// Escrow contract ABI
const ESCROW_ABI = [
  "function lockTokens(string memory adId, address token, uint256 amount) external",
  "function getLockedAmount(string memory adId, address seller, address token) external view returns (uint256)"
];

// Get provider for Polygon Amoy
function getProvider() {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc-amoy.polygon.technology/';
  return new ethers.JsonRpcProvider(rpcUrl, {
    chainId: 80002,
    name: 'polygon-amoy'
  });
}

// GET - Fetch active sell ads
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cryptocurrency = searchParams.get('cryptocurrency') || 'USDT';
    const sortBy = searchParams.get('sortBy') || 'price';

    // Build where clause
    const where: any = {
      cryptocurrency: cryptocurrency.toUpperCase(),
      status: 'ACTIVE',
      availableAmount: {
        gt: 0
      }
    };

    // Build orderBy clause
    let orderBy: any = {};
    switch (sortBy) {
      case 'Price':
        orderBy = { price: 'asc' };
        break;
      case 'Amount':
        orderBy = { availableAmount: 'desc' };
        break;
      default:
        orderBy = { price: 'asc' };
    }

    const sellAds = await prisma.sellAd.findMany({
      where,
      orderBy,
      take: 50,
      include: {
        seller: {
          select: {
            walletAddress: true,
            accountHolderName: true,
          }
        }
      }
    });

    // Transform to match frontend format
    const transformedAds = sellAds.map(ad => ({
      id: ad.id,
      trader: {
        name: ad.seller.accountHolderName || `User${ad.sellerWallet.slice(-4)}`,
        completion: '100%', // Default for MVP
        orders: 0,
        verified: false,
        rating: 5.0
      },
      price: `₹${ad.price.toFixed(2)}`,
      available: `${ad.availableAmount.toFixed(2)} ${ad.cryptocurrency}`,
      limits: `₹${(ad.price * 0.1).toFixed(2)} - ₹${(ad.price * ad.availableAmount).toFixed(2)}`, // Min 10% of available
      paymentMethods: ['UPI', 'IMPS', 'Bank Transfer'],
      timeLimit: '30 min'
    }));

    return NextResponse.json({
      success: true,
      orders: transformedAds
    });
  } catch (error) {
    console.error('Error fetching sell ads:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sell ads' },
      { status: 500 }
    );
  }
}

// POST - Create sell ad with escrow locking
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      walletAddress,
      cryptocurrency = 'USDT',
      price,
      totalAmount,
      escrowTxHash // Frontend should provide this after locking
    } = body;

    // Validation
    if (!walletAddress || !price || !totalAmount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: walletAddress, price, totalAmount' },
        { status: 400 }
      );
    }

    if (!escrowTxHash) {
      return NextResponse.json(
        { success: false, error: 'Escrow transaction hash is required. Please lock USDT first.' },
        { status: 400 }
      );
    }

    // Validate wallet address
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { walletAddress }
    });

    if (!user) {
      // Create user if doesn't exist
      user = await prisma.user.create({
        data: {
          walletAddress,
          onboardingComplete: false,
        }
      });
    }

    // Verify escrow transaction exists and is valid
    const provider = getProvider();
    try {
      const tx = await provider.getTransaction(escrowTxHash);
      if (!tx) {
        return NextResponse.json(
          { success: false, error: 'Invalid escrow transaction hash' },
          { status: 400 }
        );
      }
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) {
        return NextResponse.json(
          { success: false, error: 'Escrow transaction failed' },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error('Error verifying escrow transaction:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to verify escrow transaction' },
        { status: 400 }
      );
    }

    // Create sell ad
    const sellAd = await prisma.sellAd.create({
      data: {
        sellerId: user.id,
        sellerWallet: walletAddress,
        cryptocurrency: cryptocurrency.toUpperCase(),
        fiatCurrency: 'INR',
        price: parseFloat(price),
        totalAmount: parseFloat(totalAmount),
        availableAmount: parseFloat(totalAmount),
        escrowTxHash,
        escrowContractAddress: ESCROW_CONTRACT_ADDRESS,
        status: 'LOCKED', // Ad is locked with escrow
      }
    });

    return NextResponse.json({
      success: true,
      sellAd: {
        id: sellAd.id,
        price: sellAd.price,
        totalAmount: sellAd.totalAmount,
        availableAmount: sellAd.availableAmount,
        status: sellAd.status,
        escrowTxHash: sellAd.escrowTxHash
      }
    });
  } catch (error: any) {
    console.error('Error creating sell ad:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create sell ad' },
      { status: 500 }
    );
  }
}

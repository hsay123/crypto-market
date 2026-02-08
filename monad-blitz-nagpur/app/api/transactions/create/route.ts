import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Create transaction when buyer initiates purchase
// This is called BEFORE Razorpay payment
export async function POST(req: NextRequest) {
  try {
    const { sellAdId, buyerWalletAddress, usdtAmount, razorpayOrderId } = await req.json();

    if (!sellAdId || !buyerWalletAddress || !usdtAmount || !razorpayOrderId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: sellAdId, buyerWalletAddress, usdtAmount, razorpayOrderId' },
        { status: 400 }
      );
    }

    // Validate wallet address
    if (!/^0x[a-fA-F0-9]{40}$/.test(buyerWalletAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid buyer wallet address format' },
        { status: 400 }
      );
    }

    // Find sell ad
    const sellAd = await prisma.sellAd.findUnique({
      where: { id: sellAdId },
      include: { seller: true }
    });

    if (!sellAd) {
      return NextResponse.json(
        { success: false, error: 'Sell ad not found' },
        { status: 404 }
      );
    }

    // Check if ad is active
    if (sellAd.status !== 'ACTIVE' && sellAd.status !== 'LOCKED') {
      return NextResponse.json(
        { success: false, error: 'Sell ad is not available' },
        { status: 400 }
      );
    }

    // Check available amount
    if (Number(sellAd.availableAmount) < Number(usdtAmount)) {
      return NextResponse.json(
        { success: false, error: 'Not enough USDT available in this ad' },
        { status: 400 }
      );
    }

    // Find or create buyer user
    let buyer = await prisma.user.findUnique({
      where: { walletAddress: buyerWalletAddress }
    });

    if (!buyer) {
      buyer = await prisma.user.create({
        data: {
          walletAddress: buyerWalletAddress,
          onboardingComplete: false,
        }
      });
    }

    // Calculate INR amount
    const inrAmount = Number(usdtAmount) * Number(sellAd.price);

    // Create transaction record
    const transaction = await prisma.transaction.create({
      data: {
        buyerId: buyer.id,
        sellerId: sellAd.sellerId,
        sellAdId: sellAd.id,
        usdtAmount: Number(usdtAmount),
        inrAmount: inrAmount,
        razorpayOrderId,
        status: 'PAYMENT_PENDING'
      },
      include: {
        buyer: {
          select: {
            walletAddress: true
          }
        },
        seller: {
          select: {
            walletAddress: true,
            accountHolderName: true
          }
        },
        sellAd: {
          select: {
            price: true,
            availableAmount: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction.id,
        usdtAmount: transaction.usdtAmount,
        inrAmount: transaction.inrAmount,
        status: transaction.status,
        razorpayOrderId: transaction.razorpayOrderId
      }
    });
  } catch (error: any) {
    console.error('Error creating transaction:', error);
    
    // Handle unique constraint violation (duplicate razorpayOrderId)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'Transaction with this Razorpay order already exists' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create transaction' },
      { status: 500 }
    );
  }
}

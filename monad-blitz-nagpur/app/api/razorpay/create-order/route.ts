import Razorpay from 'razorpay';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Initialize Razorpay with safe fallbacks
const getRazorpayInstance = () => {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  
  if (!keyId || !keySecret) {
    throw new Error('Razorpay credentials not configured. Please set NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
  }
  
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

/**
 * POST /api/razorpay/create-order
 * 
 * Creates a Razorpay order and saves transaction to database.
 * 
 * Body:
 * - amount: number (in paise, e.g., 50000 = ₹500)
 * - sellAdId: string (SellAd ID)
 * - buyerId: number (User ID) OR buyerWalletAddress: string
 * 
 * Returns:
 * - orderId: string (Razorpay order ID)
 * - amount: number (in paise)
 * - currency: string
 * - keyId: string (for frontend)
 * - transactionId: string (our transaction ID)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, sellAdId, buyerId, buyerWalletAddress } = body;

    // Validate required fields
    if (!amount || typeof amount !== 'number' || amount < 100) {
      return NextResponse.json(
        { error: 'Invalid amount. Minimum amount is ₹1 (100 paise)' },
        { status: 400 }
      );
    }

    if (!sellAdId) {
      return NextResponse.json(
        { error: 'sellAdId is required' },
        { status: 400 }
      );
    }

    // Find buyer by ID, Clerk ID, or wallet address
    let buyer;
    if (buyerId) {
      // Try as Prisma User ID first
      buyer = await prisma.user.findUnique({
        where: { id: typeof buyerId === 'number' ? buyerId : parseInt(buyerId) }
      });
      
      // If not found and buyerId looks like a Clerk ID (starts with user_)
      if (!buyer && typeof buyerId === 'string' && buyerId.startsWith('user_')) {
        buyer = await prisma.user.findUnique({
          where: { clerkId: buyerId }
        });
      }
    } else if (buyerWalletAddress) {
      buyer = await prisma.user.findUnique({
        where: { walletAddress: buyerWalletAddress }
      });
    } else {
      return NextResponse.json(
        { error: 'Either buyerId (Clerk ID or User ID) or buyerWalletAddress is required' },
        { status: 400 }
      );
    }

    // If buyer not found by Clerk ID, create a placeholder user
    // In production, this should be handled by user onboarding flow
    if (!buyer && buyerId && typeof buyerId === 'string' && buyerId.startsWith('user_')) {
      return NextResponse.json(
        { error: 'Buyer not found. Please complete your profile first.' },
        { status: 404 }
      );
    }

    if (!buyer) {
      return NextResponse.json(
        { error: 'Buyer not found' },
        { status: 404 }
      );
    }

    // Find sell ad
    const sellAd = await prisma.sellAd.findUnique({
      where: { id: sellAdId },
      include: { seller: true }
    });

    if (!sellAd) {
      return NextResponse.json(
        { error: 'Sell ad not found' },
        { status: 404 }
      );
    }

    // Check if ad is available
    if (sellAd.status !== 'ACTIVE' && sellAd.status !== 'LOCKED') {
      return NextResponse.json(
        { error: 'Sell ad is not available for purchase' },
        { status: 400 }
      );
    }

    // Calculate USDT amount from INR amount (amount is in paise, so divide by 100 to get INR)
    const inrAmount = amount / 100;
    const usdtAmount = Number(inrAmount) / Number(sellAd.price);

    // Check available amount
    if (Number(sellAd.availableAmount) < usdtAmount) {
      return NextResponse.json(
        { error: 'Not enough USDT available in this ad' },
        { status: 400 }
      );
    }

    // Create Razorpay order
    const razorpay = getRazorpayInstance();
    const order = await razorpay.orders.create({
      amount: amount, // Amount in paise
      currency: 'INR',
      receipt: `tx_${Date.now()}_${sellAdId}`,
      notes: {
        sellAdId,
        buyerId: buyer.id.toString(),
        sellerId: sellAd.sellerId.toString(),
        usdtAmount: usdtAmount.toString(),
        inrAmount: inrAmount.toString(),
      }
    });

    // Create transaction record in database
    const transaction = await prisma.transaction.create({
      data: {
        buyerId: buyer.id,
        sellerId: sellAd.sellerId,
        sellAdId: sellAd.id,
        usdtAmount: usdtAmount,
        inrAmount: inrAmount,
        razorpayOrderId: order.id,
        status: 'PAYMENT_PENDING'
      }
    });

    console.log(`✅ Razorpay order created: ${order.id} for transaction: ${transaction.id}`);

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '',
      transactionId: transaction.id,
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error creating Razorpay order:', error);
    
    // Handle Prisma unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Transaction with this order already exists' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create order' },
      { status: 500 }
    );
  }
}

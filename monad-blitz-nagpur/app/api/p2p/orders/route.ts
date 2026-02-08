import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cryptocurrency = searchParams.get('cryptocurrency') || 'USDT'
    const sortBy = searchParams.get('sortBy') || 'price'

    // Build where clause
    const where: any = {
      cryptocurrency: cryptocurrency.toUpperCase(),
      status: 'ACTIVE',
      availableAmount: {
        gt: 0
      }
    }

    // Build orderBy clause
    let orderBy: any = {}
    switch (sortBy) {
      case 'Price':
        orderBy = { price: 'asc' }
        break
      case 'Amount':
        orderBy = { availableAmount: 'desc' }
        break
      default:
        orderBy = { price: 'asc' }
    }

    const sellAds = await prisma.sellAd.findMany({
      where,
      orderBy,
      take: 50, // Limit to 50 sell ads
      include: {
        seller: {
          select: {
            walletAddress: true,
            accountHolderName: true
          }
        }
      }
    })

    // Transform the data to match the frontend format
    const transformedOrders = sellAds.map(ad => ({
      id: ad.id,
      trader: {
        name: ad.seller.accountHolderName || `User${ad.sellerWallet.slice(-4)}`,
        completion: '100%', // Default for MVP
        orders: 0, // Default for MVP
        verified: false, // Default for MVP
        rating: 5.0 // Default for MVP
      },
      price: `₹${ad.price.toFixed(2)}`,
      available: `${ad.availableAmount.toFixed(2)} ${ad.cryptocurrency}`,
      limits: `₹${(ad.price * 0.1).toFixed(2)} - ₹${(ad.price * ad.availableAmount).toFixed(2)}`, // Min 10% of available
      paymentMethods: ['UPI', 'IMPS', 'Bank Transfer'], // Default payment methods
      timeLimit: '30 min' // Default time limit
    }))

    return NextResponse.json({
      success: true,
      orders: transformedOrders
    })
  } catch (error) {
    console.error('Error fetching sell ads:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sell ads' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      walletAddress,
      cryptocurrency = 'USDT',
      price,
      totalAmount,
      escrowTxHash
    } = body

    // Validation
    if (!walletAddress || !price || !totalAmount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: walletAddress, price, totalAmount' },
        { status: 400 }
      )
    }

    if (!escrowTxHash) {
      return NextResponse.json(
        { success: false, error: 'Escrow transaction hash is required. Please lock USDT first.' },
        { status: 400 }
      )
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid wallet address format' },
        { status: 400 }
      )
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { walletAddress }
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress,
          onboardingComplete: false,
        }
      })
    }

    // Create sell ad
    const newSellAd = await prisma.sellAd.create({
      data: {
        sellerId: user.id,
        sellerWallet: walletAddress,
        cryptocurrency: cryptocurrency.toUpperCase(),
        fiatCurrency: 'INR',
        price: parseFloat(price),
        totalAmount: parseFloat(totalAmount),
        availableAmount: parseFloat(totalAmount),
        escrowTxHash,
        escrowContractAddress: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS || null,
        status: 'LOCKED' // Ad is locked with escrow
      }
    })

    return NextResponse.json({
      success: true,
      order: {
        id: newSellAd.id,
        price: newSellAd.price,
        totalAmount: newSellAd.totalAmount,
        availableAmount: newSellAd.availableAmount,
        status: newSellAd.status,
        escrowTxHash: newSellAd.escrowTxHash
      }
    })

  } catch (error: any) {
    console.error('Error creating sell ad:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create sell ad' },
      { status: 500 }
    )
  }
}

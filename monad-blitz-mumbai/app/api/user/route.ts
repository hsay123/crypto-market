import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

// GET user by wallet address
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get('walletAddress');
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'Missing walletAddress' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { walletAddress },
      include: {
        sellAds: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch user' }, { status: 500 });
  }
}

// POST - Create or update user by wallet address
export async function POST(req: NextRequest) {
  try {
    const { walletAddress, email, clerkId } = await req.json();
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'Missing walletAddress' }, { status: 400 });
    }

    // Validate wallet address format (basic check)
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }

    // Upsert user: create if not exists, else update
    const user = await prisma.user.upsert({
      where: { walletAddress },
      update: {
        ...(email && { email }),
        ...(clerkId && { clerkId })
      },
      create: {
        walletAddress,
        email: email || null,
        clerkId: clerkId || null,
        firstName: null,
        lastName: null,
        phone: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        state: null,
        zipCode: null,
        dateOfBirth: null,
        gender: null,
        bankName: null,
        accountNumber: null,
        ifsc: null,
        accountHolderName: null,
        termsAccepted: false,
        privacyAccepted: false,
        marketingAccepted: false,
        onboardingComplete: false,
      },
    });

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    console.error('Error creating/updating user:', error);
    return NextResponse.json({ error: error.message || 'Failed to upsert user' }, { status: 500 });
  }
}

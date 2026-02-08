import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

// POST - Save bank account details
export async function POST(req: NextRequest) {
  try {
    const { walletAddress, accountHolderName, accountNumber, ifsc, bankName } = await req.json();
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'Missing walletAddress' }, { status: 400 });
    }

    if (!accountHolderName || !accountNumber || !ifsc) {
      return NextResponse.json({ 
        error: 'Missing required fields: accountHolderName, accountNumber, ifsc' 
      }, { status: 400 });
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }

    // Validate IFSC format (basic check: 11 characters, alphanumeric)
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase())) {
      return NextResponse.json({ error: 'Invalid IFSC format' }, { status: 400 });
    }

    // Update user with bank details
    const user = await prisma.user.update({
      where: { walletAddress },
      data: {
        accountHolderName,
        accountNumber,
        ifsc: ifsc.toUpperCase(),
        bankName: bankName || null,
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Bank details saved successfully',
      user: {
        walletAddress: user.walletAddress,
        accountHolderName: user.accountHolderName,
        bankName: user.bankName,
        // Don't return sensitive accountNumber
      }
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'User not found. Please connect wallet first.' }, { status: 404 });
    }
    console.error('Error saving bank details:', error);
    return NextResponse.json({ error: error.message || 'Failed to save bank details' }, { status: 500 });
  }
}

// GET - Retrieve bank details (for verification, don't return full account number)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get('walletAddress');
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'Missing walletAddress' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { walletAddress },
      select: {
        walletAddress: true,
        accountHolderName: true,
        bankName: true,
        ifsc: true,
        // Mask account number for security
        accountNumber: true, // In production, you might want to mask this
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true,
      bankDetails: {
        accountHolderName: user.accountHolderName,
        bankName: user.bankName,
        ifsc: user.ifsc,
        accountNumber: user.accountNumber ? `${user.accountNumber.slice(0, 4)}****${user.accountNumber.slice(-4)}` : null,
      }
    });
  } catch (error: any) {
    console.error('Error fetching bank details:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch bank details' }, { status: 500 });
  }
}

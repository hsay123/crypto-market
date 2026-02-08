import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

/**
 * Generate expected signature for payment verification
 */
const generatedSignature = (
    razorpayOrderId: string,
    razorpayPaymentId: string
) => {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
        throw new Error(
            'Razorpay key secret is not defined in environment variables.'
        );
    }
    const sig = crypto
        .createHmac('sha256', keySecret)
        .update(razorpayOrderId + '|' + razorpayPaymentId)
        .digest('hex');
    return sig;
};

/**
 * POST /api/razorpay/verify
 * 
 * Verifies Razorpay payment signature and updates transaction in database.
 * 
 * Body:
 * - orderCreationId: string (Razorpay order ID)
 * - razorpayPaymentId: string
 * - razorpaySignature: string
 * 
 * Returns:
 * - isOk: boolean
 * - message: string
 * - transactionId?: string
 */
export async function POST(request: NextRequest) {
    try {
        const { orderCreationId, razorpayPaymentId, razorpaySignature, failureReason, isFailedPayment } =
            await request.json();

        // Handle failed payment
        if (isFailedPayment) {
            // Find and update transaction if exists
            if (orderCreationId) {
                try {
                    await prisma.transaction.updateMany({
                        where: { razorpayOrderId: orderCreationId },
                        data: { status: 'FAILED' }
                    });
                } catch (error) {
                    console.error('Error updating failed transaction:', error);
                }
            }
            return NextResponse.json(
                { message: 'Payment failure logged', isOk: false },
                { status: 200 }
            );
        }

        // Validate required fields
        if (!orderCreationId || !razorpayPaymentId || !razorpaySignature) {
            return NextResponse.json(
                { message: 'Missing required payment parameters', isOk: false },
                { status: 400 }
            );
        }

        // Verify signature
        const expectedSignature = generatedSignature(orderCreationId, razorpayPaymentId);
        if (expectedSignature !== razorpaySignature) {
            console.log('Payment verification failed - signature mismatch');
            return NextResponse.json(
                { message: 'Payment verification failed - invalid signature', isOk: false },
                { status: 400 }
            );
        }

        // Find transaction by Razorpay order ID
        const transaction = await prisma.transaction.findUnique({
            where: { razorpayOrderId: orderCreationId }
        });

        if (!transaction) {
            console.error(`Transaction not found for Razorpay order: ${orderCreationId}`);
            return NextResponse.json(
                { message: 'Transaction not found', isOk: false },
                { status: 404 }
            );
        }

        // Update transaction with payment details
        await prisma.transaction.update({
            where: { id: transaction.id },
            data: {
                razorpayPaymentId,
                razorpaySignature,
                status: 'PAYMENT_RECEIVED'
            }
        });

        console.log(`✅ Payment verified and transaction updated: ${transaction.id}`);

        return NextResponse.json(
            { 
                message: 'Payment verified successfully', 
                isOk: true,
                transactionId: transaction.id,
                paymentId: razorpayPaymentId
            },
            { status: 200 }
        );
    } catch (error: any) {
        console.error('Error verifying payment:', error);
        return NextResponse.json(
            { message: error.message || 'Internal server error', isOk: false },
            { status: 500 }
        );
    }
}
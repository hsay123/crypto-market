import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/razorpay/webhook
 * 
 * Handles Razorpay webhook events for payment status updates.
 * 
 * Events handled:
 * - payment.captured: Payment successful, update transaction and set escrow placeholder
 * - payment.failed: Payment failed, update transaction status
 * 
 * IMPORTANT: Escrow release is a PLACEHOLDER for hackathon demo.
 * Real blockchain escrow execution will be implemented post-hackathon on Monad.
 */
export async function POST(request: NextRequest) {
	try {
		// Use RAZORPAY_WEBHOOK_SECRET if available, fallback to RAZORPAY_KEY_SECRET
		const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || '';
		if (!secret) {
			console.error('Webhook secret not configured');
			return NextResponse.json({ error: 'Webhook secret not set' }, { status: 500 });
		}

		// Razorpay sends the signature in this header
		const signature = request.headers.get('x-razorpay-signature');
		if (!signature) {
			return NextResponse.json({ error: 'Missing signature header' }, { status: 400 });
		}

		// Get the raw body for signature verification
		const rawBody = await request.text();
		// Re-parse JSON for use
		let payload;
		try {
			payload = JSON.parse(rawBody);
		} catch {
			return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
		}

		// Verify webhook signature
		const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
		if (expected !== signature) {
			console.error('Webhook signature verification failed');
			return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
		}

		console.log(`📥 Razorpay webhook received: ${payload.event}`);

		// Handle payment.captured event (payment successful)
		if (payload.event === 'payment.captured') {
			const payment = payload.payload?.payment?.entity;
			if (!payment) {
				return NextResponse.json({ error: 'Invalid payment data' }, { status: 400 });
			}

			const razorpayOrderId = payment.order_id;
			const razorpayPaymentId = payment.id;
			const amount = payment.amount; // Amount in paise
			const status = payment.status;

			// Only process if payment is captured
			if (status !== 'captured') {
				console.log(`Payment ${razorpayPaymentId} status is ${status}, skipping`);
				return NextResponse.json({ received: true, message: 'Payment not captured yet' });
			}

			// Find transaction by Razorpay order ID
			const transaction = await prisma.transaction.findUnique({
				where: { razorpayOrderId },
				include: {
					sellAd: true,
					buyer: true,
					seller: true
				}
			});

			if (!transaction) {
				console.error(`Transaction not found for Razorpay order: ${razorpayOrderId}`);
				return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
			}

			// Verify payment amount matches transaction amount (in paise)
			const expectedAmount = Math.round(Number(transaction.inrAmount) * 100);
			if (amount !== expectedAmount) {
				console.error(`Amount mismatch: expected ${expectedAmount}, received ${amount}`);
				return NextResponse.json({ error: 'Payment amount mismatch' }, { status: 400 });
			}

			// Check if already processed
			if (transaction.status === 'ESCROW_RELEASED' || transaction.status === 'COMPLETED') {
				console.log(`Transaction ${transaction.id} already processed`);
				return NextResponse.json({ received: true, message: 'Already processed' });
			}

			// Update transaction with Razorpay payment details
			await prisma.transaction.update({
				where: { id: transaction.id },
				data: {
					razorpayPaymentId,
					razorpaySignature: signature,
					status: 'PAYMENT_RECEIVED'
				}
			});

			// ============================================
			// ESCROW PLACEHOLDER FOR HACKATHON DEMO
			// ============================================
			// NOTE: Real blockchain escrow execution will be implemented post-hackathon.
			// For now, we simulate escrow release with a placeholder transaction hash.
			// This allows the payment flow to complete and demonstrate the full system.
			// 
			// Post-hackathon: Replace this with actual releaseEscrow() call to Monad testnet.
			// ============================================
			
			const placeholderTxHash = `0xRAZORPAY_DEMO_${transaction.id}_${Date.now()}`;
			
			console.log(`🔒 ESCROW PLACEHOLDER: Simulating escrow release for transaction ${transaction.id}`);
			console.log(`   Placeholder TX Hash: ${placeholderTxHash}`);
			console.log(`   Real escrow execution will be on Monad testnet post-hackathon`);

			// Update transaction and sell ad with placeholder escrow release
			await prisma.$transaction([
				prisma.transaction.update({
					where: { id: transaction.id },
					data: {
						escrowReleaseTxHash: placeholderTxHash,
						status: 'ESCROW_RELEASED' // Changed from COMPLETED to ESCROW_RELEASED for demo
					}
				}),
				prisma.sellAd.update({
					where: { id: transaction.sellAdId },
					data: {
						availableAmount: {
							decrement: transaction.usdtAmount
						}
					}
				})
			]);

			console.log(`✅ Payment processed and escrow placeholder set for transaction ${transaction.id}`);
			return NextResponse.json({ 
				received: true, 
				verified: true,
				message: 'Payment processed and escrow placeholder set',
				escrowTxHash: placeholderTxHash,
				note: 'Real escrow execution will be on Monad testnet post-hackathon'
			});
		}

		// Handle payment.failed event
		if (payload.event === 'payment.failed') {
			const payment = payload.payload?.payment?.entity;
			if (!payment) {
				return NextResponse.json({ error: 'Invalid payment data' }, { status: 400 });
			}

			const razorpayOrderId = payment.order_id;
			const razorpayPaymentId = payment.id;

			// Find and update transaction
			const transaction = await prisma.transaction.findUnique({
				where: { razorpayOrderId }
			});

			if (transaction) {
				await prisma.transaction.update({
					where: { id: transaction.id },
					data: {
						razorpayPaymentId,
						status: 'FAILED'
					}
				});
				console.log(`❌ Payment failed for transaction ${transaction.id}`);
			}

			return NextResponse.json({ 
				received: true, 
				message: 'Payment failure logged' 
			});
		}

		// For other events, just acknowledge
		console.log(`ℹ️  Unhandled Razorpay webhook event: ${payload.event}`);
		return NextResponse.json({ received: true, verified: true });
	} catch (error: any) {
		console.error('Webhook error:', error);
		return NextResponse.json({ error: error.message || 'Webhook error' }, { status: 500 });
	}
}

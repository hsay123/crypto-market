import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '../../../lib/prisma';
import { ethers } from 'ethers';

// USDT and Escrow contract addresses
const USDT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_USDT_CONTRACT_ADDRESS || '0x...';
const ESCROW_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS || '0x...';
const PRIVATE_KEY = process.env.PRIVATE_KEY; // Server's private key for escrow release

// ERC20 ABI
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)"
];

// Escrow contract ABI
const ESCROW_ABI = [
  "function releaseTokens(string memory adId, address buyer, address token, uint256 amount) external"
];

// Get provider for Polygon Amoy
function getProvider() {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc-amoy.polygon.technology/';
  return new ethers.JsonRpcProvider(rpcUrl, {
    chainId: 80002,
    name: 'polygon-amoy'
  });
}

// Release USDT from escrow to buyer
async function releaseEscrow(adId: string, buyerAddress: string, usdtAmount: string) {
  if (!PRIVATE_KEY || !ESCROW_CONTRACT_ADDRESS) {
    throw new Error('Escrow configuration missing: PRIVATE_KEY or ESCROW_CONTRACT_ADDRESS not set');
  }

  const provider = getProvider();
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  const escrowContract = new ethers.Contract(ESCROW_CONTRACT_ADDRESS, ESCROW_ABI, signer);

  // USDT has 6 decimals
  const amountInWei = ethers.parseUnits(usdtAmount, 6);

  // Call releaseTokens on escrow contract
  const tx = await escrowContract.releaseTokens(adId, buyerAddress, USDT_CONTRACT_ADDRESS, amountInWei);
  const receipt = await tx.wait();

  if (!receipt || receipt.status !== 1) {
    throw new Error('Escrow release transaction failed');
  }

  return receipt.transactionHash;
}

// This endpoint receives payment webhooks from Razorpay
export async function POST(request: NextRequest) {
	try {
		const secret = process.env.RAZORPAY_KEY_SECRET || process.env.key_secret;
		if (!secret) {
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

		// Verify signature
		const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
		if (expected !== signature) {
			return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
		}

		// Handle payment.paid event
		if (payload.event === 'payment.captured' || payload.event === 'payment.authorized') {
			const payment = payload.payload?.payment?.entity;
			if (!payment) {
				return NextResponse.json({ error: 'Invalid payment data' }, { status: 400 });
			}

			const razorpayOrderId = payment.order_id;
			const razorpayPaymentId = payment.id;
			const amount = payment.amount; // Amount in paise
			const status = payment.status;

			// Only process if payment is captured/authorized
			if (status !== 'captured' && status !== 'authorized') {
				console.log(`Payment ${razorpayPaymentId} status is ${status}, skipping escrow release`);
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

			// Release USDT from escrow to buyer
			try {
				const releaseTxHash = await releaseEscrow(
					transaction.sellAdId,
					transaction.buyer.walletAddress,
					transaction.usdtAmount.toString()
				);

				// Update transaction and sell ad
				await prisma.$transaction([
					prisma.transaction.update({
						where: { id: transaction.id },
						data: {
							escrowReleaseTxHash: releaseTxHash,
							status: 'ESCROW_RELEASED'
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

				// Mark transaction as completed
				await prisma.transaction.update({
					where: { id: transaction.id },
					data: {
						status: 'COMPLETED'
					}
				});

				console.log(`Successfully released escrow for transaction ${transaction.id}, tx: ${releaseTxHash}`);
				return NextResponse.json({ 
					received: true, 
					verified: true,
					message: 'Payment processed and escrow released',
					releaseTxHash
				});
			} catch (error: any) {
				console.error('Error releasing escrow:', error);
				// Update transaction status to failed
				await prisma.transaction.update({
					where: { id: transaction.id },
					data: {
						status: 'FAILED'
					}
				});
				return NextResponse.json({ 
					error: 'Payment received but escrow release failed',
					details: error.message 
				}, { status: 500 });
			}
		}

		// For other events, just acknowledge
		console.log('Razorpay webhook event:', payload.event);
		return NextResponse.json({ received: true, verified: true });
	} catch (error: any) {
		console.error('Webhook error:', error);
		return NextResponse.json({ error: error.message || 'Webhook error' }, { status: 500 });
	}
}

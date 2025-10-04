// backend/src/services/payments.ts

import Stripe from 'stripe';
import { Request } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { sendPushToUser } from './notifications';

// --- Configuration ---
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!STRIPE_SECRET) { throw new Error('STRIPE_SECRET_KEY environment variable is not set.'); }

const stripe = new Stripe(STRIPE_SECRET, { apiVersion: '2023-10-16' });

// --- Public Functions ---

/**
 * @description Creates a new Stripe Checkout Session.
 */
export async function createCheckoutSession(
    userId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string
) {
    // 1. Ensure Stripe Customer ID exists
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, stripeCustomerId: true } });
    if (!user) { throw new AppError('User not found for payment processing.', 404, 'USER_NOT_FOUND_PAYMENT'); }
    
    let customerId = user.stripeCustomerId;
    if (!customerId) {
        const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } });
        customerId = customer.id;
        await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } });
    }

    // 2. Determine mode (payment or subscription)
    const price = await stripe.prices.retrieve(priceId);
    const mode: 'payment' | 'subscription' = price.type === 'recurring' ? 'subscription' : 'payment';
    
    // 3. Create Checkout Session
    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: mode,
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { userId, priceType: price.metadata.priceType || 'UNKNOWN' }, // Pass custom internal type
    });

    return session;
}

/**
 * @description Processes a raw Stripe webhook event.
 */
export function processWebhook(req: Request): Stripe.Event {
    if (!STRIPE_WEBHOOK_SECRET) { throw new Error('Stripe Webhook Secret not configured.'); }

    const sig = req.headers['stripe-signature'];
    const rawBody = (req as any).rawBody;

    try {
        const event = stripe.webhooks.constructEvent(rawBody, sig!, STRIPE_WEBHOOK_SECRET);
        return event;
    } catch (err) {
        console.error('⚠️ Webhook signature verification failed.', (err as Error).message);
        throw new AppError('Webhook Signature Invalid', 400, 'STRIPE_WEBHOOK_FAIL');
    }
}

/**
 * @description Handles the business logic for specific Stripe events.
 */
export async function handleStripeEvent(event: Stripe.Event) {
    const data = event.data.object as any;
    const userId = data.metadata?.userId;
    
    // Advanced: Handle Product Catalog Sync (e.g., store price/product info locally)
    if (event.type === 'product.created' || event.type === 'product.updated') {
        // const product = data as Stripe.Product;
        console.log(`Product event handled: ${event.type} - ${data.id}`);
        // Logic to update local product catalog in Redis/DB
        return;
    }

    if (!userId) { return; }

    switch (event.type) {
        case 'checkout.session.completed':
            const session = data as Stripe.Checkout.Session;
            const priceType = session.metadata?.priceType || 'UNKNOWN';
            
            await creditUserForPurchase(userId, priceType);
            break;

        case 'customer.subscription.created':
        case 'invoice.paid':
            // const sub = data as Stripe.Subscription;
            await prisma.profile.update({
                where: { userId },
                data: { isPremium: true },
            });
            sendPushToUser(userId, { title: 'Premium Active', body: 'Your subscription is now live!', priority: 'high' });
            break;

        case 'customer.subscription.deleted':
            await prisma.profile.update({
                where: { userId },
                data: { isPremium: false },
            });
            break;

        default:
            console.log(`Unhandled event type ${event.type}`);
    }
}

/**
 * @description Business logic to update user account after a successful ONE-TIME purchase.
 */
async function creditUserForPurchase(userId: string, priceType: string) {
    console.log(`Crediting user ${userId} for purchase type: ${priceType}`);

    // Advanced: Granular credit for consumables
    if (priceType === 'BOOST') {
        await prisma.boost.create({
            data: { userId, type: 'PROFILE_BOOST', expiresAt: new Date(Date.now() + 60 * 60 * 1000) }, // 1 hour boost
        });
        sendPushToUser(userId, { title: 'Boost Activated!', body: 'Your profile is now featured!', priority: 'high' });
    } else if (priceType.includes('SUPER_LIKE')) {
        // Update a credit counter field on the Profile table (conceptual)
        console.log(`Credited Super Likes to user ${userId}`);
    }
}
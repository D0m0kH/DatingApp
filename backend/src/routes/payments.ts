// backend/src/routes/payments.ts

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { createCheckoutSession, processWebhook, handleStripeEvent } from '../services/payments';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { AppError } from '../utils/errors';
import bodyParser from 'body-parser';

const router = Router();

// Zod schema for checkout session request (simplified as the service handles price details)
const CheckoutSchema = z.object({
    priceId: z.string().min(1),
    successUrl: z.string().url(),
    cancelUrl: z.string().url(),
});

/**
 * POST /api/payments/create-checkout-session
 * Creates a Stripe checkout session URL. Requires auth.
 */
router.post(
  '/create-checkout-session',
  requireAuth,
  validateBody(CheckoutSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id;
        const { priceId, successUrl, cancelUrl } = req.validatedBody;

        const session = await createCheckoutSession(
            userId,
            priceId,
            successUrl,
            cancelUrl
        );

        res.status(200).json({ url: session.url, sessionId: session.id });
    } catch (error) {
        next(error);
    }
  }
);

/**
 * POST /api/payments/webhook
 * Handles incoming Stripe webhooks. Must use raw body for signature verification.
 */
// Use body-parser to get the raw body string *only* for this route
router.post(
  '/webhook',
  bodyParser.raw({ type: 'application/json', limit: '5mb' }),
  async (req: Request, res: Response) => {
    try {
        // Ensure raw body is available
        (req as any).rawBody = req.body.toString('utf8');

        // 1. Validate signature and parse event
        const event = processWebhook(req);

        // 2. Handle business logic
        await handleStripeEvent(event);

        // 3. Acknowledge receipt
        res.json({ received: true });

    } catch (error) {
        if (error instanceof AppError) {
            console.error('Webhook error:', error.message);
            return res.status(error.statusCode).send({ error: error.message });
        }
        console.error('Unexpected webhook error:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
  }
);

export default router;
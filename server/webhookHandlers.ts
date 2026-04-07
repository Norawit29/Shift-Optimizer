import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { stripeStorage } from './stripeStorage';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    // Let stripe-replit-sync process and sync data to stripe schema
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    // Also parse the event to update our users table
    try {
      const stripe = await getUncachableStripeClient();
      // Re-construct the event from the raw payload for our own processing
      const event = JSON.parse(payload.toString());

      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const sub = event.data.object;
          const customerId = sub.customer;
          if (customerId && sub.id) {
            const user = await stripeStorage.getUserByStripeCustomerId(customerId);
            if (user) {
              const isActive = ['active', 'trialing'].includes(sub.status);
              await stripeStorage.updateUserStripeInfo(user.id, {
                stripeSubscriptionId: isActive ? sub.id : null,
              });
            }
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object;
          const customerId = sub.customer;
          if (customerId) {
            const user = await stripeStorage.getUserByStripeCustomerId(customerId);
            if (user) {
              await stripeStorage.updateUserStripeInfo(user.id, {
                stripeSubscriptionId: null,
              });
            }
          }
          break;
        }
      }
    } catch (err) {
      // Non-critical: stripe schema is already synced, just log
      console.error('[webhook] user table sync error:', err);
    }
  }
}

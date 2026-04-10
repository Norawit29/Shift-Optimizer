import { db } from './db';
import { users } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

export class StripeStorage {
  async getSubscription(subscriptionId: string) {
    try {
      const result = await db.execute(
        sql`SELECT * FROM stripe.subscriptions WHERE id = ${subscriptionId}`
      );
      return result.rows[0] || null;
    } catch {
      return null;
    }
  }

  async listProductsWithPrices() {
    try {
      const result = await db.execute(
        sql`
          WITH paginated_products AS (
            SELECT id, name, description, metadata, active
            FROM stripe.products
            WHERE active = true
            ORDER BY id
          )
          SELECT
            p.id as product_id,
            p.name as product_name,
            p.description as product_description,
            p.active as product_active,
            p.metadata as product_metadata,
            pr.id as price_id,
            pr.unit_amount,
            pr.currency,
            pr.recurring,
            pr.active as price_active
          FROM paginated_products p
          LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
          ORDER BY p.id, pr.unit_amount
        `
      );
      return result.rows;
    } catch {
      return [];
    }
  }

  async getUserByStripeCustomerId(customerId: string) {
    const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, customerId));
    return user || null;
  }

  async updateUserStripeInfo(userId: number, stripeInfo: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string | null;
    proSlots?: number | null;
  }) {
    const [user] = await db.update(users).set(stripeInfo).where(eq(users.id, userId)).returning();
    return user;
  }

  // Look up active subscription by customer ID (not relying on stripeSubscriptionId field)
  // This works as soon as stripe-replit-sync syncs the subscription to the stripe schema
  async getUserActiveSubscription(userId: number) {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return null;

    try {
      // Primary: query by customer ID (works after stripe-replit-sync backfill)
      if (user.stripeCustomerId) {
        const result = await db.execute(
          sql`SELECT * FROM stripe.subscriptions
              WHERE customer = ${user.stripeCustomerId}
              AND status IN ('active', 'trialing')
              ORDER BY created DESC
              LIMIT 1`
        );
        if (result.rows[0]) return result.rows[0];
      }

      // Fallback: query by subscription ID if stored
      if (user.stripeSubscriptionId) {
        const result = await db.execute(
          sql`SELECT * FROM stripe.subscriptions
              WHERE id = ${user.stripeSubscriptionId}
              AND status IN ('active', 'trialing')`
        );
        if (result.rows[0]) return result.rows[0];
      }

      return null;
    } catch {
      return null;
    }
  }
}

export const stripeStorage = new StripeStorage();

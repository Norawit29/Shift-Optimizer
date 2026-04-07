import { getUncachableStripeClient } from '../server/stripeClient';

async function updatePrices() {
  const stripe = await getUncachableStripeClient();

  // Find the Pro product
  const products = await stripe.products.search({
    query: "name:'Shift Optimizer Pro' AND active:'true'"
  });

  if (products.data.length === 0) {
    console.error('Shift Optimizer Pro product not found');
    process.exit(1);
  }

  const product = products.data[0];
  console.log(`Found product: ${product.name} (${product.id})`);

  // List current active prices
  const prices = await stripe.prices.list({ product: product.id, active: true });
  console.log('\nCurrent active prices:');
  prices.data.forEach(p => {
    const amount = p.unit_amount! / 100;
    const interval = (p.recurring as any)?.interval;
    console.log(`  ${p.id} - ฿${amount}/${interval}`);
  });

  // Find and archive old yearly price (฿2499 = 229900 satang... wait, THB doesn't have satang in Stripe unit_amount)
  // In Stripe, THB uses unit_amount directly (no subunit), so ฿2499 = unit_amount 249900? Let's check
  // Actually Stripe THB: 1 baht = 100 satang, but unit_amount is in the smallest currency unit
  // For THB: unit_amount 249900 = ฿2499.00

  const oldYearlyPrice = prices.data.find(p =>
    (p.recurring as any)?.interval === 'year' && p.unit_amount && p.unit_amount < 350000
  );

  if (oldYearlyPrice) {
    console.log(`\nArchiving old yearly price: ${oldYearlyPrice.id} (฿${oldYearlyPrice.unit_amount!/100}/year)`);
    await stripe.prices.update(oldYearlyPrice.id, { active: false });
    console.log('Old yearly price archived.');
  } else {
    console.log('\nNo old yearly price found to archive.');
  }

  // Create new yearly price at 15% off monthly (฿299/month × 12 × 0.85 = ฿3,049.8 → ฿3,049)
  // unit_amount for ฿3,049 = 304900 (in satang)
  const monthlyPrice = prices.data.find(p => (p.recurring as any)?.interval === 'month');
  if (!monthlyPrice) {
    console.error('Monthly price not found');
    process.exit(1);
  }

  const monthlyAmount = monthlyPrice.unit_amount!; // e.g. 29900 = ฿299
  // 15% off, rounded to nearest ฿1 (100 satang)
  const yearlyAmount = Math.round(monthlyAmount * 12 * 0.85 / 100) * 100;
  const yearlyBaht = yearlyAmount / 100;

  console.log(`\nCreating new yearly price at ฿${yearlyBaht}/year (15% off from ฿${monthlyAmount/100}/month × 12)`);

  const newYearlyPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: yearlyAmount,
    currency: 'thb',
    recurring: { interval: 'year' },
    nickname: '15% off yearly',
  });

  console.log(`\n✅ New yearly price created: ${newYearlyPrice.id} (฿${yearlyBaht}/year)`);
  console.log('\nDone! stripe-replit-sync will pick up the new price on next sync.');
}

updatePrices().catch(console.error);

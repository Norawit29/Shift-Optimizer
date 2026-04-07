import { getUncachableStripeClient } from '../server/stripeClient';

async function createProducts() {
  try {
    const stripe = await getUncachableStripeClient();

    console.log('Creating products and prices in Stripe...');

    const existingProducts = await stripe.products.search({
      query: "name:'Shift Optimizer Pro' AND active:'true'"
    });

    if (existingProducts.data.length > 0) {
      console.log('Shift Optimizer Pro already exists. Skipping creation.');
      const product = existingProducts.data[0];
      console.log(`Existing product ID: ${product.id}`);
      const prices = await stripe.prices.list({ product: product.id, active: true });
      prices.data.forEach(p => {
        console.log(`  Price: ${p.id} - ${p.unit_amount! / 100} ${p.currency}/${(p.recurring as any)?.interval}`);
      });
      return;
    }

    const proProduct = await stripe.products.create({
      name: 'Shift Optimizer Pro',
      description: 'ปลดล็อกทุกฟีเจอร์: บุคลากรไม่จำกัด, เวรไม่จำกัด, ระดับบุคลากรไม่จำกัด, เกลี่ยวันหยุด, ตารางรายบุคคล และส่งออก Excel',
      metadata: {
        plan: 'pro',
      },
    });
    console.log(`Created product: ${proProduct.name} (${proProduct.id})`);

    const monthlyPrice = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: 29900,
      currency: 'thb',
      recurring: { interval: 'month' },
    });
    console.log(`Created monthly price: ฿299/month (${monthlyPrice.id})`);

    const yearlyPrice = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: 249900,
      currency: 'thb',
      recurring: { interval: 'year' },
    });
    console.log(`Created yearly price: ฿2499/year (${yearlyPrice.id})`);

    console.log('\n✓ Products and prices created successfully!');
    console.log('Webhooks will sync this data to your database automatically.');
  } catch (error: any) {
    console.error('Error creating products:', error.message);
    process.exit(1);
  }
}

createProducts();

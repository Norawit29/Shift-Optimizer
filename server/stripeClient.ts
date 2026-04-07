// This file will be replaced with the actual Replit Stripe integration template
// after connecting the Stripe integration. The functions below provide graceful
// error messages until then.

let _stripeSync: any = null;

export async function getStripeSync(): Promise<any> {
  if (!_stripeSync) {
    const { default: StripeSync } = await import("stripe-replit-sync");
    _stripeSync = new StripeSync();
    await _stripeSync.initialize();
  }
  return _stripeSync;
}

export async function getUncachableStripeClient(): Promise<any> {
  const sync = await getStripeSync();
  return sync.stripe;
}

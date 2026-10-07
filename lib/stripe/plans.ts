/**
 * Piani a pagamento e prezzi Stripe.
 *
 * Il prezzo lo sceglie il server: il browser dice solo quale piano vuole.
 * Prima mandava anche il `priceId` e il nome del piano, e il webhook attivava
 * il piano letto dai metadata: si poteva pagare il prezzo più basso e ricevere
 * il piano più alto. Ora il webhook ricava il piano dal prezzo pagato.
 *
 * Gli ID dei prezzi non sono segreti: stanno anche nella pagina di checkout.
 */

export const PLANS = {
  pro: { priceId: 'price_1UKxvO68FlpSo6ExsBnWibmH' },
  scale: { priceId: 'price_1UKxvT68FlpSo6ExSYeKdA0Z' },
} as const;

export type PlanId = keyof typeof PLANS;

/**
 * Limiti di ogni piano, per workspace (gli stessi della finestra di upgrade).
 * Il piano pagato vale per il workspace scelto al checkout.
 */
export const PLAN_QUOTAS = {
  free: { storageLimit: 1_000_000_000, aiCreditsLimit: 120 },
  pro: { storageLimit: 15_000_000_000, aiCreditsLimit: 1200 },
  scale: { storageLimit: 100_000_000_000, aiCreditsLimit: 2500 },
} as const;

export type PlanTier = keyof typeof PLAN_QUOTAS;

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PLANS, value);
}

export function planForPrice(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  const match = (Object.keys(PLANS) as PlanId[]).find(plan => PLANS[plan].priceId === priceId);
  return match || null;
}

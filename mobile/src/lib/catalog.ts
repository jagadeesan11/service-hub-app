/**
 * Describing the catalogue in the words a shop owner uses.
 *
 * Pure and dependency-free — these summaries appear on every row, and the
 * promo rules decide whether a code can be saved at all.
 */

const PRICE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export interface CatalogService {
  base_price: number;
  duration_minutes: number | null;
  is_active: boolean;
  pricing_rules?: { price: number }[] | null;
  addons?: { id: string }[] | null;
}

/**
 * What a job actually starts at.
 *
 * The lowest pricing tier when there are tiers, because that is the number a
 * customer sees first. base_price is only a fallback — for a tiered service it
 * is the price of nothing in particular.
 */
export function startingPrice(s: CatalogService): number {
  const tiers = (s.pricing_rules ?? []).map((r) => Number(r.price)).filter((n) => Number.isFinite(n));
  return tiers.length > 0 ? Math.min(...tiers) : Number(s.base_price);
}

export function formatDuration(minutes: number | null): string | null {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr`;
}

/** The one line under a service name: price, how long, how many extras. */
export function serviceSummary(s: CatalogService): string {
  const parts = [`From ${PRICE.format(startingPrice(s))}`];
  const duration = formatDuration(s.duration_minutes);
  if (duration) parts.push(duration);

  const addons = (s.addons ?? []).length;
  if (addons > 0) parts.push(`${addons} add-on${addons > 1 ? 's' : ''}`);

  return parts.join(' · ');
}

export interface CatalogPromo {
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_discount_amount: number | null;
  min_order_value: number;
  ends_at: string | null;
  is_active: boolean;
}

/** "15% off, up to ₹2,000 · over ₹5,000 · until 30 Sep" */
export function promoSummary(p: CatalogPromo): string {
  const off =
    p.discount_type === 'percentage'
      ? `${p.discount_value}% off` +
        (p.max_discount_amount ? `, up to ${PRICE.format(p.max_discount_amount)}` : '')
      : `${PRICE.format(p.discount_value)} off`;

  const parts = [off];
  if (p.min_order_value > 0) parts.push(`over ${PRICE.format(p.min_order_value)}`);
  parts.push(
    p.ends_at
      ? `until ${new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(p.ends_at))}`
      : 'no end date',
  );
  return parts.join(' · ');
}

export type PromoState = 'live' | 'paused' | 'scheduled' | 'expired';

/**
 * A code's real state, which is not the same as its is_active flag.
 *
 * An expired code with is_active still true is off, and saying "Live" would be
 * a lie the owner acts on.
 */
export function promoState(p: CatalogPromo & { starts_at?: string | null }, now: Date = new Date()): PromoState {
  if (!p.is_active) return 'paused';
  if (p.starts_at && new Date(p.starts_at) > now) return 'scheduled';
  if (p.ends_at && new Date(p.ends_at) < now) return 'expired';
  return 'live';
}

export interface PromoDraft {
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: string;
}

/**
 * Whether a draft code can be saved.
 *
 * Mirrors the database constraints rather than inventing looser ones — a form
 * that accepts what the table will reject just moves the failure later.
 */
export function validatePromoDraft(d: PromoDraft): string | null {
  const code = d.code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    return 'A code is 3–32 characters: letters, digits, hyphen or underscore.';
  }

  const value = Number(d.discount_value);
  if (!Number.isFinite(value) || value <= 0) return 'The discount must be more than zero.';
  if (d.discount_type === 'percentage' && value > 100) {
    return 'A percentage discount cannot be more than 100.';
  }
  return null;
}

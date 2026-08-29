export type DiscountType = 'percentage' | 'fixed';
export type AppliesTo = 'all' | 'category' | 'service';

export interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  max_discount_amount: number | null;
  min_order_value: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  max_redemptions: number | null;
  per_customer_limit: number | null;
  applies_to: AppliesTo;
  category_ids: string[];
  service_ids: string[];
  is_public: boolean;
  created_at: string;
}

/** A code plus how much of it has actually been used. */
export interface PromoCodeWithUsage extends PromoCode {
  redeemed: number;
  discounted_total: number;
}

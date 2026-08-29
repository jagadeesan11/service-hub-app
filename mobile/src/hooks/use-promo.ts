import { useMutation, useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

/** What validate_promo_code answers with. Invalid results carry the reason. */
export interface PromoValidation {
  valid: boolean;
  reason?: string;
  promo_code_id?: string;
  code?: string;
  description?: string | null;
  discount_amount?: number;
  net_price?: number;
  gross?: number;
}

export interface PublicPromoCode {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_discount_amount: number | null;
  min_order_value: number;
  ends_at: string | null;
}

/**
 * The codes worth advertising.
 *
 * No filtering here on purpose: the RLS policy on promo_codes already returns
 * only those that are public, active and inside their date window. Repeating
 * those conditions in the client would be a second copy to keep in step, and
 * the database's answer is the one that counts.
 */
export function usePublicPromoCodes() {
  return useQuery({
    queryKey: ['promo_codes', 'public'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promo_codes')
        .select(
          'id, code, description, discount_type, discount_value, max_discount_amount, min_order_value, ends_at',
        )
        .order('created_at', { ascending: false })
        .returns<PublicPromoCode[]>();

      if (error) throw error;
      return data;
    },
  });
}

/**
 * Checks a code against a specific job.
 *
 * Whether a code applies depends on the service, the vehicle and the add-ons,
 * so this cannot be answered from the code alone — and it is answered by the
 * same database function that create_booking will run again at booking time.
 */
export function useValidatePromoCode() {
  return useMutation({
    mutationFn: async (input: {
      code: string;
      serviceId: string;
      assetId: string | null;
      addonIds: string[];
    }) => {
      const { data, error } = await supabase.rpc('validate_promo_code', {
        p_code: input.code,
        p_service_id: input.serviceId,
        p_asset_id: input.assetId,
        p_addon_ids: input.addonIds,
      });

      if (error) throw error;
      return data as PromoValidation;
    },
  });
}

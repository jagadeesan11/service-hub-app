import { useQuery } from '@tanstack/react-query';

import { SUPPORT_EMAIL, SUPPORT_PHONE } from '@/constants/links';
import { supabase } from '@/lib/supabase';

export interface AppSettings {
  shop_name: string;
  support_email: string | null;
  support_phone: string | null;
  shop_address_line: string | null;
  shop_city: string | null;
  shop_postal_code: string | null;
  cod_enabled: boolean;
  online_payment_enabled: boolean;
  privacy_url: string | null;
  terms_url: string | null;
}

/** Used until the network answers, and if it never does. The app must still
 *  render a shop name and a way to reach support offline. */
export const FALLBACK_SETTINGS: AppSettings = {
  shop_name: 'Nexora',
  support_email: SUPPORT_EMAIL,
  support_phone: SUPPORT_PHONE,
  shop_address_line: null,
  shop_city: null,
  shop_postal_code: null,
  cod_enabled: false,
  online_payment_enabled: true,
  privacy_url: null,
  terms_url: null,
};

/**
 * Shop details the admin configures at runtime. Readable without a session,
 * so the sign-in screen can use it too.
 */
export function useAppSettings() {
  const query = useQuery({
    queryKey: ['app_settings'],
    // Changes are rare and an admin edit does not need to reach a phone
    // mid-session, but a cold start should not show yesterday's phone number.
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select(
          'shop_name, support_email, support_phone, shop_address_line, shop_city, shop_postal_code, cod_enabled, online_payment_enabled, privacy_url, terms_url',
        )
        .maybeSingle<AppSettings>();

      if (error) throw error;
      return data ?? FALLBACK_SETTINGS;
    },
  });

  return {
    ...query,
    // Callers want a value, not a maybe — every field has a sane default.
    settings: query.data ?? FALLBACK_SETTINGS,
  };
}

export function formatShopAddress(settings: AppSettings): string | null {
  const parts = [settings.shop_address_line, settings.shop_city, settings.shop_postal_code];
  const address = parts.filter(Boolean).join(', ');
  return address || null;
}

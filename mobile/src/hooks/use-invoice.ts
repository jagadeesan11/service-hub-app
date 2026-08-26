import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export interface InvoiceParty {
  name?: string | null;
  address_line?: string | null;
  city?: string | null;
  postal_code?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface Invoice {
  id: string;
  number: string;
  issued_at: string;
  line_items: { description: string; amount: number }[];
  total: number;
  payment_method: string;
  seller: InvoiceParty;
  buyer: InvoiceParty;
}

/** The bill for a booking, or null until the job is marked complete. */
export function useInvoice(bookingId: string | undefined) {
  return useQuery({
    queryKey: ['invoice', bookingId],
    enabled: Boolean(bookingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, number, issued_at, line_items, total, payment_method, seller, buyer')
        .eq('booking_id', bookingId!)
        .maybeSingle<Invoice>();

      if (error) throw error;
      return data;
    },
  });
}

export function formatParty(p: InvoiceParty): string {
  // Segments are trimmed of trailing punctuation before joining, or an
  // address line typed with a trailing comma renders as "Street,, City".
  return [p.address_line, p.city, p.postal_code]
    .map((s) => s?.trim().replace(/[,;]+$/, '').trim())
    .filter(Boolean)
    .join(', ');
}

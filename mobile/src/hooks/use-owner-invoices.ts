import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export interface OwnerInvoice {
  id: string;
  booking_id: string;
  number: string;
  issued_at: string;
  line_items: { description: string; amount: number }[];
  total: number;
  payment_method: string;
  seller: Record<string, string | null>;
  buyer: Record<string, string | null>;
  bookings: {
    scheduled_at: string;
    services: { name: string } | null;
    payments: { status: string }[] | null;
  } | null;
}

const FIELDS =
  'id, booking_id, number, issued_at, line_items, total, payment_method, seller, buyer, ' +
  'bookings(scheduled_at, services(name), payments(status))';

/**
 * Every bill the shop has raised, newest first.
 *
 * Read-only by design. Invoices are raised by the database when a job is
 * marked complete and frozen at that moment — there is no create, edit or
 * delete here, because a bill that can be rewritten afterwards is not a
 * record of anything.
 */
export function useOwnerInvoices() {
  return useQuery({
    queryKey: ['owner', 'invoices'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(FIELDS)
        .order('issued_at', { ascending: false })
        .returns<OwnerInvoice[]>();

      if (error) throw error;
      return data;
    },
  });
}

export function useOwnerInvoice(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ['owner', 'invoice', invoiceId],
    enabled: Boolean(invoiceId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(FIELDS)
        .eq('id', invoiceId!)
        .single()
        .returns<OwnerInvoice>();

      if (error) throw error;
      return data;
    },
  });
}

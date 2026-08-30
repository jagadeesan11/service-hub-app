import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { ReportBooking } from '@/lib/reports';

/**
 * Everything the reports screen measures.
 *
 * Deliberately not reusing useOwnerBookings: that one is the live board and
 * refetches on focus, while this is a wider historical pull that should not
 * churn every time the app comes forward.
 */
export function useReportBookings() {
  return useQuery({
    queryKey: ['owner', 'reports'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('scheduled_at, status, net_price, payment_method, services(name), technicians(name)')
        .order('scheduled_at', { ascending: false })
        .returns<ReportBooking[]>();

      if (error) throw error;
      return data;
    },
  });
}

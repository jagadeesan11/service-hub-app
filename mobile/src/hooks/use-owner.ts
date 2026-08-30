import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

/**
 * The shop-side view of a booking.
 *
 * Read through the same `bookings_select` policy the customer app uses — it
 * already returns every row to an admin or shop owner, and only their own
 * assigned jobs to a technician. No separate endpoint, and no way for the app
 * to ask for more than the role allows.
 */
export interface OwnerBooking {
  id: string;
  scheduled_at: string;
  status: string;
  total_price: number;
  discount_amount: number;
  promo_discount_amount: number;
  net_price: number;
  payment_method: string;
  technician_id: string | null;
  needs_pickup: boolean;
  contact_name: string | null;
  contact_phone: string | null;
  service_address: string | null;
  service_city: string | null;
  services: { id: string; name: string; duration_minutes: number | null } | null;
  technicians: { id: string; name: string; phone: string | null } | null;
  profiles: { name: string | null; phone: string | null } | null;
  customer_assets: { attributes: Record<string, string> } | null;
  payments: { status: string }[] | null;
}

const BOOKING_FIELDS =
  'id, scheduled_at, status, total_price, discount_amount, promo_discount_amount, net_price, ' +
  'payment_method, technician_id, needs_pickup, contact_name, contact_phone, service_address, service_city, ' +
  'services(id, name, duration_minutes), technicians(id, name, phone), ' +
  'profiles:user_id(name, phone), customer_assets:asset_id(attributes), payments(status)';

export function useOwnerBookings() {
  return useQuery({
    queryKey: ['owner', 'bookings'],
    // The shop floor changes minute to minute — a stale board is worse than a
    // brief spinner, so this refetches whenever the app comes back to front.
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(BOOKING_FIELDS)
        .order('scheduled_at', { ascending: true })
        .returns<OwnerBooking[]>();

      if (error) throw error;
      return data;
    },
  });
}

export interface OwnerTechnician {
  id: string;
  name: string;
  phone: string | null;
  /** Plural: a technician can cover several verticals. */
  category_ids: string[];
  status: 'active' | 'inactive';
  rating_avg: number | null;
  rating_count: number;
}

export const TECHNICIAN_FIELDS = 'id, name, phone, category_ids, status, rating_avg, rating_count';

/**
 * The people who can be given a job.
 *
 * Only `active` ones: someone marked inactive has left or is off, and offering
 * them in the assign sheet is how a job ends up with nobody actually on it.
 */
export function useTechnicians() {
  return useQuery({
    queryKey: ['owner', 'technicians'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('technicians')
        .select(TECHNICIAN_FIELDS)
        .eq('status', 'active')
        .order('name')
        .returns<OwnerTechnician[]>();

      if (error) throw error;
      return data;
    },
  });
}

/**
 * Assigning a job, and moving it along afterwards.
 *
 * Plain updates rather than an RPC: the database already decides what an admin
 * may change (enforce_customer_booking_transitions exempts them) and refuses
 * everything else, so there is nothing extra to enforce here.
 */
export function useUpdateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      bookingId: string;
      status?: string;
      technicianId?: string | null;
    }) => {
      const patch: Record<string, unknown> = {};
      if (input.status !== undefined) patch.status = input.status;
      if (input.technicianId !== undefined) patch.technician_id = input.technicianId;

      const { data, error } = await supabase
        .from('bookings')
        .update(patch)
        .eq('id', input.bookingId)
        .select('id');

      if (error) throw error;
      // PostgREST answers 204 for a write that matched nothing, which reads as
      // success; the returned rows are what prove it landed.
      if (!data || data.length === 0) throw new Error('That booking no longer exists.');
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

/**
 * Marking cash-on-delivery money as actually received.
 *
 * Writes the payment row rather than the booking: the booking is already
 * `completed` at this point, and what changed is that the notes are in the
 * till. admin_mark_paid_offline is the wrong tool — it only accepts a booking
 * still awaiting payment.
 *
 * enforce_payment_integrity refuses a status change from anyone who is not an
 * admin, so this fails safely for a technician.
 */
export function useCollectCash() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { data, error } = await supabase
        .from('payments')
        .update({ status: 'paid' })
        .eq('booking_id', bookingId)
        .neq('status', 'paid')
        .select('id');

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('No unpaid payment was found against this job.');
      }
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

/** One job, for the detail screen. Same fields, same policy, one row. */
export function useOwnerBooking(bookingId: string | undefined) {
  return useQuery({
    queryKey: ['owner', 'booking', bookingId],
    enabled: Boolean(bookingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(BOOKING_FIELDS)
        .eq('id', bookingId!)
        .single()
        .returns<OwnerBooking>();

      if (error) throw error;
      return data;
    },
  });
}

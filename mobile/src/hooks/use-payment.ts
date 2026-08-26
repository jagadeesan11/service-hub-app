import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export interface RazorpayOrder {
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
}

export function useCreateRazorpayOrder() {
  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { data, error } = await supabase.functions.invoke<RazorpayOrder>(
        'create-razorpay-order',
        { body: { booking_id: bookingId } },
      );

      if (error) throw error;
      if (!data) throw new Error('No response from create-razorpay-order.');
      return data;
    },
  });
}

/**
 * Hands the checkout result to the server to settle.
 *
 * The client deliberately does not write `paid` or `confirmed` itself — the
 * database refuses those writes from a customer session, because a client
 * that can confirm its own booking has made the payment step optional.
 */
export function useConfirmPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      bookingId: string;
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    }) => {
      const { data, error } = await supabase.functions.invoke<{ status: string }>(
        'verify-razorpay-payment',
        {
          body: {
            booking_id: input.bookingId,
            razorpay_order_id: input.razorpayOrderId,
            razorpay_payment_id: input.razorpayPaymentId,
            razorpay_signature: input.razorpaySignature,
          },
        },
      );

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

/**
 * Switches a pending booking to cash on delivery and confirms it.
 *
 * A Postgres function rather than a table write: it has to re-check that COD
 * is switched on and that the booking is really the caller's, and neither of
 * those is something a client can be trusted to have checked.
 */
export function useChooseCashOnDelivery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase.rpc('choose_cash_on_delivery', {
        p_booking_id: bookingId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

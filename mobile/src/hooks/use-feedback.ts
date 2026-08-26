import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export interface ServiceFeedback {
  id: string;
  booking_id: string;
  rating: number;
  comment: string | null;
  tags: string[];
  admin_response: string | null;
  responded_at: string | null;
  created_at: string;
}

/** The review for one booking, or null if it has not been left yet. */
export function useBookingFeedback(bookingId: string | undefined) {
  return useQuery({
    queryKey: ['feedback', bookingId],
    enabled: Boolean(bookingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_feedback')
        .select('id, booking_id, rating, comment, tags, admin_response, responded_at, created_at')
        .eq('booking_id', bookingId!)
        .maybeSingle<ServiceFeedback>();

      if (error) throw error;
      return data;
    },
  });
}

/**
 * The quick-pick chips for a booking's category.
 *
 * Category-driven so a second vertical asks its own questions — home cleaning
 * should not be asking about finish quality — without a code change.
 */
export function useFeedbackTags(serviceId: string | undefined) {
  return useQuery({
    queryKey: ['feedback', 'tags', serviceId],
    enabled: Boolean(serviceId),
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('categories(feedback_tags)')
        .eq('id', serviceId!)
        .single<{ categories: { feedback_tags: string[] } | null }>();

      if (error) throw error;
      return data.categories?.feedback_tags ?? [];
    },
  });
}

export function useSubmitFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      bookingId: string;
      userId: string;
      rating: number;
      comment: string;
      tags: string[];
    }) => {
      // service_id and technician_id are deliberately not sent: the trigger
      // derives them from the booking, so a review cannot be attributed to a
      // service or technician that had nothing to do with the job. NOT NULL
      // and foreign keys are checked after BEFORE INSERT triggers run, so
      // omitting them is safe. user_id is sent because the RLS WITH CHECK
      // needs it and the client legitimately knows its own id.
      const { data, error } = await supabase
        .from('service_feedback')
        .insert({
          booking_id: input.bookingId,
          user_id: input.userId,
          rating: input.rating,
          comment: input.comment.trim() || null,
          tags: input.tags,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['feedback', variables.bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

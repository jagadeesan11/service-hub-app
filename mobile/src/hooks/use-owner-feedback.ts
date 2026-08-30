import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export interface OwnerReview {
  id: string;
  booking_id: string;
  rating: number;
  comment: string | null;
  tags: string[];
  is_published: boolean;
  admin_response: string | null;
  responded_at: string | null;
  created_at: string;
  services: { name: string } | null;
  technicians: { name: string } | null;
  profiles: { name: string | null; phone: string | null } | null;
}

const FIELDS =
  'id, booking_id, rating, comment, tags, is_published, admin_response, responded_at, created_at, ' +
  'services(name), technicians(name), profiles:user_id(name, phone)';

/**
 * Every review, worst first.
 *
 * Ordered by rating rather than date on purpose: an unanswered one-star from
 * last week matters more than a five-star from this morning, and the screen
 * exists to get complaints answered.
 */
export function useOwnerFeedback() {
  return useQuery({
    queryKey: ['owner', 'feedback'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_feedback')
        .select(FIELDS)
        .order('rating', { ascending: true })
        .order('created_at', { ascending: false })
        .returns<OwnerReview[]>();

      if (error) throw error;
      return data;
    },
  });
}

/**
 * Answering a review.
 *
 * enforce_feedback_integrity refuses admin_response from anyone who is not an
 * admin, so a technician reaching this code path fails at the database rather
 * than quietly writing.
 */
export function useReplyToReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; reply: string }) => {
      const text = input.reply.trim();
      if (!text) throw new Error('Write something before sending.');

      const { data, error } = await supabase
        .from('service_feedback')
        .update({ admin_response: text, responded_at: new Date().toISOString() })
        .eq('id', input.id)
        .select('id');

      if (error) throw error;
      // PostgREST answers 204 for a write that matched nothing, which reads as
      // success; the returned rows are what prove it landed.
      if (!data || data.length === 0) throw new Error('That review no longer exists.');
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner', 'feedback'] });
    },
  });
}

/**
 * Hiding a review, or putting it back.
 *
 * A soft hide, never a delete — pulling an abusive comment must not quietly
 * improve the shop's average, and the row stays for the record.
 */
export function useSetReviewPublished() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; published: boolean }) => {
      const { data, error } = await supabase
        .from('service_feedback')
        .update({ is_published: input.published })
        .eq('id', input.id)
        .select('id');

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('That review no longer exists.');
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner', 'feedback'] });
    },
  });
}

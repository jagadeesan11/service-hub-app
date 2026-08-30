import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type Gender = 'female' | 'male' | 'other' | 'undisclosed';

/** Decides which app a signed-in person sees. Mirrors profiles.role. */
export type UserRole = 'customer' | 'technician' | 'admin' | 'shop_owner';

export interface Profile {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  address_line: string | null;
  city: string | null;
  postal_code: string | null;
  gender: Gender | null;
  role: UserRole;
  onboarded_at: string | null;
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, phone, email, address_line, city, postal_code, gender, onboarded_at, role')
        .eq('id', userId!)
        .single();

      if (error) throw error;
      return data as Profile;
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, ...patch }: Partial<Profile> & { userId: string }) => {
      const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['profile', variables.userId] });
    },
  });
}

/**
 * Count of the signed-in customer's bookings, for the Order history row.
 * Keyed by user for the same reason as `useMyBookings`.
 */
export function useBookingCount(userId?: string) {
  return useQuery({
    queryKey: ['bookings', 'count', userId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true });

      if (error) throw error;
      return count ?? 0;
    },
  });
}

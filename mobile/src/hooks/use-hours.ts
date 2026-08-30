import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { BusinessHours, ShopClosure } from '@/lib/scheduling';

/**
 * Opening hours and blocked days.
 *
 * Readable without a session, like the shop name and address, because the slot
 * picker needs them before anyone signs in.
 */
export function useBusinessHours() {
  return useQuery({
    queryKey: ['business_hours'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_hours')
        .select('weekday, is_open, opens_at, closes_at')
        .order('weekday')
        .returns<BusinessHours[]>();

      if (error) throw error;
      return data;
    },
  });
}

export interface ClosureRow extends ShopClosure {
  id: string;
  reason: string | null;
}

export function useShopClosures() {
  return useQuery({
    queryKey: ['shop_closures'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Only from today: a day the shop was shut last month tells a customer
      // nothing and would clutter the owner's list forever.
      const today = new Date();
      const iso = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

      const { data, error } = await supabase
        .from('shop_closures')
        .select('id, closed_on, reason')
        .gte('closed_on', iso)
        .order('closed_on')
        .returns<ClosureRow[]>();

      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateHours() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { weekday: number; is_open?: boolean; opens_at?: string; closes_at?: string }) => {
      const { weekday, ...patch } = input;
      const { data, error } = await supabase
        .from('business_hours')
        .update(patch)
        .eq('weekday', weekday)
        .select('weekday');

      if (error) throw error;
      // PostgREST answers 204 for a write that matched nothing, which reads as
      // success; the returned rows are what prove it landed.
      if (!data || data.length === 0) throw new Error('Those hours could not be saved.');
      return data[0];
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['business_hours'] }),
  });
}

export function useAddClosure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { closedOn: string; reason: string }) => {
      const { data, error } = await supabase
        .from('shop_closures')
        .insert({ closed_on: input.closedOn, reason: input.reason.trim() || null })
        .select('id');

      if (error) {
        throw new Error(
          /duplicate|unique/i.test(error.message) ? 'That day is already blocked.' : error.message,
        );
      }
      return data[0];
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shop_closures'] }),
  });
}

export function useRemoveClosure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('shop_closures').delete().eq('id', id).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('That day is no longer blocked.');
      return data[0];
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shop_closures'] }),
  });
}

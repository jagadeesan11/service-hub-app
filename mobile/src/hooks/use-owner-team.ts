import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { TECHNICIAN_FIELDS, type OwnerTechnician } from '@/hooks/use-owner';

/**
 * The whole team, including anyone stood down.
 *
 * Distinct from useTechnicians, which returns only the active ones because it
 * feeds the assign sheet. This screen manages people, so it has to show the
 * inactive ones too — otherwise they are unreachable once stood down.
 */
export function useTeam() {
  return useQuery({
    queryKey: ['owner', 'team'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('technicians')
        .select(TECHNICIAN_FIELDS)
        .order('status')
        .order('name')
        .returns<OwnerTechnician[]>();

      if (error) throw error;
      return data;
    },
  });
}

export function useSaveTechnician() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id?: string | null; name: string; phone: string }) => {
      const row = {
        name: input.name.trim(),
        phone: input.phone.trim() || null,
      };

      const query = input.id
        ? supabase.from('technicians').update(row).eq('id', input.id).select('id')
        : supabase.from('technicians').insert(row).select('id');

      const { data, error } = await query;

      if (error) throw error;
      // PostgREST answers 204 for a write that matched nothing, which reads as
      // success; the returned rows are what prove it landed.
      if (!data || data.length === 0) throw new Error('That technician no longer exists.');
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner'] });
    },
  });
}

/**
 * Standing someone down, or bringing them back.
 *
 * Preferred over deleting: bookings.technician_id is ON DELETE SET NULL, so a
 * delete would silently strip the technician off every job they ever did,
 * including finished ones — the history would say nobody worked them. Setting
 * `inactive` takes them out of the assign sheet and leaves the record intact.
 */
export function useSetTechnicianStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; status: 'active' | 'inactive' }) => {
      const { data, error } = await supabase
        .from('technicians')
        .update({ status: input.status })
        .eq('id', input.id)
        .select('id, status');

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('That technician no longer exists.');
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner'] });
    },
  });
}

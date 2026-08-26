import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { InputTemplateField } from '@/types';

interface CategoryInputTemplateRow {
  category_id: string;
  categories: {
    id: string;
    input_template_id: string | null;
    input_templates: { fields: InputTemplateField[] } | null;
  } | null;
}

/** Resolves service -> category -> input_template.fields in one round trip. */
export function useCategoryInputTemplate(serviceId: string | undefined) {
  return useQuery({
    queryKey: ['services', 'category-input-template', serviceId],
    enabled: Boolean(serviceId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('category_id, categories(id, input_template_id, input_templates(fields))')
        .eq('id', serviceId!)
        .single()
        .returns<CategoryInputTemplateRow>();

      if (error) throw error;
      return {
        categoryId: data.category_id,
        fields: data.categories?.input_templates?.fields ?? [],
      };
    },
  });
}

export function useCreateCustomerAsset() {
  return useMutation({
    mutationFn: async (input: { userId: string; type: string; attributes: Record<string, string> }) => {
      const { data, error } = await supabase
        .from('customer_assets')
        .insert({ user_id: input.userId, type: input.type, attributes: input.attributes })
        .select('id, attributes')
        .single();

      if (error) throw error;
      return data;
    },
  });
}

export function useCustomerAsset(assetId: string | undefined) {
  return useQuery({
    queryKey: ['customer_assets', assetId],
    enabled: Boolean(assetId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_assets')
        .select('id, attributes')
        .eq('id', assetId!)
        .single();

      if (error) throw error;
      return data as { id: string; attributes: Record<string, string> };
    },
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      userId: string;
      serviceId: string;
      assetId: string | null;
      addonIds: string[];
      scheduledAt: Date;
      totalPrice: number;
      contactName?: string | null;
      contactPhone?: string | null;
      serviceAddress?: string | null;
      serviceCity?: string | null;
      servicePostalCode?: string | null;
      needsPickup?: boolean;
      pickupNotes?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('bookings')
        .insert({
          user_id: input.userId,
          service_id: input.serviceId,
          asset_id: input.assetId,
          addon_ids: input.addonIds,
          scheduled_at: input.scheduledAt.toISOString(),
          status: 'pending_payment',
          total_price: input.totalPrice,
          contact_name: input.contactName ?? null,
          contact_phone: input.contactPhone ?? null,
          service_address: input.serviceAddress ?? null,
          service_city: input.serviceCity ?? null,
          service_postal_code: input.servicePostalCode ?? null,
          needs_pickup: input.needsPickup ?? false,
          pickup_notes: input.pickupNotes || null,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

export interface BookingListItem {
  id: string;
  scheduled_at: string;
  status: string;
  total_price: number;
  services: { name: string } | null;
  technicians: { name: string } | null;
}

/**
 * The signed-in customer's own bookings.
 *
 * The user id is part of the key even though RLS already scopes the rows:
 * without it the cache entry outlives a sign-out, and the next person to sign
 * in on the same device sees the previous customer's bookings until the
 * refetch lands.
 */
export function useMyBookings(userId?: string) {
  return useQuery({
    queryKey: ['bookings', 'mine', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, scheduled_at, status, total_price, services(name), technicians(name)')
        .order('scheduled_at', { ascending: false })
        .returns<BookingListItem[]>();

      if (error) throw error;
      return data;
    },
  });
}

export interface BookingDetail extends BookingListItem {
  created_at: string;
  addon_ids: string[];
  service_id: string;
  services: { name: string; duration_minutes: number | null } | null;
}

export function useBooking(bookingId: string | undefined) {
  return useQuery({
    queryKey: ['bookings', 'detail', bookingId],
    enabled: Boolean(bookingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(
          'id, created_at, scheduled_at, status, total_price, addon_ids, service_id, services(name, duration_minutes), technicians(name)',
        )
        .eq('id', bookingId!)
        .single()
        .returns<BookingDetail>();

      if (error) throw error;
      return data;
    },
  });
}

/**
 * Customer-initiated cancellation.
 *
 * Writes the status directly: this is the one transition the database lets a
 * customer make, and it refuses the rest, so no privileged path is needed.
 */
export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

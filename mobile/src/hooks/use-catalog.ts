import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Category, Service, ServiceWithPricing } from '@/types';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name')
        .returns<Category[]>();

      if (error) throw error;
      return data;
    },
  });
}

export function useServicesByCategory(categoryId: string | undefined) {
  return useQuery({
    queryKey: ['services', 'by-category', categoryId],
    enabled: Boolean(categoryId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('category_id', categoryId!)
        .eq('is_active', true)
        .order('name')
        .returns<Service[]>();

      if (error) throw error;
      return data;
    },
  });
}

export function useServiceDetail(serviceId: string | undefined) {
  return useQuery({
    queryKey: ['services', 'detail', serviceId],
    enabled: Boolean(serviceId),
    queryFn: async () => {
      const [serviceResult, pricingRulesResult, addonsResult] = await Promise.all([
        supabase.from('services').select('*').eq('id', serviceId!).single().returns<Service>(),
        supabase.from('pricing_rules').select('*').eq('service_id', serviceId!),
        supabase.from('addons').select('*').eq('service_id', serviceId!),
      ]);

      if (serviceResult.error) throw serviceResult.error;
      if (pricingRulesResult.error) throw pricingRulesResult.error;
      if (addonsResult.error) throw addonsResult.error;

      return {
        ...serviceResult.data,
        pricing_rules: pricingRulesResult.data,
        addons: addonsResult.data,
      } as ServiceWithPricing;
    },
  });
}

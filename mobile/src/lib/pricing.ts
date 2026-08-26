import type { ServiceWithPricing } from '@/types';

/**
 * `per_unit` has no explicit "quantity" column anywhere in the schema, so
 * this treats `selectedAttributes.quantity` as the unit count (defaulting to
 * 1) and `service.base_price` as the per-unit rate — the most generic
 * reading that doesn't hardcode a specific vertical's notion of "unit".
 */
export function calculatePrice(
  service: ServiceWithPricing,
  selectedAttributes: Record<string, string>,
  selectedAddonIds: string[],
): number {
  const servicePrice = resolveServicePrice(service, selectedAttributes);
  const addonsPrice = service.addons
    .filter((addon) => selectedAddonIds.includes(addon.id))
    .reduce((sum, addon) => sum + addon.price, 0);

  return servicePrice + addonsPrice;
}

function resolveServicePrice(
  service: ServiceWithPricing,
  selectedAttributes: Record<string, string>,
): number {
  switch (service.pricing_type) {
    case 'fixed':
      return service.base_price;

    case 'tiered': {
      const matchingRule = service.pricing_rules.find((rule) =>
        Object.entries(rule.condition).every(
          ([key, value]) => selectedAttributes[key] === value,
        ),
      );
      return matchingRule?.price ?? service.base_price;
    }

    case 'per_unit': {
      const quantity = Number(selectedAttributes.quantity) || 1;
      return service.base_price * quantity;
    }

    default:
      return service.base_price;
  }
}

import { calculatePrice } from '@/lib/pricing';
import type { Addon, PricingRule, ServiceWithPricing } from '@/types';

function makeService(overrides: Partial<ServiceWithPricing> = {}): ServiceWithPricing {
  return {
    id: 'service-1',
    category_id: 'category-1',
    name: 'Test Service',
    description: null,
    images: [],
    base_price: 1000,
    pricing_type: 'fixed',
    duration_minutes: 60,
    is_active: true,
    attributes: {},
    icon: null,
    pricing_rules: [],
    addons: [],
    ...overrides,
  };
}

const addons: Addon[] = [
  { id: 'addon-interior', service_id: 'service-1', name: 'Interior detailing', price: 500, is_multi_select: true },
  { id: 'addon-headlight', service_id: 'service-1', name: 'Headlight restoration', price: 300, is_multi_select: true },
];

const tieredRules: PricingRule[] = [
  { id: 'rule-hatch', service_id: 'service-1', condition: { vehicle_size: 'hatchback' }, price: 900 },
  { id: 'rule-sedan', service_id: 'service-1', condition: { vehicle_size: 'sedan' }, price: 1200 },
  { id: 'rule-suv', service_id: 'service-1', condition: { vehicle_size: 'suv' }, price: 1600 },
];

describe('calculatePrice', () => {
  describe('fixed pricing', () => {
    it('returns the base price with no addons selected', () => {
      const service = makeService({ pricing_type: 'fixed', base_price: 1000 });
      expect(calculatePrice(service, {}, [])).toBe(1000);
    });

    it('ignores selectedAttributes and sums selected addons', () => {
      const service = makeService({ pricing_type: 'fixed', base_price: 1000, addons });
      expect(calculatePrice(service, { vehicle_size: 'suv' }, ['addon-interior'])).toBe(1500);
    });

    it('sums multiple selected addons', () => {
      const service = makeService({ pricing_type: 'fixed', base_price: 1000, addons });
      expect(
        calculatePrice(service, {}, ['addon-interior', 'addon-headlight']),
      ).toBe(1800);
    });
  });

  describe('tiered pricing', () => {
    it('resolves the price from the matching pricing rule', () => {
      const service = makeService({
        pricing_type: 'tiered',
        base_price: 1000,
        pricing_rules: tieredRules,
      });
      expect(calculatePrice(service, { vehicle_size: 'suv' }, [])).toBe(1600);
      expect(calculatePrice(service, { vehicle_size: 'hatchback' }, [])).toBe(900);
    });

    it('falls back to base_price when no rule matches', () => {
      const service = makeService({
        pricing_type: 'tiered',
        base_price: 1000,
        pricing_rules: tieredRules,
      });
      expect(calculatePrice(service, { vehicle_size: 'truck' }, [])).toBe(1000);
      expect(calculatePrice(service, {}, [])).toBe(1000);
    });

    it('requires every key in the rule condition to match, not just one', () => {
      const service = makeService({
        pricing_type: 'tiered',
        base_price: 1000,
        pricing_rules: [
          {
            id: 'rule-multi',
            service_id: 'service-1',
            condition: { vehicle_size: 'suv', trim: 'premium' },
            price: 2000,
          },
        ],
      });
      expect(calculatePrice(service, { vehicle_size: 'suv' }, [])).toBe(1000);
      expect(calculatePrice(service, { vehicle_size: 'suv', trim: 'premium' }, [])).toBe(2000);
    });

    it('adds selected addons on top of the resolved tier price', () => {
      const service = makeService({
        pricing_type: 'tiered',
        base_price: 1000,
        pricing_rules: tieredRules,
        addons,
      });
      expect(
        calculatePrice(service, { vehicle_size: 'sedan' }, ['addon-headlight']),
      ).toBe(1500);
    });
  });

  describe('per_unit pricing', () => {
    it('defaults to a quantity of 1 when none is given', () => {
      const service = makeService({ pricing_type: 'per_unit', base_price: 250 });
      expect(calculatePrice(service, {}, [])).toBe(250);
    });

    it('multiplies the base price by the given quantity', () => {
      const service = makeService({ pricing_type: 'per_unit', base_price: 250 });
      expect(calculatePrice(service, { quantity: '4' }, [])).toBe(1000);
    });

    it('adds selected addons on top of the unit total', () => {
      const service = makeService({ pricing_type: 'per_unit', base_price: 250, addons });
      expect(calculatePrice(service, { quantity: '2' }, ['addon-interior'])).toBe(1000);
    });
  });
});

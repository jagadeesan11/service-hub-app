import type { BookingStatus, ID, PaymentMethod } from '@/types/database';

/**
 * PostgREST returns an embedded resource as an OBJECT (or null) when the
 * relationship is to-one, and as an ARRAY when it is to-many. `booking_id` is
 * UNIQUE on both `invoices` and `service_feedback`, so those two come back
 * to-one — despite reading like collections in the select.
 *
 * Typed as either and normalised with `one()` in lib/reports, so dropping a
 * unique constraint later changes the shape without crashing the page.
 */
export type Embedded<T> = T | T[] | null;

/** One booking, flattened with everything a report needs. */
export interface ReportRow {
  id: ID;
  created_at: string;
  scheduled_at: string;
  status: BookingStatus;
  total_price: number;
  /** What was actually earned: gross less any shop discount and promo code. */
  net_price: number;
  payment_method: PaymentMethod;
  services: { name: string; categories: { name: string } | null } | null;
  technicians: { name: string } | null;
  profiles: { name: string | null; phone: string | null; city: string | null } | null;
  invoices: Embedded<{ number: string }>;
  service_feedback: Embedded<{ rating: number }>;
}

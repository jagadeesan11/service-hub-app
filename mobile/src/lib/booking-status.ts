export const BOOKING_STATUS_GROUPS = ['Upcoming', 'In Progress', 'Completed', 'Cancelled'] as const;
export type BookingStatusGroup = (typeof BOOKING_STATUS_GROUPS)[number];

const STATUS_TO_GROUP: Record<string, BookingStatusGroup> = {
  pending_payment: 'Upcoming',
  confirmed: 'Upcoming',
  assigned: 'Upcoming',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function statusGroupFor(status: string): BookingStatusGroup {
  return STATUS_TO_GROUP[status] ?? 'Upcoming';
}

export function groupBookingsByStatus<T extends { status: string }>(
  bookings: T[],
): Record<BookingStatusGroup, T[]> {
  const groups: Record<BookingStatusGroup, T[]> = {
    Upcoming: [],
    'In Progress': [],
    Completed: [],
    Cancelled: [],
  };

  for (const booking of bookings) {
    groups[statusGroupFor(booking.status)].push(booking);
  }

  return groups;
}

export const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Pending payment',
  confirmed: 'Confirmed',
  assigned: 'Technician assigned',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/** Fixed lifecycle order for the detail screen's status timeline. */
export const BOOKING_TIMELINE_STATUSES = [
  'pending_payment',
  'confirmed',
  'assigned',
  'in_progress',
  'completed',
] as const;

/**
 * Statuses a customer may cancel from.
 *
 * Mirrors what the database actually permits — the trigger refuses
 * `in_progress`, `completed` and `cancelled` — so the button is hidden exactly
 * when a tap would fail. Anywhere these two disagree, the database wins.
 */
const CUSTOMER_CANCELLABLE = ['pending_payment', 'confirmed', 'assigned'];

export function canCustomerCancel(status: string): boolean {
  return CUSTOMER_CANCELLABLE.includes(status);
}

/**
 * Whether cancelling now falls inside the 24-hour window the terms attach a
 * fee to. Used only to warn — the charge itself is applied by the business,
 * not the app.
 */
export function isLateCancellation(scheduledAt: string): boolean {
  const hoursUntil = (new Date(scheduledAt).getTime() - Date.now()) / 3_600_000;
  return hoursUntil < 24;
}

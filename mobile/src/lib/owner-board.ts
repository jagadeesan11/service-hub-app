/**
 * The shop-floor reading of a day's bookings.
 *
 * Pure and dependency-free: which jobs are unassigned, what is in a bay, and
 * what the day is worth are the numbers an owner acts on, so they are worth
 * testing without standing up the app.
 */

export interface BoardBooking {
  id: string;
  scheduled_at: string;
  status: string;
  net_price: number;
  technician_id: string | null;
  payment_method: string;
  payments?: { status: string }[] | null;
}

/** Statuses where the job is still live — the shop still owes work on it. */
const OPEN_STATUSES = ['pending_payment', 'confirmed', 'assigned', 'in_progress'];

export function isSameDay(iso: string, now: Date = new Date()): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function todaysBookings<T extends BoardBooking>(bookings: T[] | undefined, now?: Date): T[] {
  return (bookings ?? []).filter((b) => isSameDay(b.scheduled_at, now));
}

/**
 * Jobs confirmed but with nobody on them — the queue the Inbox exists to empty.
 *
 * `pending_payment` is deliberately excluded: assigning someone to a job the
 * customer has not paid for commits a bay to money that may never arrive.
 */
export function needsAssignment<T extends BoardBooking>(bookings: T[]): T[] {
  return bookings.filter((b) => b.status === 'confirmed' && !b.technician_id);
}

/** Jobs with someone on them, in the order they are happening. */
export function inTheBay<T extends BoardBooking>(bookings: T[]): T[] {
  return bookings
    .filter((b) => b.technician_id && b.status !== 'cancelled')
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
}

/**
 * What the day is worth. Cancelled jobs earn nothing, and net_price is used
 * rather than the gross so discounts and promo codes are already off.
 */
export function bookedToday<T extends BoardBooking>(bookings: T[]): number {
  return bookings
    .filter((b) => b.status !== 'cancelled')
    .reduce((sum, b) => sum + Number(b.net_price ?? 0), 0);
}

/** How many jobs still have work left in them today. */
export function jobsLeft<T extends BoardBooking>(bookings: T[]): number {
  return bookings.filter((b) => OPEN_STATUSES.includes(b.status)).length;
}

/**
 * Cash the shop is owed: completed COD jobs with no settled payment against
 * them. This is the number that goes missing if nobody is watching for it.
 */
export function cashToCollect<T extends BoardBooking>(bookings: T[]): number {
  return bookings
    .filter(
      (b) =>
        b.status === 'completed' &&
        b.payment_method === 'cod' &&
        !(b.payments ?? []).some((p) => p.status === 'paid'),
    )
    .reduce((sum, b) => sum + Number(b.net_price ?? 0), 0);
}

export type StatusTone = 'unassigned' | 'assigned' | 'working' | 'cashDue' | 'done' | 'cancelled';

/**
 * The one label a job wears on the board.
 *
 * "Cash due" beats "Done" deliberately: a finished job with money outstanding
 * is not finished from the shop's point of view, and showing it as done is how
 * uncollected cash gets forgotten.
 */
export function statusTone<T extends BoardBooking>(b: T): StatusTone {
  if (b.status === 'cancelled') return 'cancelled';
  if (b.status === 'in_progress') return 'working';
  if (b.status === 'completed') {
    const settled = (b.payments ?? []).some((p) => p.status === 'paid');
    return b.payment_method === 'cod' && !settled ? 'cashDue' : 'done';
  }
  if (b.technician_id) return 'assigned';
  return 'unassigned';
}

export type JobAction = 'assign' | 'start' | 'complete' | 'collect' | null;

/**
 * The one thing to do next with a job.
 *
 * Exactly one action, never a row of buttons: on a workshop floor the useful
 * question is "what now", and offering four choices makes the operator answer
 * it themselves. Everything else stays reachable through the detail screen.
 *
 * `pending_payment` deliberately returns nothing — the shop is waiting on the
 * customer, and there is no action here that helps.
 */
export function nextAction<T extends BoardBooking>(b: T): JobAction {
  if (b.status === 'cancelled' || b.status === 'pending_payment') return null;

  if (b.status === 'completed') {
    const settled = (b.payments ?? []).some((p) => p.status === 'paid');
    return b.payment_method === 'cod' && !settled ? 'collect' : null;
  }

  if (!b.technician_id) return 'assign';
  if (b.status === 'assigned') return 'start';
  if (b.status === 'in_progress') return 'complete';
  return null;
}

export const TONE_LABELS: Record<StatusTone, string> = {
  unassigned: 'Unassigned',
  assigned: 'Assigned',
  working: 'In progress',
  cashDue: 'Cash due',
  done: 'Done',
  cancelled: 'Cancelled',
};

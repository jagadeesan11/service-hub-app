import type { BookingStatus } from '@/types/database';

export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending_payment: 'Pending payment',
  confirmed: 'Confirmed',
  assigned: 'Assigned',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/**
 * A distinct look per status, so a row is readable at a glance without
 * reading the word. Green means done, amber means work is happening now,
 * red means it is off. Assigned is the accent because it is the state a
 * dispatcher is looking for.
 */
export const STATUS_VARIANTS: Record<
  BookingStatus,
  'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'
> = {
  pending_payment: 'outline',
  confirmed: 'secondary',
  assigned: 'default',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'destructive',
};

export interface StatusAction {
  to: BookingStatus;
  /** Imperative, describing what happens on the ground, not the field name. */
  label: string;
  variant: 'default' | 'outline' | 'destructive';
  /** Shown as a confirmation prompt when the step is hard to walk back. */
  confirm?: string;
  /**
   * Postgres function to call instead of a plain status write, for moves that
   * have to do more than change a word — recording an offline payment also
   * has to create the payment row.
   */
  rpc?: 'admin_mark_paid_offline';
}

/**
 * What an admin may do next, given where a booking is now.
 *
 * Only forward moves and cancellation are offered. Reversing a status would
 * strand anything keyed off it — an invoice raised on completion, a review the
 * customer has already left — so undoing a mistake is deliberately not a
 * one-click action.
 *
 * `pending_payment` can be cancelled, or confirmed through
 * `admin_mark_paid_offline` for money that arrived by direct transfer. There
 * is deliberately no plain "set to confirmed": that would leave a paid-looking
 * booking with no payment recorded against it, which is the hole the RPC
 * closes by booking the amount at the same time.
 */
export function nextActions(status: BookingStatus, hasTechnician: boolean): StatusAction[] {
  switch (status) {
    case 'pending_payment':
      return [
        {
          to: 'confirmed',
          label: 'Mark as paid',
          variant: 'default',
          rpc: 'admin_mark_paid_offline',
          confirm:
            'Record payment received outside the app (direct UPI or bank transfer)? This confirms the booking and books the full amount as paid.',
        },
        { to: 'cancelled', label: 'Cancel', variant: 'outline', confirm: cancelPrompt },
      ];
    case 'confirmed':
      return [
        ...(hasTechnician
          ? [{ to: 'in_progress' as const, label: 'Start work', variant: 'default' as const }]
          : []),
        { to: 'cancelled', label: 'Cancel', variant: 'outline', confirm: cancelPrompt },
      ];
    case 'assigned':
      return [
        { to: 'in_progress', label: 'Start work', variant: 'default' },
        { to: 'cancelled', label: 'Cancel', variant: 'outline', confirm: cancelPrompt },
      ];
    case 'in_progress':
      return [
        {
          to: 'completed',
          label: 'Mark complete',
          variant: 'default',
          confirm:
            'Mark this job complete? This raises the bill and asks the customer to rate the work, and it cannot be undone here.',
        },
      ];
    default:
      // completed, cancelled and pending_payment are end states for the admin.
      return [];
  }
}

const cancelPrompt =
  'Cancel this booking? The customer is notified. If they have already paid, refund them separately — cancelling here does not move money.';

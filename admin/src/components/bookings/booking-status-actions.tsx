'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { nextActions } from '@/lib/booking-status';
import { createClient } from '@/lib/supabase/client';
import type { BookingStatus, PaymentMethod } from '@/types/database';

/**
 * Moves a booking along its lifecycle.
 *
 * Only the legal next steps are rendered, so the dispatcher picks an action
 * rather than a value — "Start work" rather than a dropdown listing every
 * status including the ones that make no sense from here.
 */
export function BookingStatusActions({
  bookingId,
  status,
  hasTechnician,
  onChanged,
}: {
  bookingId: string;
  status: BookingStatus;
  hasTechnician: boolean;
  onChanged: (status: BookingStatus, paymentMethod?: PaymentMethod) => void;
}) {
  const [busy, setBusy] = useState<BookingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const actions = nextActions(status, hasTechnician);
  if (actions.length === 0) return null;

  async function apply(action: (typeof actions)[number]) {
    if (action.confirm && !window.confirm(action.confirm)) return;

    setBusy(action.to);
    setError(null);

    const supabase = createClient();
    // Some moves are more than a status write. Those go through a Postgres
    // function so the booking and its payment land in one transaction — a
    // client doing it in two steps can leave the booking confirmed and the
    // money unrecorded if the second call fails.
    const { error: writeError } = action.rpc
      ? await supabase.rpc(action.rpc, { p_booking_id: bookingId })
      : await supabase.from('bookings').update({ status: action.to }).eq('id', bookingId);

    setBusy(null);
    if (writeError) {
      setError(writeError.message);
      return;
    }

    // The offline path also switches how the booking was paid, so the row
    // does not keep claiming "Paid online" until the next refresh.
    onChanged(action.to, action.rpc === 'admin_mark_paid_offline' ? 'offline' : undefined);
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1.5">
        {actions.map((action) => (
          <Button
            key={action.to}
            size="sm"
            variant={action.variant}
            disabled={busy !== null}
            onClick={() => apply(action)}
          >
            {busy === action.to ? 'Saving…' : action.label}
          </Button>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

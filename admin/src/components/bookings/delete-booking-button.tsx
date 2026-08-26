'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import type { BookingStatus } from '@/types/database';

/**
 * Deleting comes in two weights, because the consequences differ enormously.
 *
 *   Junk    — an abandoned checkout or a cancelled booking nobody paid for.
 *             Nothing is lost, so one confirm is enough.
 *   Settled — a completed or paid job. Deleting takes the payment record and
 *             the bill with it, so it asks the admin to type the word.
 *
 * Both live in a dialog rather than inline. The first version put the settled
 * confirmation inside the table cell, which is the narrowest column on the
 * page — the panel had nowhere to go and spilled outside the row.
 */
const JUNK_STATUSES: BookingStatus[] = ['pending_payment', 'cancelled'];

export function DeleteBookingButton({
  bookingId,
  status,
  hasBill,
  label,
  onDeleted,
}: {
  bookingId: string;
  status: BookingStatus;
  hasBill?: boolean;
  label: string;
  onDeleted: () => void;
}) {
  const isJunk = JUNK_STATUSES.includes(status);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const supabase = createClient();

    const { error: deleteError, count } = isJunk
      ? await supabase.from('bookings').delete({ count: 'exact' }).eq('id', bookingId)
      : {
          ...(await supabase.rpc('admin_force_delete_booking', { p_booking_id: bookingId })),
          count: 1,
        };

    setBusy(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    // A delete matching no rows still returns success, so an RLS refusal would
    // otherwise look like it worked until the row reappeared on refresh.
    if (count === 0) {
      setError('Not deleted — you may not have permission for this booking.');
      return;
    }
    setOpen(false);
    onDeleted();
  }

  function close(next: boolean) {
    setOpen(next);
    if (!next) {
      setTyped('');
      setError(null);
    }
  }

  return (
    <>
      <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>
        Delete
      </Button>

      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this booking?</DialogTitle>
            <DialogDescription>
              {isJunk ? (
                <>
                  Removing the booking for <span className="font-medium text-foreground">{label}</span>.
                  Nothing was paid, so nothing is lost.
                </>
              ) : (
                <>
                  Deleting <span className="font-medium text-foreground">{label}</span> also removes
                  the payment record{hasBill ? ' and its bill' : ''}. This cannot be undone
                  {hasBill ? ', and the invoice sequence will show a gap' : ''}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {!isJunk && (
            <div className="space-y-1.5">
              <Label htmlFor={`confirm-${bookingId}`}>
                Type <span className="font-mono font-semibold">DELETE</span> to confirm
              </Label>
              <Input
                id={`confirm-${bookingId}`}
                value={typed}
                autoComplete="off"
                onChange={(e) => setTyped(e.target.value)}
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => close(false)} disabled={busy}>
              Keep booking
            </Button>
            <Button
              variant="destructive"
              onClick={() => void remove()}
              disabled={busy || (!isJunk && typed !== 'DELETE')}
            >
              {busy ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

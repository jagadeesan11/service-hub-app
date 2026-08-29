'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment, useState } from 'react';

import { AssignTechnicianSelect } from '@/components/bookings/assign-technician-select';
import { BookingDetails } from '@/components/bookings/booking-details';
import { BookingStatusActions } from '@/components/bookings/booking-status-actions';
import { DeleteBookingButton } from '@/components/bookings/delete-booking-button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { STATUS_LABELS, STATUS_VARIANTS } from '@/lib/booking-status';
import type {
  BookingListItem,
  BookingStatus,
  PaymentMethod,
  Technician,
} from '@/types/database';

const PRICE_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const DATE_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});


export function BookingsTable({
  initialBookings,
  technicians,
  addons,
}: {
  initialBookings: BookingListItem[];
  technicians: Technician[];
  addons: { id: string; name: string }[];
}) {
  const [bookings, setBookings] = useState(initialBookings);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleDeleted(bookingId: string) {
    setBookings((prev) => prev.filter((b) => b.id !== bookingId));
    if (expandedId === bookingId) setExpandedId(null);
  }

  function handleStatusChanged(
    bookingId: string,
    status: BookingStatus,
    paymentMethod?: PaymentMethod,
  ) {
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId ? { ...b, status, ...(paymentMethod ? { payment_method: paymentMethod } : {}) } : b,
      ),
    );
  }

  function handleAssigned(bookingId: string, technician: Technician) {
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              status: 'assigned' as const,
              technician_id: technician.id,
              // Carry the phone through too, so the expanded detail panel
              // shows a callable number without waiting for a refetch.
              technicians: {
                id: technician.id,
                name: technician.name,
                phone: technician.phone,
              },
            }
          : b,
      ),
    );
  }

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Service</TableHead>
            <TableHead className="hidden md:table-cell">Booked by</TableHead>
            <TableHead className="hidden md:table-cell">Scheduled</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Technician</TableHead>
            <TableHead className="hidden text-right md:table-cell">Price</TableHead>
            <TableHead className="w-px text-right">Remove</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                No bookings yet.
              </TableCell>
            </TableRow>
          ) : (
            bookings.map((booking) => {
              const needsAssignment = booking.status === 'confirmed' && !booking.technician_id;
              const expanded = expandedId === booking.id;
              const customer = booking.profiles;

              return (
                <Fragment key={booking.id}>
                <TableRow>
                  <TableCell className="align-top">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : booking.id)}
                      aria-expanded={expanded}
                      aria-label={expanded ? 'Hide booking details' : 'Show booking details'}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {expanded ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="min-w-32">{booking.services?.name ?? '—'}</div>
                    {/* On a phone the Booked by, Scheduled and Price columns
                        are hidden — seven columns will not fit in 375px. Their
                        content reappears here so nothing is actually lost,
                        only re-laid-out. */}
                    <div className="mt-1 flex flex-col gap-0.5 text-xs font-normal text-muted-foreground md:hidden">
                      <span>{customer?.name ?? 'Unnamed customer'}</span>
                      <span>{DATE_FORMATTER.format(new Date(booking.scheduled_at))}</span>
                      <span className="tabular-nums">
                        {PRICE_FORMATTER.format(booking.net_price)}
                        {booking.discount_amount + booking.promo_discount_amount > 0 ? ' after discount' : ''}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {/* Name over phone: a dispatcher scans for the person, then
                        needs the number to call them. */}
                    <div className="flex flex-col">
                      <span className={customer?.name ? '' : 'text-muted-foreground'}>
                        {customer?.name ?? 'Unnamed customer'}
                      </span>
                      {customer?.phone && (
                        <a
                          href={`tel:${customer.phone.replace(/\s/g, '')}`}
                          className="text-xs text-muted-foreground hover:text-primary hover:underline"
                        >
                          {customer.phone}
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {DATE_FORMATTER.format(new Date(booking.scheduled_at))}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1.5">
                      <Badge variant={STATUS_VARIANTS[booking.status] ?? 'outline'}>
                        {STATUS_LABELS[booking.status] ?? booking.status}
                      </Badge>
                      <BookingStatusActions
                        bookingId={booking.id}
                        status={booking.status}
                        hasTechnician={Boolean(booking.technician_id)}
                        onChanged={(next, method) => handleStatusChanged(booking.id, next, method)}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    {needsAssignment && booking.services ? (
                      <AssignTechnicianSelect
                        bookingId={booking.id}
                        categoryId={booking.services.category_id}
                        technicians={technicians}
                        onAssigned={(technician) => handleAssigned(booking.id, technician)}
                      />
                    ) : (
                      <span className="text-muted-foreground">{booking.technicians?.name ?? '—'}</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">
                    {/* When a discount is on the job, the gross is struck
                        through rather than hidden — a dispatcher reconciling
                        cash needs to see both numbers, not just the one owed. */}
                    {booking.discount_amount + booking.promo_discount_amount > 0 ? (
                      <div className="flex flex-col items-end leading-tight">
                        <span className="text-xs text-muted-foreground line-through">
                          {PRICE_FORMATTER.format(booking.total_price)}
                        </span>
                        <span>{PRICE_FORMATTER.format(booking.net_price)}</span>
                      </div>
                    ) : (
                      PRICE_FORMATTER.format(booking.total_price)
                    )}
                  </TableCell>
                  {/* Its own column, away from the workflow actions: a
                      destructive control should not sit in the same cluster as
                      the ones a dispatcher uses every day. */}
                  <TableCell className="align-top text-right">
                    <DeleteBookingButton
                      bookingId={booking.id}
                      status={booking.status}
                      hasBill={Boolean(
                        Array.isArray(booking.invoices)
                          ? booking.invoices.length
                          : booking.invoices,
                      )}
                      label={booking.profiles?.name ?? booking.services?.name ?? 'this customer'}
                      onDeleted={() => handleDeleted(booking.id)}
                    />
                  </TableCell>
                </TableRow>

                {expanded && (
                  <TableRow>
                    <TableCell colSpan={8} className="p-0">
                      <BookingDetails booking={booking} addons={addons} />
                    </TableCell>
                  </TableRow>
                )}
                </Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

import { DiscountControl } from '@/components/bookings/discount-control';
import { InvoiceView } from '@/components/bookings/invoice-view';
import type { BookingListItem, PaymentMethod } from '@/types/database';

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  online: 'Paid online',
  cod: 'Cash — collect on site',
  offline: 'Paid by direct transfer',
};

const DATE_FULL = new Intl.DateTimeFormat('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function Field({ label, value, href }: { label: string; value: string | null; href?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      {value ? (
        href ? (
          <a href={href} className="text-sm text-primary hover:underline">
            {value}
          </a>
        ) : (
          <span className="text-sm">{value}</span>
        )
      ) : (
        <span className="text-sm text-muted-foreground/60">Not provided</span>
      )}
    </div>
  );
}

/** Everything a dispatcher needs to actually action a booking: who, where,
 *  what vehicle, and when. */
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hours`;
}

export function BookingDetails({
  booking,
  addons,
}: {
  booking: BookingListItem;
  addons: { id: string; name: string }[];
}) {
  const customer = booking.profiles;
  // Prefer the per-booking snapshot; fall back to the profile for bookings
  // made before those fields existed.
  const address =
    [booking.service_address, booking.service_city, booking.service_postal_code]
      .filter(Boolean)
      .join(', ') ||
    [customer?.address_line, customer?.city, customer?.postal_code].filter(Boolean).join(', ');
  const contactName = booking.contact_name ?? customer?.name ?? null;
  const contactPhone = booking.contact_phone ?? customer?.phone ?? null;
  const attributes = booking.customer_assets?.attributes ?? {};

  return (
    <div className="grid gap-5 border-t border-border bg-muted/30 px-4 py-4 sm:grid-cols-3">
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Booked by
        </h3>
        <Field label="Name" value={contactName} />
        <Field
          label="Phone"
          value={contactPhone}
          href={contactPhone ? `tel:${contactPhone.replace(/\s/g, '')}` : undefined}
        />
        <Field
          label="Email"
          value={customer?.email ?? null}
          href={customer?.email ? `mailto:${customer.email}` : undefined}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Service address
        </h3>
        {booking.needs_pickup && (
          <span className="inline-flex w-fit rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary uppercase tracking-wide">
            Pickup requested
          </span>
        )}
        <Field label={booking.needs_pickup ? 'Collect from' : 'Address'} value={address || null} />
        {booking.needs_pickup && booking.pickup_notes ? (
          <Field label="Pickup notes" value={booking.pickup_notes} />
        ) : null}
        <Field
          label="Scheduled"
          value={DATE_FULL.format(new Date(booking.scheduled_at))}
        />
        {booking.services?.duration_minutes ? (
          <Field label="Duration" value={formatDuration(booking.services.duration_minutes)} />
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Job details
        </h3>
        {/* Rendered from whatever the category's input_template collected, so a
            new vertical's fields show up here without a code change. */}
        {Object.keys(attributes).length > 0 ? (
          Object.entries(attributes).map(([key, value]) => (
            <Field key={key} label={key.replace(/_/g, ' ')} value={String(value)} />
          ))
        ) : (
          <Field label="Details" value={null} />
        )}
        <Field
          label="Add-ons"
          value={
            booking.addon_ids?.length
              ? // Fall back to a count if an addon was deleted after booking,
                // so the row never silently renders as "none selected".
                addons
                  .filter((a) => booking.addon_ids.includes(a.id))
                  .map((a) => a.name)
                  .join(', ') || `${booking.addon_ids.length} selected`
              : null
          }
        />
        {booking.technicians && (
          <Field
            label="Technician"
            value={`${booking.technicians.name}${booking.technicians.phone ? ` · ${booking.technicians.phone}` : ''}`}
          />
        )}
        {/* The technician needs to know whether to ask for money on site. */}
        <Field
          label="Payment"
          value={PAYMENT_LABELS[booking.payment_method] ?? booking.payment_method}
        />
      </section>

      {/* Full width and above the bill, because it has to be set before the
          job is completed — that is when the invoice is raised and the amount
          is frozen. */}
      <section className="sm:col-span-3">
        <DiscountControl booking={booking} />
      </section>

      {booking.status === 'completed' && (
        <section className="flex flex-col gap-3 sm:col-span-3">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Bill
          </h3>
          <InvoiceView bookingId={booking.id} />
        </section>
      )}
    </div>
  );
}

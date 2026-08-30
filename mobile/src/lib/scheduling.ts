export const SLOT_MINUTES = 30;

/** Fallback used only until the shop's real hours arrive from the database. */
export const DEFAULT_HOURS = { opensAt: '09:00', closesAt: '18:00' } as const;

export interface BusinessHours {
  /** 0 = Sunday, matching JavaScript's getDay() and Postgres's extract(dow). */
  weekday: number;
  is_open: boolean;
  opens_at: string;
  closes_at: string;
}

export interface ShopClosure {
  closed_on: string;
}

export interface BookableDay {
  date: Date;
  label: string;
  /** False when the shop is shut that day — the chip is shown, not hidden. */
  open: boolean;
  reason: string | null;
}

function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function hoursFor(day: Date, hours: BusinessHours[] | undefined): BusinessHours | null {
  return (hours ?? []).find((h) => h.weekday === day.getDay()) ?? null;
}

export function isClosedOn(day: Date, closures: ShopClosure[] | undefined): boolean {
  const key = isoDate(day);
  return (closures ?? []).some((c) => c.closed_on === key);
}

/**
 * The next seven days, each marked open or shut.
 *
 * Closed days are kept in the list rather than dropped: a customer who sees
 * "Sunday — closed" learns something, whereas a Sunday that silently is not
 * there reads as a bug in the app.
 */
export function getBookableDays(
  now: Date = new Date(),
  hours?: BusinessHours[],
  closures?: ShopClosure[],
): BookableDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + i);

    let label: string;
    if (i === 0) label = 'Today';
    else if (i === 1) label = 'Tomorrow';
    else
      label = date.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });

    // A closure beats the weekly pattern: it is the shop saying "not that day"
    // whatever the usual hours are.
    if (isClosedOn(date, closures)) {
      return { date, label, open: false, reason: 'Closed' };
    }

    // Before the hours load, days are assumed open rather than shown as shut —
    // a picker that flashes "closed" for every day while loading is worse than
    // one that briefly offers a slot the server would refuse.
    const h = hoursFor(date, hours);
    if (hours && hours.length > 0 && h && !h.is_open) {
      return { date, label, open: false, reason: 'Closed' };
    }

    return { date, label, open: true, reason: null };
  });
}

/**
 * Bookable slots for a day, inside the shop's hours for that weekday.
 *
 * Mirrors private.is_open_at on the server: a slot must start inside the
 * window, and past slots are dropped. Where the two could disagree the server
 * wins, and create_booking will say so.
 */
export function getTimeSlotsForDay(
  day: Date,
  now: Date = new Date(),
  hours?: BusinessHours[],
  closures?: ShopClosure[],
): Date[] {
  if (isClosedOn(day, closures)) return [];

  const h = hoursFor(day, hours);
  if (hours && hours.length > 0 && h && !h.is_open) return [];

  const opens = minutesOf(h?.opens_at ?? DEFAULT_HOURS.opensAt);
  const closes = minutesOf(h?.closes_at ?? DEFAULT_HOURS.closesAt);

  const slots: Date[] = [];
  for (let m = opens; m < closes; m += SLOT_MINUTES) {
    const slot = new Date(day);
    slot.setHours(Math.floor(m / 60), m % 60, 0, 0);
    if (slot > now) slots.push(slot);
  }
  return slots;
}

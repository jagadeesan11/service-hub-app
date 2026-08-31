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

/**
 * "09:00" as "9:00 am". Times are stored as clock strings, not dates.
 *
 * The shape is checked rather than just parsed: Number('') is 0, so a missing
 * time would otherwise render as a confident "12:00 am" and a shop with no
 * hours set would advertise midnight to midnight.
 */
export function formatClock(time: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(time ?? ''));
  if (!match) return '';

  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return '';

  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export interface ScheduleLine {
  /** 0 = Sunday, matching getDay() and Postgres's extract(dow). */
  weekday: number;
  day: string;
  /** "9:00 am – 7:00 pm", or "Closed". */
  hours: string;
  isToday: boolean;
}

/**
 * The week as a customer reads it.
 *
 * Ordered from today rather than from Sunday: someone checking opening hours
 * is nearly always asking about today or tomorrow, and making them find the
 * current day in a fixed list is work the screen can do for them.
 */
export function weekSchedule(hours: BusinessHours[] | undefined, now: Date = new Date()): ScheduleLine[] {
  const today = now.getDay();
  if (!hours || hours.length === 0) return [];

  return Array.from({ length: 7 }, (_, i) => {
    const weekday = (today + i) % 7;
    const h = hours.find((row) => row.weekday === weekday);
    return {
      weekday,
      day: WEEKDAY_NAMES[weekday],
      hours:
        h && h.is_open ? `${formatClock(h.opens_at)} – ${formatClock(h.closes_at)}` : 'Closed',
      isToday: i === 0,
    };
  });
}

export interface OpenStatus {
  open: boolean;
  /** One line, ready to print. */
  text: string;
}

/**
 * Whether the shop is open right now, and the sentence that says so.
 *
 * A blocked day beats the weekly pattern, the same way it does when booking —
 * this is the same question the picker asks, so it has to give the same answer.
 */
export function openStatus(
  hours: BusinessHours[] | undefined,
  closures: ShopClosure[] | undefined,
  now: Date = new Date(),
): OpenStatus {
  if (!hours || hours.length === 0) return { open: false, text: 'Hours not set' };

  if (isClosedOn(now, closures)) return { open: false, text: 'Closed today' };

  const h = hoursFor(now, hours);
  if (!h || !h.is_open) return { open: false, text: 'Closed today' };

  const minutes = now.getHours() * 60 + now.getMinutes();
  const opens = minutesOf(h.opens_at);
  const closes = minutesOf(h.closes_at);

  if (minutes < opens) return { open: false, text: `Opens at ${formatClock(h.opens_at)}` };
  if (minutes >= closes) return { open: false, text: 'Closed for today' };
  return { open: true, text: `Open until ${formatClock(h.closes_at)}` };
}

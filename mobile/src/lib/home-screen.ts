/**
 * Logic behind the home screen, kept pure so it can be tested without
 * standing up the app.
 */

/** Statuses where the job is still live — the customer is waiting on us. */
const LIVE_STATUSES = ['pending_payment', 'confirmed', 'assigned', 'in_progress'];

export interface ActiveBookingLike {
  id: string;
  status: string;
  scheduled_at: string;
}

/**
 * The one booking worth putting on the home screen.
 *
 * `in_progress` always wins: the car is physically with us right now, which
 * beats anything merely scheduled. Otherwise the soonest live booking, since
 * that is the next thing to happen to the customer. Completed and cancelled
 * bookings never appear — the home screen is about what is outstanding, and
 * showing finished work would push the actual next job off the top.
 */
export function pickActiveBooking<T extends ActiveBookingLike>(
  bookings: T[] | undefined,
): T | null {
  if (!bookings || bookings.length === 0) return null;

  const live = bookings.filter((b) => LIVE_STATUSES.includes(b.status));
  if (live.length === 0) return null;

  const inProgress = live.filter((b) => b.status === 'in_progress');
  const pool = inProgress.length > 0 ? inProgress : live;

  return [...pool].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
  )[0];
}

export type Greeting = 'Good morning' | 'Good afternoon' | 'Good evening';

/**
 * Time-of-day greeting. Boundaries are local time, and deliberately generous
 * at the ends: "Good evening" from 5pm reads right at 11pm too, whereas a
 * separate "Good night" would be wrong for a shop that closes at seven.
 */
export function greetingFor(date: Date = new Date()): Greeting {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** First name only — "Good evening, Jagadeesan D" is stiff; the given name isn't. */
export function firstNameOf(name: string | null | undefined): string | null {
  if (!name) return null;
  const first = name.trim().split(/\s+/)[0];
  return first || null;
}

const TIME = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });
const DAY = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * When the job is, phrased the way someone would say it out loud.
 *
 * "Today" and "Tomorrow" are compared on calendar days, not on elapsed hours:
 * a 9am slot booked at 11pm the night before is tomorrow, even though it is
 * only ten hours away, and "in 10 hours" would be a strange thing to read.
 */
export function formatWhen(iso: string, now: Date = new Date()): string {
  const when = new Date(iso);
  const time = TIME.format(when);

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(when) - startOfDay(now)) / 86_400_000);

  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Tomorrow, ${time}`;
  if (days === -1) return `Yesterday, ${time}`;
  // en-IN puts a comma after the weekday, which would give "Mon, 31 Aug, 10:00
  // am" — two commas where the Today/Tomorrow forms have one.
  return `${DAY.format(when).replace(',', '')}, ${time}`;
}

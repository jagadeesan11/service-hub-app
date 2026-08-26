export const BUSINESS_HOURS = {
  startHour: 9,
  endHour: 18,
  slotMinutes: 30,
} as const;

export interface BookableDay {
  date: Date;
  label: string;
}

/** Next 7 days starting today, for a simple date-chip picker. */
export function getBookableDays(now: Date = new Date()): BookableDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + i);

    let label: string;
    if (i === 0) label = 'Today';
    else if (i === 1) label = 'Tomorrow';
    else label = date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

    return { date, label };
  });
}

/**
 * Half-hour slots within business hours for the given day. When `day` is
 * today, slots already in the past (relative to `now`) are excluded.
 */
export function getTimeSlotsForDay(day: Date, now: Date = new Date()): Date[] {
  const slots: Date[] = [];
  const cursor = new Date(day);
  cursor.setHours(BUSINESS_HOURS.startHour, 0, 0, 0);

  const end = new Date(day);
  end.setHours(BUSINESS_HOURS.endHour, 0, 0, 0);

  while (cursor < end) {
    if (cursor > now) {
      slots.push(new Date(cursor));
    }
    cursor.setMinutes(cursor.getMinutes() + BUSINESS_HOURS.slotMinutes);
  }

  return slots;
}

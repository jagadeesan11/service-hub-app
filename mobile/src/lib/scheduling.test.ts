import { getBookableDays, getTimeSlotsForDay } from '@/lib/scheduling';

describe('getBookableDays', () => {
  it('returns 7 days starting today, labeled Today/Tomorrow then weekday', () => {
    const now = new Date('2026-08-23T10:00:00');
    const days = getBookableDays(now);

    expect(days).toHaveLength(7);
    expect(days[0].label).toBe('Today');
    expect(days[1].label).toBe('Tomorrow');
    expect(days[2].label).not.toBe('Tomorrow');
    expect(days[0].date.getDate()).toBe(23);
    expect(days[6].date.getDate()).toBe(29);
  });
});

describe('getTimeSlotsForDay', () => {
  it('generates half-hour slots between business hours for a future day', () => {
    const now = new Date('2026-08-23T08:00:00');
    const day = new Date('2026-08-25T00:00:00');
    const slots = getTimeSlotsForDay(day, now);

    expect(slots[0].getHours()).toBe(9);
    expect(slots[0].getMinutes()).toBe(0);
    expect(slots.at(-1)?.getHours()).toBe(17);
    expect(slots.at(-1)?.getMinutes()).toBe(30);
    // 9:00 to 17:30 inclusive, every 30 minutes = 18 slots
    expect(slots).toHaveLength(18);
  });

  it('excludes slots already in the past when the day is today', () => {
    const now = new Date('2026-08-23T13:15:00');
    const day = new Date('2026-08-23T00:00:00');
    const slots = getTimeSlotsForDay(day, now);

    expect(slots[0].getHours()).toBe(13);
    expect(slots[0].getMinutes()).toBe(30);
    expect(slots.every((slot) => slot > now)).toBe(true);
  });

  it('returns an empty list when business hours for today have already ended', () => {
    const now = new Date('2026-08-23T19:00:00');
    const day = new Date('2026-08-23T00:00:00');
    expect(getTimeSlotsForDay(day, now)).toHaveLength(0);
  });
});

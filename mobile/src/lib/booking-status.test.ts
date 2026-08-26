import { groupBookingsByStatus, statusGroupFor } from '@/lib/booking-status';

describe('statusGroupFor', () => {
  it('maps pre-completion statuses to Upcoming', () => {
    expect(statusGroupFor('pending_payment')).toBe('Upcoming');
    expect(statusGroupFor('confirmed')).toBe('Upcoming');
    expect(statusGroupFor('assigned')).toBe('Upcoming');
  });

  it('maps in_progress, completed, and cancelled to their own groups', () => {
    expect(statusGroupFor('in_progress')).toBe('In Progress');
    expect(statusGroupFor('completed')).toBe('Completed');
    expect(statusGroupFor('cancelled')).toBe('Cancelled');
  });
});

describe('groupBookingsByStatus', () => {
  it('buckets bookings into all four groups, preserving order within each', () => {
    const bookings = [
      { id: '1', status: 'completed' },
      { id: '2', status: 'pending_payment' },
      { id: '3', status: 'in_progress' },
      { id: '4', status: 'cancelled' },
      { id: '5', status: 'confirmed' },
    ];

    const groups = groupBookingsByStatus(bookings);

    expect(groups.Upcoming.map((b) => b.id)).toEqual(['2', '5']);
    expect(groups['In Progress'].map((b) => b.id)).toEqual(['3']);
    expect(groups.Completed.map((b) => b.id)).toEqual(['1']);
    expect(groups.Cancelled.map((b) => b.id)).toEqual(['4']);
  });
});

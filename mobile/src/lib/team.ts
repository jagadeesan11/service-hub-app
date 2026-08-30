/**
 * Reading the team the way a shop owner needs to.
 *
 * Pure and dependency-free. The removal rule in particular is load-bearing:
 * bookings.technician_id is ON DELETE SET NULL, so the database will happily
 * delete someone and silently unassign every job they were on. Nothing else
 * stops that, so it is checked here and tested.
 */

export interface TeamBooking {
  technician_id: string | null;
  status: string;
}

/** Statuses where the job is still someone's responsibility. */
const OPEN_STATUSES = ['pending_payment', 'confirmed', 'assigned', 'in_progress'];

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** Jobs still on this person's plate. */
export function openJobsFor(technicianId: string, bookings: TeamBooking[] | undefined): number {
  return (bookings ?? []).filter(
    (b) => b.technician_id === technicianId && OPEN_STATUSES.includes(b.status),
  ).length;
}

export function isInABay(technicianId: string, bookings: TeamBooking[] | undefined): boolean {
  return (bookings ?? []).some(
    (b) => b.technician_id === technicianId && b.status === 'in_progress',
  );
}

export interface RemovalCheck {
  allowed: boolean;
  reason: string | null;
}

/**
 * Whether someone can be taken off the team right now.
 *
 * Refused while they still hold open work. The database would allow the
 * delete and quietly null out `technician_id` on every one of those bookings —
 * the jobs would still be scheduled, with nobody on them, and nothing on the
 * board would say so.
 */
export function canRemove(
  technicianId: string,
  name: string,
  bookings: TeamBooking[] | undefined,
): RemovalCheck {
  const open = openJobsFor(technicianId, bookings);
  if (open === 0) return { allowed: true, reason: null };

  return {
    allowed: false,
    reason: `${firstNameOf(name)} still has ${open} job${open > 1 ? 's' : ''} on. Reassign ${open > 1 ? 'them' : 'it'} first.`,
  };
}

export function validateTechnicianName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 2) return 'Enter the technician’s name.';
  if (trimmed.length > 80) return 'That name is too long.';
  return null;
}

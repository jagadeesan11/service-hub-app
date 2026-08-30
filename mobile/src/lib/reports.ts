/**
 * Shop reporting.
 *
 * The definitions here deliberately match the admin panel's reports, because
 * two surfaces that disagree about what "revenue" means is worse than one that
 * never showed it:
 *
 *   Revenue  — work actually delivered: completed bookings only.
 *   Pipeline — booked and not yet delivered: confirmed, assigned, in progress.
 *
 * Cancelled and pending-payment bookings are in neither. A pending booking is
 * an abandoned checkout far more often than a sale.
 *
 * Money is always `net_price` — what the job actually earned after any shop
 * discount and promo code. Summing the gross overstates every figure.
 */

export const REVENUE_STATUSES = ['completed'] as const;
export const PIPELINE_STATUSES = ['confirmed', 'assigned', 'in_progress'] as const;

/**
 * An average over one or two reviews is noise. One unlucky first job should
 * not brand a technician at 1.0, so the average is withheld until there is
 * enough of it to mean something; the count is always shown.
 */
export const MIN_RATINGS_TO_SHOW = 3;

export interface ReportBooking {
  scheduled_at: string;
  status: string;
  net_price: number;
  payment_method: string;
  services: { name: string } | null;
  technicians: { name: string } | null;
}

export type Period = 'Week' | 'Month' | 'Quarter';

/**
 * The window a period covers, ending now.
 *
 * Anchored to whole days so a report does not shift under you as the clock
 * moves through the afternoon.
 */
export function periodBounds(period: Period, now: Date = new Date()): { from: Date; to: Date } {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === 'Week') start.setDate(start.getDate() - 6);
  else if (period === 'Month') start.setDate(start.getDate() - 29);
  else start.setDate(start.getDate() - 89);

  return { from: start, to: end };
}

export function withinPeriod(row: ReportBooking, from: Date, to: Date): boolean {
  const at = new Date(row.scheduled_at).getTime();
  return at >= from.getTime() && at <= to.getTime();
}

export interface OwnerSummary {
  revenue: number;
  pipeline: number;
  jobs: number;
  averageTicket: number | null;
  cashRevenue: number;
  onlineRevenue: number;
}

export function summarise(rows: ReportBooking[]): OwnerSummary {
  const revenueRows = rows.filter((r) => (REVENUE_STATUSES as readonly string[]).includes(r.status));
  const pipelineRows = rows.filter((r) =>
    (PIPELINE_STATUSES as readonly string[]).includes(r.status),
  );

  const sum = (list: ReportBooking[]) => list.reduce((a, r) => a + Number(r.net_price), 0);
  const revenue = sum(revenueRows);

  return {
    revenue,
    pipeline: sum(pipelineRows),
    jobs: revenueRows.length,
    // Null rather than zero: no jobs is not an average ticket of nothing.
    averageTicket: revenueRows.length > 0 ? revenue / revenueRows.length : null,
    cashRevenue: sum(revenueRows.filter((r) => r.payment_method === 'cod')),
    onlineRevenue: sum(revenueRows.filter((r) => r.payment_method !== 'cod')),
  };
}

export interface Breakdown {
  key: string;
  jobs: number;
  revenue: number;
}

/** Revenue split by whatever `pick` returns, biggest first. */
export function breakdownBy(
  rows: ReportBooking[],
  pick: (row: ReportBooking) => string | null,
): Breakdown[] {
  const revenueRows = rows.filter((r) => (REVENUE_STATUSES as readonly string[]).includes(r.status));
  const map = new Map<string, { jobs: number; revenue: number }>();

  for (const row of revenueRows) {
    const key = pick(row);
    if (!key) continue;
    const entry = map.get(key) ?? { jobs: 0, revenue: 0 };
    entry.jobs += 1;
    entry.revenue += Number(row.net_price);
    map.set(key, entry);
  }

  return Array.from(map, ([key, v]) => ({ key, jobs: v.jobs, revenue: v.revenue })).sort(
    (a, b) => b.revenue - a.revenue,
  );
}

/**
 * Each row's share of the largest, for drawing bars.
 *
 * Relative to the biggest rather than to the total: a bar chart is read by
 * comparing lengths, and scaling to the total makes everything short as soon
 * as there are more than a handful of rows.
 */
export function withShare(rows: Breakdown[]): (Breakdown & { share: number })[] {
  const top = rows.reduce((m, r) => Math.max(m, r.revenue), 0);
  return rows.map((r) => ({ ...r, share: top > 0 ? r.revenue / top : 0 }));
}

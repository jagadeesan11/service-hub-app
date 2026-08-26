import type { Embedded, ReportRow } from '@/types/reports';

/**
 * Collapses a PostgREST embed to a single value.
 *
 * A to-one embed arrives as an object or null; a to-many arrives as an array.
 * `invoices` and `service_feedback` are to-one today because `booking_id` is
 * UNIQUE on both, so `.map()` on them threw at runtime. Handling both shapes
 * costs nothing and means a constraint change cannot break this again.
 */
function one<T>(value: Embedded<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

const ratingOf = (row: ReportRow): number | null => one(row.service_feedback)?.rating ?? null;
const isBilled = (row: ReportRow): boolean => one(row.invoices) !== null;

/**
 * Reporting definitions, kept in one place because a leadership view that is
 * vague about what "revenue" means is worse than no view at all.
 *
 *   Revenue  — work actually delivered: completed bookings only.
 *   Pipeline — booked and not yet delivered: confirmed, assigned, in progress.
 *
 * Cancelled and pending-payment bookings are in neither. A pending booking is
 * an abandoned checkout far more often than a sale, and counting it as revenue
 * would flatter every number on the page.
 */
export const REVENUE_STATUSES = ['completed'] as const;
export const PIPELINE_STATUSES = ['confirmed', 'assigned', 'in_progress'] as const;

export type RangeKey = 'this_month' | 'last_month' | 'financial_year' | 'all';

export const RANGE_LABELS: Record<RangeKey, string> = {
  this_month: 'This month',
  last_month: 'Last month',
  financial_year: 'This financial year',
  all: 'All time',
};

/** Indian financial year: 1 April to 31 March. */
export function financialYearStart(now = new Date()): Date {
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(year, 3, 1);
}

/**
 * Each range covers its WHOLE period, including days still to come.
 *
 * Ending at "today" seems reasonable for revenue but quietly breaks Pipeline,
 * which is future work by definition — a job booked for next Tuesday would be
 * missing from every range including "All time". A period is a period; work
 * not yet delivered still belongs to the month it is scheduled in.
 */
export function rangeBounds(key: RangeKey, now = new Date()): { from: Date; to: Date } {
  const endOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (key) {
    case 'this_month':
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        // Day 0 of next month is the last day of this one.
        to: endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      };
    case 'last_month':
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    case 'financial_year': {
      const start = financialYearStart(now);
      // 31 March of the following calendar year.
      return { from: start, to: endOfDay(new Date(start.getFullYear() + 1, 2, 31)) };
    }
    case 'all':
      return { from: new Date(0), to: new Date(8640000000000000) };
  }
}

/**
 * Filtered on `scheduled_at` rather than `created_at`: the question a report
 * answers is "what did we do in March", not "what was booked in March".
 */
export function withinRange(row: ReportRow, from: Date, to: Date): boolean {
  const t = new Date(row.scheduled_at).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

export interface Summary {
  revenue: number;
  pipeline: number;
  completed: number;
  booked: number;
  cancelled: number;
  cancellationRate: number | null;
  averageRating: number | null;
  ratingCount: number;
  cashRevenue: number;
  onlineRevenue: number;
  unbilled: number;
}

export function summarise(rows: ReportRow[]): Summary {
  const revenueRows = rows.filter((r) => (REVENUE_STATUSES as readonly string[]).includes(r.status));
  const pipelineRows = rows.filter((r) =>
    (PIPELINE_STATUSES as readonly string[]).includes(r.status),
  );
  const cancelled = rows.filter((r) => r.status === 'cancelled').length;

  const ratings = rows.map(ratingOf).filter((r) => r !== null);

  // Decided is everything that reached an outcome. Pending-payment bookings are
  // excluded so an abandoned checkout does not inflate the cancellation rate.
  const decided = revenueRows.length + cancelled;

  const sum = (list: ReportRow[]) => list.reduce((a, r) => a + Number(r.total_price), 0);

  return {
    revenue: sum(revenueRows),
    pipeline: sum(pipelineRows),
    completed: revenueRows.length,
    booked: rows.length,
    cancelled,
    cancellationRate: decided > 0 ? cancelled / decided : null,
    averageRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    ratingCount: ratings.length,
    cashRevenue: sum(revenueRows.filter((r) => r.payment_method === 'cod')),
    onlineRevenue: sum(revenueRows.filter((r) => r.payment_method !== 'cod')),
    // A completed job with no bill is an accounting gap worth surfacing rather
    // than leaving for someone to find at year end.
    unbilled: revenueRows.filter((r) => !isBilled(r)).length,
  };
}

export interface Breakdown {
  key: string;
  jobs: number;
  revenue: number;
  /** Null below MIN_RATINGS_TO_SHOW — see below. */
  rating: number | null;
  ratingCount: number;
}

/**
 * An average over one or two reviews is noise, and in a report it is noise
 * that gets read out in a meeting. One unlucky first job should not brand a
 * technician at 1.0, so the average is withheld until there is enough of it
 * to mean something; the count is always shown so nobody thinks it is missing.
 */
export const MIN_RATINGS_TO_SHOW = 3;

export function breakdownBy(
  rows: ReportRow[],
  pick: (row: ReportRow) => string | null,
): Breakdown[] {
  const map = new Map<string, { jobs: number; revenue: number; ratings: number[] }>();

  for (const row of rows) {
    if (!(REVENUE_STATUSES as readonly string[]).includes(row.status)) continue;
    const key = pick(row) ?? 'Unassigned';
    const entry = map.get(key) ?? { jobs: 0, revenue: 0, ratings: [] };
    entry.jobs += 1;
    entry.revenue += Number(row.total_price);
    const rating = ratingOf(row);
    if (rating !== null) entry.ratings.push(rating);
    map.set(key, entry);
  }

  return [...map.entries()]
    .map(([key, v]) => ({
      key,
      jobs: v.jobs,
      revenue: v.revenue,
      rating:
        v.ratings.length >= MIN_RATINGS_TO_SHOW
          ? v.ratings.reduce((a, b) => a + b, 0) / v.ratings.length
          : null,
      ratingCount: v.ratings.length,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

const CSV_COLUMNS: { header: string; value: (r: ReportRow) => string | number }[] = [
  { header: 'Booking ID', value: (r) => r.id },
  { header: 'Booked on', value: (r) => r.created_at.slice(0, 10) },
  { header: 'Scheduled', value: (r) => r.scheduled_at.slice(0, 16).replace('T', ' ') },
  { header: 'Status', value: (r) => r.status },
  { header: 'Service', value: (r) => r.services?.name ?? '' },
  { header: 'Category', value: (r) => r.services?.categories?.name ?? '' },
  { header: 'Customer', value: (r) => r.profiles?.name ?? '' },
  { header: 'Phone', value: (r) => r.profiles?.phone ?? '' },
  { header: 'City', value: (r) => r.profiles?.city ?? '' },
  { header: 'Technician', value: (r) => r.technicians?.name ?? '' },
  { header: 'Payment method', value: (r) => r.payment_method },
  { header: 'Amount', value: (r) => Number(r.total_price).toFixed(2) },
  { header: 'Bill number', value: (r) => one(r.invoices)?.number ?? '' },
  { header: 'Rating', value: (r) => ratingOf(r) ?? '' },
];

/**
 * RFC 4180 quoting. Customer names and addresses contain commas often enough
 * that naive joining silently shifts every later column in the row.
 */
function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: ReportRow[]): string {
  const lines = [CSV_COLUMNS.map((c) => csvCell(c.header)).join(',')];
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map((c) => csvCell(c.value(row))).join(','));
  }
  // CRLF and a UTF-8 BOM: without the BOM, Excel on Windows mangles the rupee
  // sign and any non-ASCII customer name.
  return '﻿' + lines.join('\r\n');
}

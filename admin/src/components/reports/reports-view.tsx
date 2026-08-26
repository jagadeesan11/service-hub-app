'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { STATUS_LABELS } from '@/lib/booking-status';
import {
  RANGE_LABELS,
  breakdownBy,
  rangeBounds,
  summarise,
  toCsv,
  withinRange,
  type Breakdown,
  type RangeKey,
} from '@/lib/reports';
import { cn } from '@/lib/utils';
import type { ReportRow } from '@/types/reports';

const MONEY = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const RANGES: RangeKey[] = ['this_month', 'last_month', 'financial_year', 'all'];

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'warning';
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 text-2xl font-semibold tabular-nums',
          tone === 'warning' && 'text-destructive',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ReportsView({ rows }: { rows: ReportRow[] }) {
  const [range, setRange] = useState<RangeKey>('this_month');

  const filtered = useMemo(() => {
    const { from, to } = rangeBounds(range);
    return rows.filter((r) => withinRange(r, from, to));
  }, [rows, range]);

  const summary = useMemo(() => summarise(filtered), [filtered]);
  const byService = useMemo(() => breakdownBy(filtered, (r) => r.services?.name ?? null), [filtered]);
  const byTechnician = useMemo(
    () => breakdownBy(filtered, (r) => r.technicians?.name ?? null),
    [filtered],
  );

  const statusCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filtered) map.set(r.status, (map.get(r.status) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  function exportCsv() {
    const csv = toCsv(filtered);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `moto-ceramic-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {RANGES.map((key) => (
            <Button
              key={key}
              size="sm"
              variant={range === key ? 'default' : 'outline'}
              onClick={() => setRange(key)}
            >
              {RANGE_LABELS[key]}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
          Export CSV ({filtered.length})
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Revenue"
          value={MONEY.format(summary.revenue)}
          hint={`${summary.completed} job${summary.completed === 1 ? '' : 's'} delivered`}
        />
        <Tile
          label="Pipeline"
          value={MONEY.format(summary.pipeline)}
          hint="Booked, not yet delivered"
        />
        <Tile
          label="Cancellation rate"
          value={
            summary.cancellationRate === null
              ? '—'
              : `${Math.round(summary.cancellationRate * 100)}%`
          }
          hint={`${summary.cancelled} cancelled of ${summary.completed + summary.cancelled} decided`}
        />
        <Tile
          label="Average rating"
          value={summary.averageRating === null ? '—' : summary.averageRating.toFixed(1)}
          hint={
            summary.ratingCount === 0
              ? 'No reviews yet'
              : `${summary.ratingCount} review${summary.ratingCount === 1 ? '' : 's'}`
          }
        />
      </div>

      {/* Definitions sit next to the numbers, because "revenue" is exactly the
          figure someone will quote in a meeting without checking what it counts. */}
      <p className="text-xs text-muted-foreground">
        <strong className="font-semibold text-foreground">Revenue</strong> counts completed jobs
        only. <strong className="font-semibold text-foreground">Pipeline</strong> is confirmed,
        assigned and in-progress work. Bookings awaiting payment are in neither — most are abandoned
        checkouts. Figures are grouped by the date the work was scheduled, not the date it was
        booked.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Collected in cash" value={MONEY.format(summary.cashRevenue)} />
        <Tile label="Paid online or by transfer" value={MONEY.format(summary.onlineRevenue)} />
        <Tile
          label="Completed without a bill"
          value={String(summary.unbilled)}
          tone={summary.unbilled > 0 ? 'warning' : 'default'}
          hint={summary.unbilled > 0 ? 'Needs a bill raising' : 'All billed'}
        />
      </div>

      <BreakdownTable title="By service" nameHeader="Service" rows={byService} />
      <BreakdownTable title="By technician" nameHeader="Technician" rows={byTechnician} />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Bookings by status</h2>
        <div className="flex flex-wrap gap-2">
          {statusCounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing in this period.</p>
          ) : (
            statusCounts.map(([status, count]) => (
              <span
                key={status}
                className="rounded-md border border-border px-2.5 py-1 text-xs tabular-nums"
              >
                {STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status}
                <span className="ml-1.5 font-semibold">{count}</span>
              </span>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function BreakdownTable({
  title,
  nameHeader,
  rows,
}: {
  title: string;
  nameHeader: string;
  // The shared type, not a restatement of it — the inline copy silently drifted
  // the moment `Breakdown` gained a field.
  rows: Breakdown[];
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No completed jobs in this period.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{nameHeader}</TableHead>
                <TableHead className="text-right">Jobs</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Rating</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="font-medium">{row.key}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.jobs}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {MONEY.format(row.revenue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.rating === null ? (
                      // Too few reviews to average. Showing the count instead
                      // of a dash makes it clear the data exists but is thin,
                      // rather than looking like nobody has reviewed at all.
                      <span title={`${row.ratingCount} review(s) — too few to average`}>
                        {row.ratingCount === 0 ? '—' : `(${row.ratingCount})`}
                      </span>
                    ) : (
                      row.rating.toFixed(1)
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

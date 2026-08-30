/**
 * Reading the shop's bills.
 *
 * Three things about the real invoices differ from a typical billing screen,
 * and all three are deliberate:
 *
 *  - There is no draft/sent/paid column. A bill exists or it does not, and
 *    whether the money arrived is a fact about `payments`, not about the bill.
 *  - Line items are frozen when the bill is raised. A bill that rewrites
 *    itself when a price changes is not a record of anything.
 *  - There is no tax line. The shop is not GST-registered, so its bills are a
 *    Bill of Supply and say plainly that no tax was charged.
 */

export interface BoardInvoice {
  total: number;
  bookings?: { payments?: { status: string }[] | null } | null;
}

/** Whether the money against a bill has actually been received. */
export function isSettled(invoice: BoardInvoice): boolean {
  return (invoice.bookings?.payments ?? []).some((p) => p.status === 'paid');
}

export type InvoiceFilter = 'Unpaid' | 'Paid' | 'All';

export function filterInvoices<T extends BoardInvoice>(
  list: T[] | undefined,
  filter: InvoiceFilter,
): T[] {
  const all = list ?? [];
  if (filter === 'Unpaid') return all.filter((i) => !isSettled(i));
  if (filter === 'Paid') return all.filter(isSettled);
  return all;
}

/** What the shop is still owed across every unsettled bill. */
export function outstandingTotal(list: BoardInvoice[] | undefined): number {
  return (list ?? []).filter((i) => !isSettled(i)).reduce((n, i) => n + Number(i.total), 0);
}

/** What has actually come in. */
export function settledTotal(list: BoardInvoice[] | undefined): number {
  return (list ?? []).filter(isSettled).reduce((n, i) => n + Number(i.total), 0);
}

export interface InvoiceLine {
  description: string;
  amount: number;
}

/**
 * Whether a bill's printed lines add up to its own total.
 *
 * Worth checking rather than assuming: a discount line added after the fact,
 * or an add-on whose price moved, is exactly how a bill starts disagreeing
 * with itself — and the customer is the one who notices.
 */
export function linesReconcile(lines: InvoiceLine[] | undefined, total: number): boolean {
  const sum = (lines ?? []).reduce((n, l) => n + Number(l.amount), 0);
  return Math.abs(sum - Number(total)) < 0.005;
}

'use client';

import { ChevronDown, ChevronRight, Printer } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import { printInvoice } from '@/lib/print-invoice';
import { createClient } from '@/lib/supabase/client';

const DATE = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const PRICE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
});

interface Party {
  name?: string | null;
  address_line?: string | null;
  city?: string | null;
  postal_code?: string | null;
  phone?: string | null;
  email?: string | null;
}

interface Invoice {
  id: string;
  number: string;
  issued_at: string;
  line_items: { description: string; amount: number }[];
  total: number;
  payment_method: string;
  seller: Party;
  buyer: Party;
}

function addressOf(p: Party) {
  // Same trimming as the printed copy, so preview and paper agree.
  return [p.address_line, p.city, p.postal_code]
    .map((s) => s?.trim().replace(/[,;]+$/, '').trim())
    .filter(Boolean)
    .join(', ');
}

export function InvoiceView({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'none' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  // Fetched on first expand rather than on mount. A bookings table can hold
  // dozens of completed rows, and none of them need a bill until someone asks
  // to see one.
  const load = useCallback(async () => {
    setState('loading');
    const supabase = createClient();
    const { data, error } = await supabase
      .from('invoices')
      .select('id, number, issued_at, line_items, total, payment_method, seller, buyer')
      .eq('booking_id', bookingId)
      .maybeSingle<Invoice>();

    if (error) {
      setMessage(error.message);
      setState('error');
      return;
    }
    if (!data) {
      setState('none');
      return;
    }
    setInvoice(data);
    setState('ready');
  }, [bookingId]);

  function toggle() {
    const next = !open;
    setOpen(next);
    // Fetching here rather than in an effect: expanding IS the event, so an
    // effect would only re-derive it and trip the cascading-render rule.
    if (next && state === 'idle') void load();
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none print:hidden"
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        Bill
        {invoice && (
          <span className="font-mono text-xs font-normal text-muted-foreground">
            {invoice.number}
          </span>
        )}
      </button>

      {open && (
        <div className="border-t border-border p-3">
          {state === 'loading' && <p className="text-xs text-muted-foreground">Loading bill…</p>}
          {state === 'error' && <p className="text-xs text-destructive">{message}</p>}
          {state === 'none' && (
            <p className="text-xs text-muted-foreground">
              No bill yet — one is raised automatically when the job is marked complete.
            </p>
          )}

          {state === 'ready' && invoice && (
            <div className="space-y-3">
              {/* On-screen preview only. Printing does not use this markup —
                  printInvoice() builds a standalone A4 document from the same
                  data, so what prints never depends on the dashboard's layout
                  or theme. */}
              <div className="rounded-md border border-border bg-background p-5 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold">{invoice.seller.name ?? 'Moto Ceramic'}</p>
                    {addressOf(invoice.seller) && (
                      <p className="mt-0.5 max-w-xs text-xs text-muted-foreground">
                        {addressOf(invoice.seller)}
                      </p>
                    )}
                    {invoice.seller.phone && (
                      <p className="text-xs text-muted-foreground">{invoice.seller.phone}</p>
                    )}
                  </div>
                  <div className="text-right">
                    {/* Not "Tax Invoice" — that title belongs to a GST-registered
                        seller, and using it without a GSTIN is an offence. */}
                    <p className="font-semibold tracking-tight">Bill of Supply</p>
                    <p className="mt-0.5 font-mono text-xs tabular-nums">{invoice.number}</p>
                    <p className="text-xs text-muted-foreground">
                      {DATE.format(new Date(invoice.issued_at))}
                    </p>
                  </div>
                </div>

                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    Billed to
                  </p>
                  <p className="mt-0.5">{invoice.buyer.name ?? 'Customer'}</p>
                  {addressOf(invoice.buyer) && (
                    <p className="text-xs text-muted-foreground">{addressOf(invoice.buyer)}</p>
                  )}
                  {invoice.buyer.phone && (
                    <p className="text-xs text-muted-foreground">{invoice.buyer.phone}</p>
                  )}
                </div>

                <table className="mt-4 w-full border-t border-border">
                  <thead>
                    <tr className="text-[11px] tracking-wide text-muted-foreground uppercase">
                      <th className="py-2 text-left font-semibold">Description</th>
                      <th className="py-2 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.line_items.map((line, i) => (
                      <tr key={`${line.description}-${i}`} className="border-t border-border">
                        <td className="py-2">{line.description}</td>
                        <td className="py-2 text-right tabular-nums">{PRICE.format(line.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border font-semibold">
                      <td className="py-2">Total</td>
                      <td className="py-2 text-right tabular-nums">{PRICE.format(invoice.total)}</td>
                    </tr>
                  </tbody>
                </table>

                <p className="mt-3 text-xs text-muted-foreground">
                  {invoice.payment_method === 'cod'
                    ? 'Paid in cash on completion'
                    : invoice.payment_method === 'offline'
                      ? 'Paid by direct transfer'
                      : 'Paid online'}
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Not registered for GST. No tax has been charged on this bill.
                </p>
              </div>

              <Button
                size="sm"
                variant="secondary"
                onClick={() => printInvoice(invoice)}
                className="print:hidden"
              >
                <Printer aria-hidden />
                Print bill
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

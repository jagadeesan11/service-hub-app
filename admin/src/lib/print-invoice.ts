export interface InvoiceParty {
  name?: string | null;
  address_line?: string | null;
  city?: string | null;
  postal_code?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface PrintableInvoice {
  number: string;
  issued_at: string;
  line_items: { description: string; amount: number }[];
  total: number;
  payment_method: string;
  seller: InvoiceParty;
  buyer: InvoiceParty;
}

const DATE = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const PRICE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
});

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/** Trailing punctuation is stripped per segment: people type an address line
 *  ending in a comma, and joining then produces "Street,, City". */
const addressOf = (p: InvoiceParty) =>
  [p.address_line, p.city, p.postal_code]
    .map((s) => s?.trim().replace(/[,;]+$/, '').trim())
    .filter(Boolean)
    .join(', ');

function paidLine(method: string) {
  if (method === 'cod') return 'Paid in cash on completion';
  if (method === 'offline') return 'Paid by direct transfer';
  return 'Paid online';
}

/**
 * Builds the bill as a complete, standalone A4 document.
 *
 * Printing it in place did not work: the bill is rendered inside a <td> in the
 * bookings table, and the previous approach used position:absolute plus a
 * visibility toggle. Absolute positioning inside a table cell is poorly
 * specified, and any position:relative ancestor silently becomes the
 * containing block — so the sheet was laid out somewhere off the page and the
 * print came out blank.
 *
 * A separate document has no dashboard around it to fight: no sidebar, no
 * table, no positioning context, no theme variables to unwind. What is written
 * here is exactly what comes out of the printer.
 */
export function buildInvoiceDocument(invoice: PrintableInvoice): string {
  const rows = invoice.line_items
    .map(
      (l) =>
        `<tr><td>${escapeHtml(l.description)}</td><td class="num">${PRICE.format(l.amount)}</td></tr>`,
    )
    .join('');

  const sellerAddress = addressOf(invoice.seller);
  const buyerAddress = addressOf(invoice.buyer);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>${escapeHtml(invoice.number)}</title>
<style>
  @page { size: A4 portrait; margin: 16mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    /* Explicit black on white. The dashboard's palette is irrelevant here and
       a dark theme must not follow the bill onto paper. */
    color: #000; background: #fff;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 10pt; line-height: 1.45;
  }
  header { display: flex; justify-content: space-between; gap: 12mm; align-items: flex-start; }
  .shop { font-size: 13pt; font-weight: 600; }
  .muted { color: #444; font-size: 9pt; }
  .doc-type { font-weight: 600; font-size: 11pt; }
  .num-mono { font-family: ui-monospace, "SFMono-Regular", Menlo, monospace; font-size: 9pt; }
  h2 {
    font-size: 8pt; text-transform: uppercase; letter-spacing: .06em;
    color: #444; margin: 6mm 0 1mm; font-weight: 700;
  }
  hr { border: none; border-top: 1px solid #999; margin: 5mm 0 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 4mm; }
  th, td { padding: 2mm 0; text-align: left; vertical-align: top; }
  th {
    font-size: 8pt; text-transform: uppercase; letter-spacing: .06em;
    color: #444; border-bottom: 1px solid #999;
  }
  tbody td { border-bottom: 1px solid #ddd; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tr.total td { border-top: 1.5px solid #000; border-bottom: none; font-weight: 700; padding-top: 3mm; }
  /* A line item must not be split across a page break. */
  tr { break-inside: avoid; }
  thead { display: table-header-group; }
  footer { margin-top: 6mm; font-size: 9pt; color: #444; }
</style></head>
<body>
  <header>
    <div>
      <div class="shop">${escapeHtml(invoice.seller.name ?? 'Moto Ceramic')}</div>
      ${sellerAddress ? `<div class="muted">${escapeHtml(sellerAddress)}</div>` : ''}
      ${invoice.seller.phone ? `<div class="muted">${escapeHtml(invoice.seller.phone)}</div>` : ''}
    </div>
    <div style="text-align:right">
      <!-- Not "Tax Invoice": that title belongs to a GST-registered seller. -->
      <div class="doc-type">Bill of Supply</div>
      <div class="num-mono">${escapeHtml(invoice.number)}</div>
      <div class="muted">${DATE.format(new Date(invoice.issued_at))}</div>
    </div>
  </header>

  <hr />
  <h2>Billed to</h2>
  <div>${escapeHtml(invoice.buyer.name ?? 'Customer')}</div>
  ${buyerAddress ? `<div class="muted">${escapeHtml(buyerAddress)}</div>` : ''}
  ${invoice.buyer.phone ? `<div class="muted">${escapeHtml(invoice.buyer.phone)}</div>` : ''}

  <table>
    <thead><tr><th>Description</th><th class="num">Amount</th></tr></thead>
    <tbody>
      ${rows}
      <tr class="total"><td>Total</td><td class="num">${PRICE.format(invoice.total)}</td></tr>
    </tbody>
  </table>

  <footer>
    <div>${paidLine(invoice.payment_method)}</div>
    <div style="margin-top:2mm">Not registered for GST. No tax has been charged on this bill.</div>
  </footer>
</body></html>`;
}

/**
 * Prints the bill via an off-screen iframe.
 *
 * An iframe rather than window.open, because a popup blocker will silently
 * swallow the window and the user just sees nothing happen.
 */
export function printInvoice(invoice: PrintableInvoice): void {
  const frame = document.createElement('iframe');
  // Off-screen rather than display:none — a hidden frame is not guaranteed to
  // lay out, and an unlaid-out document prints blank.
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }

  doc.open();
  doc.write(buildInvoiceDocument(invoice));
  doc.close();

  const run = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    // Left in place briefly: removing it synchronously can cancel the print
    // dialog in some browsers.
    window.setTimeout(() => frame.remove(), 1000);
  };

  if (doc.readyState === 'complete') run();
  else frame.addEventListener('load', run, { once: true });
}

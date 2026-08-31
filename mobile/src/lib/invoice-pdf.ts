/**
 * The bill as a printable document.
 *
 * Pure and dependency-free so the wording can be tested without a device. What
 * this produces is a legal record, and two things about it are not cosmetic:
 *
 *  - It is a "Bill of Supply", never a "Tax Invoice". That title belongs to a
 *    GST-registered seller, and this shop is not one.
 *  - It states plainly that no tax was charged, so nobody reading it later has
 *    to work out why there is no tax line.
 *
 * No images: printing from HTML on iOS cannot load local asset URLs, so a logo
 * would have to be inlined as base64 and would silently vanish otherwise.
 */

export interface PdfParty {
  name?: string | null;
  address_line?: string | null;
  city?: string | null;
  postal_code?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface PdfInvoice {
  number: string;
  issued_at: string;
  line_items: { description: string; amount: number }[];
  total: number;
  payment_method: string;
  seller: PdfParty;
  buyer: PdfParty;
}

/** A4 at 72 PPI. expo-print defaults to US Letter, which is not what an Indian
 *  shop prints on. */
export const PAGE = { width: 595, height: 842 } as const;

const MONEY = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const LONG_DATE = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const PAYMENT_LABELS: Record<string, string> = {
  online: 'Paid online',
  cod: 'Cash on delivery',
  offline: 'Direct transfer',
};

/**
 * Everything interpolated into the document goes through this.
 *
 * Customer names and addresses are free text typed by people, and a single
 * "&" or "<" in an address would otherwise corrupt the markup — quietly, and
 * only for that one customer's bill.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * A filename someone can find again.
 *
 * Invoice numbers carry slashes — "MC/2026-27/0008" — which are path
 * separators on every platform this runs on, so they cannot go into a filename
 * as they are.
 */
export function invoiceFileName(number: string): string {
  const safe = String(number ?? '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `Bill-of-supply-${safe || 'invoice'}.pdf`;
}

function addressOf(p: PdfParty): string {
  // Trailing punctuation is stripped before joining, or an address line typed
  // with a trailing comma renders as "Street,, City".
  return [p.address_line, p.city, p.postal_code]
    .map((s) => s?.trim().replace(/[,;]+$/, '').trim())
    .filter(Boolean)
    .join(', ');
}

function partyBlock(p: PdfParty, fallbackName: string): string {
  const address = addressOf(p);
  return [
    `<div class="party-name">${escapeHtml(p.name || fallbackName)}</div>`,
    address ? `<div class="muted">${escapeHtml(address)}</div>` : '',
    p.phone ? `<div class="muted">${escapeHtml(p.phone)}</div>` : '',
    p.email ? `<div class="muted">${escapeHtml(p.email)}</div>` : '',
  ]
    .filter(Boolean)
    .join('');
}

export function invoiceHtml(invoice: PdfInvoice): string {
  const issued = new Date(invoice.issued_at);
  const issuedLabel = Number.isNaN(issued.getTime()) ? '' : LONG_DATE.format(issued);

  const rows = invoice.line_items
    .map(
      (line) => `
        <tr>
          <td>${escapeHtml(line.description)}</td>
          <td class="amount">${escapeHtml(MONEY.format(Number(line.amount)))}</td>
        </tr>`,
    )
    .join('');

  const payment = PAYMENT_LABELS[invoice.payment_method] ?? invoice.payment_method;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(invoiceFileName(invoice.number))}</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 40px 44px;
    font-family: -apple-system, "Helvetica Neue", Helvetica, Roboto, Arial, sans-serif;
    color: #12181d;
    font-size: 12px;
    line-height: 1.5;
  }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .doc-type { font-size: 11px; letter-spacing: 1.4px; text-transform: uppercase; color: #5b6770; }
  /* An invoice number carries slashes, and a browser will happily break after
     one — "MC/2026-" on one line and "27/0006" on the next, which stops it
     being a reference anybody can quote back. */
  .number { font-size: 20px; font-weight: 700; margin-top: 2px; white-space: nowrap; }
  .muted { color: #5b6770; }
  .right { text-align: right; }
  .party-name { font-weight: 600; font-size: 13px; }
  .rule { height: 1px; background: #d8dee3; margin: 22px 0; }
  .parties { display: flex; justify-content: space-between; gap: 32px; }
  .parties > div { max-width: 48%; }
  .label { font-size: 10px; letter-spacing: 1.2px; text-transform: uppercase; color: #8a959d; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 26px; }
  th { text-align: left; font-size: 10px; letter-spacing: 1.2px; text-transform: uppercase; color: #8a959d; padding-bottom: 8px; border-bottom: 1px solid #d8dee3; font-weight: 600; }
  td { padding: 9px 0; border-bottom: 1px solid #eef1f4; vertical-align: top; }
  /* Digits line up so a column of money reads as a column. */
  .amount { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .total-row td { border-bottom: none; padding-top: 14px; font-size: 15px; font-weight: 700; }
  .note { margin-top: 26px; font-size: 11px; color: #5b6770; }
  .footer { margin-top: 34px; padding-top: 14px; border-top: 1px solid #d8dee3; font-size: 10px; color: #8a959d; }
</style>
</head>
<body>
  <div class="head">
    <div>${partyBlock(invoice.seller, 'Moto Ceramic')}</div>
    <div class="right">
      <div class="doc-type">Bill of Supply</div>
      <div class="number">${escapeHtml(invoice.number)}</div>
      <div class="muted">${escapeHtml(issuedLabel)}</div>
    </div>
  </div>

  <div class="rule"></div>

  <div class="parties">
    <div>
      <div class="label">Billed to</div>
      ${partyBlock(invoice.buyer, 'Customer')}
    </div>
    <div class="right">
      <div class="label">Payment</div>
      <div>${escapeHtml(payment)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr><th>Description</th><th class="amount">Amount</th></tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td>Total</td>
        <td class="amount">${escapeHtml(MONEY.format(Number(invoice.total)))}</td>
      </tr>
    </tbody>
  </table>

  <div class="note">Not registered for GST. No tax has been charged on this bill.</div>

  <div class="footer">
    This bill was raised when the job was completed and cannot be edited.
  </div>
</body>
</html>`;
}

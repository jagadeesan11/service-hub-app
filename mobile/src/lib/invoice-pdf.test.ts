import { escapeHtml, invoiceFileName, invoiceHtml, type PdfInvoice } from '@/lib/invoice-pdf';

const INVOICE: PdfInvoice = {
  number: 'MC/2026-27/0008',
  issued_at: '2026-08-30T10:15:00',
  line_items: [
    { description: 'Ceramic Coating — 2 Years Warranty', amount: 13500 },
    { description: 'FIRST100', amount: -1000 },
  ],
  total: 12500,
  payment_method: 'cod',
  seller: {
    name: 'Moto Ceramic',
    address_line: '12 Nehru Street,',
    city: 'Puducherry',
    postal_code: '605001',
  },
  buyer: { name: 'Divya Ramesh', phone: '+91 90031 77420' },
};

describe('escapeHtml', () => {
  it('neutralises every character that could break the markup', () => {
    expect(escapeHtml(`<b>&"'`)).toBe('&lt;b&gt;&amp;&quot;&#39;');
  });

  it('renders null and undefined as empty, not as the words', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('escapes the ampersand first, so escapes are not double-escaped', () => {
    expect(escapeHtml('Tools & Co <Ltd>')).toBe('Tools &amp; Co &lt;Ltd&gt;');
  });
});

describe('invoiceFileName', () => {
  it('strips the slashes an invoice number carries', () => {
    expect(invoiceFileName('MC/2026-27/0008')).toBe('Bill-of-supply-MC-2026-27-0008.pdf');
  });

  it('never leaves a leading or trailing separator', () => {
    expect(invoiceFileName('/MC/')).toBe('Bill-of-supply-MC.pdf');
  });

  it('falls back rather than producing a nameless file', () => {
    expect(invoiceFileName('///')).toBe('Bill-of-supply-invoice.pdf');
    expect(invoiceFileName('')).toBe('Bill-of-supply-invoice.pdf');
  });
});

describe('invoiceHtml', () => {
  const html = invoiceHtml(INVOICE);

  it('is titled Bill of Supply and never Tax Invoice', () => {
    expect(html).toContain('Bill of Supply');
    expect(html).not.toMatch(/tax invoice/i);
  });

  it('states that no tax was charged', () => {
    expect(html).toContain('Not registered for GST. No tax has been charged on this bill.');
  });

  it('carries the number, the date and both parties', () => {
    expect(html).toContain('MC/2026-27/0008');
    expect(html).toContain('30 August 2026');
    expect(html).toContain('Moto Ceramic');
    expect(html).toContain('Divya Ramesh');
  });

  it('renders every line and the total as money', () => {
    expect(html).toContain('Ceramic Coating');
    expect(html).toContain('FIRST100');
    // The discount keeps its sign rather than reading as a charge.
    expect(html).toMatch(/-\s*₹\s*1,000\.00/);
    expect(html).toMatch(/₹\s*12,500\.00/);
  });

  it('names the payment method in words', () => {
    expect(html).toContain('Cash on delivery');
  });

  it('joins the address without the doubled comma a trailing one would leave', () => {
    expect(html).toContain('12 Nehru Street, Puducherry, 605001');
  });

  it('escapes free text rather than letting it into the markup', () => {
    const nasty = invoiceHtml({
      ...INVOICE,
      buyer: { name: '<script>alert(1)</script>' },
    });
    expect(nasty).not.toContain('<script>');
    expect(nasty).toContain('&lt;script&gt;');
  });

  it('omits the date rather than printing Invalid Date', () => {
    const html = invoiceHtml({ ...INVOICE, issued_at: 'not-a-date' });
    expect(html).not.toContain('Invalid Date');
  });
});

import { StyleSheet, View } from 'react-native';

import { DownloadBillButton } from '@/components/download-bill-button';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';
import { formatParty, useInvoice } from '@/hooks/use-invoice';
import { useTheme } from '@/hooks/use-theme';

const PRICE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
});

const DATE = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * The customer's copy of the bill.
 *
 * Renders nothing until the job is completed and the bill exists, so the
 * caller does not need to know the lifecycle — a booking in progress simply
 * shows no bill section rather than an empty one.
 */
export function InvoiceCard({ bookingId }: { bookingId: string }) {
  const theme = useTheme();
  const { data: invoice } = useInvoice(bookingId);

  if (!invoice) return null;

  const sellerAddress = formatParty(invoice.seller);

  return (
    <View style={styles.section}>
      <ThemedText type="heading">Bill</ThemedText>

      <Card style={styles.card}>
        <View style={styles.headRow}>
          <View style={styles.headLeft}>
            <ThemedText type="bodyMedium">{invoice.seller.name ?? 'Moto Ceramic'}</ThemedText>
            {sellerAddress ? (
              <ThemedText type="caption" themeColor="textMuted">
                {sellerAddress}
              </ThemedText>
            ) : null}
          </View>
          <View style={styles.headRight}>
            {/* "Bill of supply", not "invoice": the seller is not GST
                registered, and the wording is not cosmetic. */}
            <ThemedText type="smallBold">Bill of supply</ThemedText>
            <ThemedText type="caption" themeColor="textMuted">
              {invoice.number}
            </ThemedText>
            <ThemedText type="caption" themeColor="textMuted">
              {DATE.format(new Date(invoice.issued_at))}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        {invoice.line_items.map((line, i) => (
          <View key={`${line.description}-${i}`} style={styles.lineRow}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.lineLabel}>
              {line.description}
            </ThemedText>
            <ThemedText type="small">{PRICE.format(line.amount)}</ThemedText>
          </View>
        ))}

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.lineRow}>
          <ThemedText type="smallBold">Total</ThemedText>
          <ThemedText type="price">{PRICE.format(invoice.total)}</ThemedText>
        </View>

        <ThemedText type="caption" themeColor="textMuted">
          {invoice.payment_method === 'cod' ? 'Paid in cash on completion' : 'Paid online'}
        </ThemedText>
        <ThemedText type="caption" themeColor="textMuted">
          Not registered for GST. No tax has been charged.
        </ThemedText>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <DownloadBillButton invoice={invoice} variant="link" />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.three },
  card: { gap: Spacing.two },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  headLeft: { flex: 1, gap: 2 },
  headRight: { alignItems: 'flex-end', gap: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.one },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  lineLabel: { flex: 1 },
});

import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { ErrorState, LoadingScreen } from '@/components/ui/feedback';
import { Spacing } from '@/constants/theme';
import { useOwnerInvoice } from '@/hooks/use-owner-invoices';
import { useTheme } from '@/hooks/use-theme';
import { isSettled, linesReconcile } from '@/lib/invoices';

const PRICE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});
const DATE = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

const PAYMENT_LABELS: Record<string, string> = {
  online: 'Paid online',
  cod: 'Cash on delivery',
  offline: 'Direct transfer',
};

export default function OwnerInvoiceScreen() {
  const theme = useTheme();
  const { invoiceId } = useLocalSearchParams<{ invoiceId: string }>();
  const { data: invoice, isLoading, isError, error, refetch } = useOwnerInvoice(invoiceId);

  if (isLoading) return <LoadingScreen />;

  if (isError || !invoice) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centre} edges={['left', 'right', 'bottom']}>
          <ErrorState
            message={isError ? (error as Error).message : 'That bill could not be found.'}
            onRetry={() => refetch()}
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  const settled = isSettled(invoice);
  const addsUp = linesReconcile(invoice.line_items, invoice.total);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: invoice.number, headerBackTitle: 'Bills' }} />
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.head}>
            {/* Not "Tax Invoice": that title belongs to a GST-registered
                seller, and this shop is not one. */}
            <ThemedText type="label" themeColor="textMuted">
              Bill of Supply
            </ThemedText>
            <ThemedText type="title">{invoice.number}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {DATE.format(new Date(invoice.issued_at))}
            </ThemedText>
          </View>

          <Card style={styles.card}>
            <ThemedText type="label" themeColor="textMuted">
              Billed to
            </ThemedText>
            <ThemedText type="bodyMedium">{invoice.buyer?.name ?? 'Customer'}</ThemedText>
            {invoice.buyer?.phone ? (
              <ThemedText type="small" themeColor="textSecondary">
                {invoice.buyer.phone}
              </ThemedText>
            ) : null}
            {[invoice.buyer?.address_line, invoice.buyer?.city, invoice.buyer?.postal_code]
              .filter(Boolean)
              .join(', ') ? (
              <ThemedText type="small" themeColor="textSecondary">
                {[invoice.buyer?.address_line, invoice.buyer?.city, invoice.buyer?.postal_code]
                  .filter(Boolean)
                  .join(', ')}
              </ThemedText>
            ) : null}
          </Card>

          <Card style={styles.card}>
            {invoice.line_items.map((line, i) => (
              <View key={`${line.description}-${i}`} style={styles.line}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.lineName}>
                  {line.description}
                </ThemedText>
                <ThemedText
                  type="small"
                  themeColor={Number(line.amount) < 0 ? 'primary' : 'text'}
                >
                  {PRICE.format(Number(line.amount))}
                </ThemedText>
              </View>
            ))}

            <View style={[styles.total, { borderTopColor: theme.border }]}>
              <ThemedText type="smallBold">Total</ThemedText>
              <ThemedText type="price">{PRICE.format(Number(invoice.total))}</ThemedText>
            </View>

            {/* Shown only if the arithmetic is actually wrong. A bill whose
                lines do not sum to its own total is the one thing a customer
                will notice, so it should not be the shop that finds out last. */}
            {!addsUp && (
              <ThemedText type="caption" themeColor="error">
                These lines do not add up to the total. Check this bill before sending it.
              </ThemedText>
            )}

            <ThemedText type="caption" themeColor="textMuted">
              Not registered for GST. No tax has been charged on this bill.
            </ThemedText>
          </Card>

          <Card style={styles.card}>
            <View style={styles.line}>
              <ThemedText type="small" themeColor="textSecondary">
                Payment
              </ThemedText>
              <ThemedText type="small">
                {PAYMENT_LABELS[invoice.payment_method] ?? invoice.payment_method}
              </ThemedText>
            </View>
            <View style={styles.line}>
              <ThemedText type="small" themeColor="textSecondary">
                Status
              </ThemedText>
              <ThemedText type="smallBold" themeColor={settled ? 'success' : 'error'}>
                {settled ? 'Received' : 'Still owed'}
              </ThemedText>
            </View>
          </Card>

          <View style={styles.body}>
            <ThemedText type="caption" themeColor="textMuted">
              This bill was raised when the job was completed and cannot be edited. To collect cash,
              open the job itself.
            </ThemedText>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  centre: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.four },
  scroll: { paddingBottom: Spacing.six, gap: Spacing.three },
  head: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: 2 },
  body: { paddingHorizontal: Spacing.four },
  card: { marginHorizontal: Spacing.four, gap: Spacing.two },
  line: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.three },
  lineName: { flex: 1 },
  total: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    marginTop: Spacing.one,
  },
});

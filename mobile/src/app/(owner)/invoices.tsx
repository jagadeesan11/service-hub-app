import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/feedback';
import { Radius, Spacing } from '@/constants/theme';
import { useOwnerInvoices, type OwnerInvoice } from '@/hooks/use-owner-invoices';
import { useTheme } from '@/hooks/use-theme';
import {
  filterInvoices,
  isSettled,
  outstandingTotal,
  settledTotal,
  type InvoiceFilter,
} from '@/lib/invoices';

const PRICE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const DATE = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const FILTERS: InvoiceFilter[] = ['Unpaid', 'Paid', 'All'];

export default function OwnerInvoicesScreen() {
  const theme = useTheme();
  const [filter, setFilter] = useState<InvoiceFilter>('Unpaid');
  const { data, isLoading, isError, error, refetch, isRefetching } = useOwnerInvoices();

  const view = useMemo(
    () => ({
      rows: filterInvoices(data, filter),
      owed: outstandingTotal(data),
      in: settledTotal(data),
    }),
    [data, filter],
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
          }
        >
          <View style={styles.header}>
            <ThemedText type="title">Bills</ThemedText>
          </View>

          {isLoading ? (
            <View style={styles.body}>
              <SkeletonList count={3} height={76} />
            </View>
          ) : isError ? (
            <View style={styles.body}>
              <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
            </View>
          ) : (
            <>
              <View style={styles.stats}>
                <Card style={styles.stat}>
                  <ThemedText type="caption" themeColor="textMuted">
                    Still owed
                  </ThemedText>
                  <ThemedText type="price" themeColor={view.owed > 0 ? 'error' : 'text'}>
                    {PRICE.format(view.owed)}
                  </ThemedText>
                </Card>
                <Card style={styles.stat}>
                  <ThemedText type="caption" themeColor="textMuted">
                    Received
                  </ThemedText>
                  <ThemedText type="price">{PRICE.format(view.in)}</ThemedText>
                </Card>
              </View>

              <View style={styles.filters}>
                {FILTERS.map((f) => {
                  const on = filter === f;
                  return (
                    <Pressable
                      key={f}
                      onPress={() => setFilter(f)}
                      accessibilityRole="button"
                      aria-selected={on}
                      style={({ pressed }) => [
                        styles.chip,
                        {
                          backgroundColor: on ? theme.text : theme.surface,
                          borderColor: on ? theme.text : theme.border,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{ color: on ? theme.background : theme.textSecondary }}
                      >
                        {f}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.list}>
                {view.rows.length === 0 ? (
                  <EmptyState
                    title={filter === 'Unpaid' ? 'Nothing outstanding' : 'No bills here'}
                    description={
                      filter === 'Unpaid'
                        ? 'Every bill has been settled.'
                        : 'A bill is raised automatically when a job is marked complete.'
                    }
                  />
                ) : (
                  view.rows.map((inv) => <InvoiceRow key={inv.id} invoice={inv} />)
                )}
              </View>

              <View style={styles.body}>
                <ThemedText type="caption" themeColor="textMuted">
                  Bills are raised automatically when a job is completed, and frozen at that
                  moment. Collect cash from the job itself.
                </ThemedText>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function InvoiceRow({ invoice }: { invoice: OwnerInvoice }) {
  const theme = useTheme();
  const settled = isSettled(invoice);

  return (
    <Card
      style={styles.row}
      onPress={() =>
        router.push({ pathname: '/(owner)/invoice/[invoiceId]', params: { invoiceId: invoice.id } })
      }
    >
      <View style={styles.rowCopy}>
        <View style={styles.rowHead}>
          <ThemedText type="smallBold" style={styles.number}>
            {invoice.number}
          </ThemedText>
          <View
            style={[
              styles.badge,
              { backgroundColor: settled ? theme.successSoft : theme.errorSoft },
            ]}
          >
            <ThemedText
              type="caption"
              style={{ color: settled ? theme.success : theme.error }}
            >
              {settled ? 'Paid' : 'Unpaid'}
            </ThemedText>
          </View>
        </View>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {[invoice.buyer?.name, DATE.format(new Date(invoice.issued_at))]
            .filter(Boolean)
            .join(' · ')}
        </ThemedText>
      </View>

      <ThemedText type="smallBold">{PRICE.format(invoice.total)}</ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: { paddingBottom: Spacing.six },
  header: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  body: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  stats: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  stat: { flex: 1, gap: 2 },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  list: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rowCopy: { flex: 1, gap: 1 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  number: { letterSpacing: 0.5 },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.two, paddingVertical: 1 },
});

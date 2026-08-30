import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { ErrorState, SkeletonList } from '@/components/ui/feedback';
import { Radius, Spacing } from '@/constants/theme';
import { useOwnerFeedback } from '@/hooks/use-owner-feedback';
import { useReportBookings } from '@/hooks/use-owner-reports';
import { useTheme } from '@/hooks/use-theme';
import { averageRating, publishedOnly } from '@/lib/feedback-board';
import {
  breakdownBy,
  periodBounds,
  summarise,
  withShare,
  withinPeriod,
  type Period,
} from '@/lib/reports';

const PRICE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const PERIODS: Period[] = ['Week', 'Month', 'Quarter'];

export default function OwnerReportsScreen() {
  const theme = useTheme();
  const [period, setPeriod] = useState<Period>('Month');
  const bookings = useReportBookings();
  const feedback = useOwnerFeedback();

  const report = useMemo(() => {
    const { from, to } = periodBounds(period);
    const rows = (bookings.data ?? []).filter((r) => withinPeriod(r, from, to));
    return {
      summary: summarise(rows),
      byService: withShare(breakdownBy(rows, (r) => r.services?.name ?? null)),
      byTech: withShare(breakdownBy(rows, (r) => r.technicians?.name ?? null)),
      empty: rows.length === 0,
    };
  }, [bookings.data, period]);

  const rating = averageRating(feedback.data);
  const reviewCount = publishedOnly(feedback.data).length;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={bookings.isRefetching}
              onRefresh={() => {
                void bookings.refetch();
                void feedback.refetch();
              }}
            />
          }
        >
          <View style={styles.header}>
            <ThemedText type="title">Reports</ThemedText>
          </View>

          <View style={styles.periods}>
            {PERIODS.map((p) => {
              const on = period === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => setPeriod(p)}
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
                    {p === 'Week' ? 'Last 7 days' : p === 'Month' ? 'Last 30 days' : 'Last 90 days'}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {bookings.isLoading ? (
            <View style={styles.body}>
              <SkeletonList count={3} height={84} />
            </View>
          ) : bookings.isError ? (
            <View style={styles.body}>
              <ErrorState
                message={(bookings.error as Error).message}
                onRetry={() => bookings.refetch()}
              />
            </View>
          ) : (
            <>
              <View style={styles.kpis}>
                <Kpi label="Earned" value={PRICE.format(report.summary.revenue)} />
                <Kpi label="Jobs done" value={String(report.summary.jobs)} />
                <Kpi
                  label="Average job"
                  value={
                    report.summary.averageTicket === null
                      ? '—'
                      : PRICE.format(report.summary.averageTicket)
                  }
                />
                <Kpi
                  label="Rating"
                  value={rating === null ? '—' : rating.toFixed(1)}
                  hint={reviewCount > 0 ? `${reviewCount} reviews` : 'no reviews yet'}
                />
              </View>

              {report.summary.pipeline > 0 && (
                <View style={styles.body}>
                  <Card style={styles.pipeline}>
                    <ThemedText type="smallBold">
                      {PRICE.format(report.summary.pipeline)} booked, not yet done
                    </ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">
                      Work in the diary. It is not counted as earned until the job is completed.
                    </ThemedText>
                  </Card>
                </View>
              )}

              <View style={styles.body}>
                <Card style={styles.split}>
                  <ThemedText type="label" themeColor="textMuted">
                    How it came in
                  </ThemedText>
                  <Row
                    label="Cash"
                    value={PRICE.format(report.summary.cashRevenue)}
                  />
                  <Row
                    label="Online"
                    value={PRICE.format(report.summary.onlineRevenue)}
                  />
                </Card>
              </View>

              <Section title="By service" rows={report.byService} empty={report.empty} />
              <Section title="By technician" rows={report.byTech} empty={report.empty} />

              {report.empty && (
                <View style={styles.body}>
                  <Card style={styles.emptyCard}>
                    <ThemedText type="bodyMedium">Nothing in this period</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Try a longer window, or check back once jobs are completed.
                    </ThemedText>
                  </Card>
                </View>
              )}

              <View style={styles.body}>
                <ThemedText type="caption" themeColor="textMuted">
                  Earned counts completed jobs only, after discounts and promo codes. Cancelled and
                  unpaid bookings are not counted. Export a spreadsheet from the web panel.
                </ThemedText>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card style={styles.kpi}>
      <ThemedText type="caption" themeColor="textMuted">
        {label}
      </ThemedText>
      <ThemedText type="price">{value}</ThemedText>
      {hint ? (
        <ThemedText type="caption" themeColor="textMuted">
          {hint}
        </ThemedText>
      ) : null}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small">{value}</ThemedText>
    </View>
  );
}

function Section({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { key: string; jobs: number; revenue: number; share: number }[];
  empty: boolean;
}) {
  const theme = useTheme();
  if (empty || rows.length === 0) return null;

  return (
    <View style={styles.section}>
      <ThemedText type="label" themeColor="textMuted" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      <Card style={styles.sectionCard}>
        {rows.map((r) => (
          <View key={r.key} style={styles.barRow}>
            <View style={styles.barHead}>
              <ThemedText type="small" numberOfLines={1} style={styles.barName}>
                {r.key}
              </ThemedText>
              <ThemedText type="small">{PRICE.format(r.revenue)}</ThemedText>
            </View>
            {/* Scaled to the biggest row, not the total: a bar chart is read
                by comparing lengths against each other. */}
            <View style={[styles.barTrack, { backgroundColor: theme.surfaceSunk }]}>
              <View
                style={[
                  styles.barFill,
                  { backgroundColor: theme.primary, width: `${Math.max(r.share * 100, 2)}%` },
                ]}
              />
            </View>
            <ThemedText type="caption" themeColor="textMuted">
              {r.jobs} {r.jobs === 1 ? 'job' : 'jobs'}
            </ThemedText>
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: { paddingBottom: Spacing.six },
  header: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  body: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  periods: {
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
  kpis: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  kpi: { flexGrow: 1, flexBasis: '46%', gap: 2 },
  pipeline: { gap: 2 },
  split: { gap: Spacing.two },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  section: { marginTop: Spacing.four, gap: Spacing.two },
  sectionTitle: { paddingHorizontal: Spacing.four },
  sectionCard: { marginHorizontal: Spacing.four, gap: Spacing.three },
  barRow: { gap: Spacing.one },
  barHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  barName: { flex: 1 },
  barTrack: { height: 6, borderRadius: Radius.full, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: Radius.full },
  emptyCard: { gap: 2 },
});

import { router } from 'expo-router';
import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StatusChip } from '@/components/owner/status-chip';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { ErrorState, SkeletonList } from '@/components/ui/feedback';
import { Spacing } from '@/constants/theme';
import { useAppSettings } from '@/hooks/use-app-settings';
import { useOwnerBookings, type OwnerBooking } from '@/hooks/use-owner';
import { useTheme } from '@/hooks/use-theme';
import { greetingFor } from '@/lib/home-screen';
import {
  bookedToday,
  cashToCollect,
  inTheBay,
  jobsLeft,
  needsAssignment,
  statusTone,
  todaysBookings,
} from '@/lib/owner-board';

const PRICE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const TIME = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });

function customerName(b: OwnerBooking): string {
  return b.contact_name || b.profiles?.name || 'Unnamed customer';
}

function vehicleOf(b: OwnerBooking): string | null {
  const attrs = b.customer_assets?.attributes ?? {};
  const parts = [attrs.make, attrs.model, attrs.vehicle_size].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

export default function OwnerInboxScreen() {
  const theme = useTheme();
  const { settings } = useAppSettings();
  const { data, isLoading, isError, error, refetch, isRefetching } = useOwnerBookings();

  const board = useMemo(() => {
    const today = todaysBookings(data);
    return {
      today,
      needs: needsAssignment(today),
      bay: inTheBay(today),
      booked: bookedToday(today),
      left: jobsLeft(today),
      cash: cashToCollect(today),
    };
  }, [data]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            // A shop board that cannot be pulled fresh is a board nobody
            // trusts — the day changes while you are looking at it.
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
          }
        >
          <View style={styles.header}>
            <ThemedText type="label" themeColor="primary">
              {settings.shop_name}
            </ThemedText>
            <ThemedText type="display">{greetingFor()}</ThemedText>
          </View>

          {isLoading ? (
            <View style={styles.body}>
              <SkeletonList count={3} height={84} />
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
                    Booked today
                  </ThemedText>
                  <ThemedText type="price">{PRICE.format(board.booked)}</ThemedText>
                </Card>
                <Card style={styles.stat}>
                  <ThemedText type="caption" themeColor="textMuted">
                    Jobs left
                  </ThemedText>
                  <ThemedText type="price">{board.left}</ThemedText>
                </Card>
              </View>

              {/* Only when there is money outstanding. A zero here would be
                  noise; a number is something to act on before closing. */}
              {board.cash > 0 && (
                <View style={styles.body}>
                  <Card style={[styles.cash, { borderColor: theme.error }]}>
                    <ThemedText type="smallBold" themeColor="error">
                      {PRICE.format(board.cash)} cash still to collect
                    </ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">
                      Finished jobs where the money has not been marked in.
                    </ThemedText>
                  </Card>
                </View>
              )}

              <Section title="Needs you" count={board.needs.length}>
                {board.needs.length === 0 ? (
                  <Card style={styles.empty}>
                    <ThemedText type="bodyMedium">Inbox clear</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Every job today has someone on it.
                    </ThemedText>
                  </Card>
                ) : (
                  board.needs.map((b) => <JobRow key={b.id} booking={b} highlight />)
                )}
              </Section>

              {board.bay.length > 0 && (
                <Section title="In the bay" count={board.bay.length}>
                  {board.bay.map((b) => (
                    <JobRow key={b.id} booking={b} />
                  ))}
                </Section>
              )}

              {board.today.length === 0 && (
                <View style={styles.body}>
                  <Card style={styles.empty}>
                    <ThemedText type="bodyMedium">Nothing booked today</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      New bookings from the app land here as they come in.
                    </ThemedText>
                  </Card>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <ThemedText type="label" themeColor="textMuted">
          {title}
        </ThemedText>
        {count > 0 && (
          <ThemedText type="caption" themeColor="textMuted">
            {count}
          </ThemedText>
        )}
      </View>
      <View style={styles.stack}>{children}</View>
    </View>
  );
}

function JobRow({ booking, highlight }: { booking: OwnerBooking; highlight?: boolean }) {
  const theme = useTheme();
  const tone = statusTone(booking);
  const vehicle = vehicleOf(booking);

  return (
    <Card
      onPress={() =>
        router.push({
          pathname: '/(owner)/job/[bookingId]',
          params: { bookingId: booking.id },
        })
      }
      style={
        // Outlined only when it is waiting on someone. Card's style prop takes
        // a single ViewStyle, so this picks a shape rather than layering one.
        highlight ? { ...styles.row, borderWidth: 1, borderColor: theme.error } : styles.row
      }
    >
      <View style={styles.rowHead}>
        <ThemedText type="bodyMedium" numberOfLines={1} style={styles.rowTitle}>
          {booking.services?.name ?? 'Service'}
        </ThemedText>
        <ThemedText type="smallBold">{PRICE.format(booking.net_price)}</ThemedText>
      </View>

      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {[customerName(booking), vehicle, TIME.format(new Date(booking.scheduled_at))]
          .filter(Boolean)
          .join(' · ')}
      </ThemedText>

      <View style={styles.rowFoot}>
        <StatusChip tone={tone} />
        {booking.technicians?.name ? (
          <ThemedText type="caption" themeColor="textMuted">
            {booking.technicians.name}
          </ThemedText>
        ) : null}
        {booking.needs_pickup ? (
          <ThemedText type="caption" themeColor="primary">
            Pickup
          </ThemedText>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: { paddingBottom: Spacing.six },
  header: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: Spacing.one },
  body: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  stats: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  stat: { flex: 1, gap: 2 },
  cash: { gap: 2, borderWidth: 1 },
  section: { marginTop: Spacing.four, gap: Spacing.two },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
  },
  stack: { gap: Spacing.two, paddingHorizontal: Spacing.four },
  row: { gap: Spacing.one },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rowTitle: { flex: 1 },
  rowFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: 2,
  },
  empty: { gap: 2 },
});

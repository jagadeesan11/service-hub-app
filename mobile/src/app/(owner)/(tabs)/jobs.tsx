import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StatusChip } from '@/components/owner/status-chip';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/feedback';
import { Radius, Spacing } from '@/constants/theme';
import { useOwnerBookings, type OwnerBooking } from '@/hooks/use-owner';
import { useTheme } from '@/hooks/use-theme';
import { isSameDay, statusTone } from '@/lib/owner-board';

const PRICE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const WHEN = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

const FILTERS = ['All', 'Today', 'Unassigned', 'Done'] as const;
type Filter = (typeof FILTERS)[number];

export default function OwnerJobsScreen() {
  const theme = useTheme();
  const [filter, setFilter] = useState<Filter>('All');
  const { data, isLoading, isError, error, refetch } = useOwnerBookings();

  const rows = useMemo(() => {
    const all = data ?? [];
    return all.filter((b) => {
      if (filter === 'Today') return isSameDay(b.scheduled_at);
      if (filter === 'Unassigned') return !b.technician_id && b.status === 'confirmed';
      if (filter === 'Done') return b.status === 'completed';
      return true;
    });
  }, [data, filter]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <ThemedText type="title">Jobs</ThemedText>
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
                <ThemedText type="small" style={{ color: on ? theme.background : theme.textSecondary }}>
                  {f}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {isLoading ? (
          <View style={styles.body}>
            <SkeletonList count={4} height={76} />
          </View>
        ) : isError ? (
          <View style={styles.body}>
            <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <EmptyState
                title="Nothing here"
                description={
                  filter === 'All'
                    ? 'Bookings from the app will appear here.'
                    : 'No jobs match this filter.'
                }
              />
            }
            renderItem={({ item }) => <JobCard booking={item} />}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function JobCard({ booking }: { booking: OwnerBooking }) {
  const name = booking.contact_name || booking.profiles?.name || 'Unnamed customer';

  return (
    <Card
      style={styles.card}
      onPress={() =>
        router.push({
          pathname: '/(owner)/job/[bookingId]',
          params: { bookingId: booking.id },
        })
      }
    >
      <View style={styles.cardHead}>
        <ThemedText type="bodyMedium" numberOfLines={1} style={styles.cardTitle}>
          {booking.services?.name ?? 'Service'}
        </ThemedText>
        <ThemedText type="smallBold">{PRICE.format(booking.net_price)}</ThemedText>
      </View>

      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {WHEN.format(new Date(booking.scheduled_at))} · {name}
      </ThemedText>

      <View style={styles.cardFoot}>
        <StatusChip tone={statusTone(booking)} />
        {booking.technicians?.name ? (
          <ThemedText type="caption" themeColor="textMuted">
            {booking.technicians.name}
          </ThemedText>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
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
  body: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  list: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  card: { gap: Spacing.one },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  cardTitle: { flex: 1 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: 2 },
});

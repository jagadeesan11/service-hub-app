import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AssignSheet } from '@/components/owner/assign-sheet';
import { StatusChip } from '@/components/owner/status-chip';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState, LoadingScreen } from '@/components/ui/feedback';
import { Radius, Spacing } from '@/constants/theme';
import {
  useCollectCash,
  useOwnerBooking,
  useTechnicians,
  useUpdateBooking,

} from '@/hooks/use-owner';
import { useTheme } from '@/hooks/use-theme';
import { BOOKING_TIMELINE_STATUSES, STATUS_LABELS } from '@/lib/booking-status';
import { nextAction, statusTone } from '@/lib/owner-board';

const PRICE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const WHEN = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

export default function OwnerJobScreen() {
  const theme = useTheme();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { data: job, isLoading, isError, error, refetch } = useOwnerBooking(bookingId);
  const { data: technicians } = useTechnicians();
  const update = useUpdateBooking();
  const collect = useCollectCash();

  const [assigning, setAssigning] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (isLoading) return <LoadingScreen />;

  if (isError || !job) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centre} edges={['left', 'right', 'bottom']}>
          <ErrorState
            message={isError ? (error as Error).message : 'That job could not be found.'}
            onRetry={() => refetch()}
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  const action = nextAction(job);
  const customer = job.contact_name || job.profiles?.name || 'Unnamed customer';
  const phone = job.contact_phone || job.profiles?.phone || null;
  const attrs = job.customer_assets?.attributes ?? {};
  const vehicle = [attrs.make, attrs.model, attrs.vehicle_size].filter(Boolean).join(' ');
  const address = [job.service_address, job.service_city].filter(Boolean).join(', ');
  const settled = (job.payments ?? []).some((p) => p.status === 'paid');
  const busy = update.isPending || collect.isPending;

  async function run(fn: () => Promise<unknown>) {
    setProblem(null);
    try {
      await fn();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'That did not work.');
    }
  }

  const ACTION_LABELS: Record<string, string> = {
    assign: 'Assign a technician',
    start: 'Start job',
    complete: 'Mark complete',
    collect: `Collect ${PRICE.format(job.net_price)}`,
  };

  function onPrimary() {
    if (!job) return;
    if (action === 'assign') {
      setAssigning(true);
      return;
    }
    if (action === 'start') {
      void run(() => update.mutateAsync({ bookingId: job.id, status: 'in_progress' }));
      return;
    }
    if (action === 'complete') {
      void run(() => update.mutateAsync({ bookingId: job.id, status: 'completed' }));
      return;
    }
    if (action === 'collect') {
      void run(() => collect.mutateAsync(job.id));
    }
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: job.services?.name ?? 'Job', headerBackTitle: 'Back' }} />
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.head}>
            <StatusChip tone={statusTone(job)} />
            <ThemedText type="title">{job.services?.name ?? 'Service'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {WHEN.format(new Date(job.scheduled_at))}
            </ThemedText>
          </View>

          <Timeline status={job.status} />

          <Card style={styles.card}>
            <Row label="Customer" value={customer} />
            {phone ? (
              <Pressable
                onPress={() => Linking.openURL(`tel:${phone.replace(/\s/g, '')}`)}
                accessibilityRole="button"
                accessibilityLabel={`Call ${customer}`}
              >
                <Row label="Phone" value={phone} accent />
              </Pressable>
            ) : null}
            {vehicle ? <Row label="Vehicle" value={vehicle} /> : null}
            {address ? (
              <Row label={job.needs_pickup ? 'Collect from' : 'At'} value={address} />
            ) : null}
            {job.needs_pickup ? <Row label="Pickup" value="Requested" accent /> : null}
          </Card>

          <Card style={styles.card}>
            <Row label="Technician" value={job.technicians?.name ?? 'Nobody yet'} />
            <Pressable
              onPress={() => setAssigning(true)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.link, { opacity: pressed ? 0.7 : 1 }]}
            >
              <ThemedText type="small" themeColor="primary">
                {job.technician_id ? 'Change technician' : 'Assign someone'}
              </ThemedText>
            </Pressable>
          </Card>

          <Card style={styles.card}>
            {job.discount_amount + job.promo_discount_amount > 0 && (
              <>
                <Row label="Service" value={PRICE.format(job.total_price)} />
                {job.promo_discount_amount > 0 && (
                  <Row label="Promo code" value={`− ${PRICE.format(job.promo_discount_amount)}`} />
                )}
                {job.discount_amount > 0 && (
                  <Row label="Discount" value={`− ${PRICE.format(job.discount_amount)}`} />
                )}
              </>
            )}
            <Row label="Total" value={PRICE.format(job.net_price)} strong />
            <Row
              label="Payment"
              value={
                job.payment_method === 'cod'
                  ? settled
                    ? 'Cash — collected'
                    : 'Cash on delivery — not collected'
                  : settled
                    ? 'Paid online'
                    : 'Online — not settled'
              }
              accent={job.payment_method === 'cod' && !settled}
            />
          </Card>

          {problem && (
            <View style={styles.body}>
              <ThemedText type="small" themeColor="error">
                {problem}
              </ThemedText>
            </View>
          )}
        </ScrollView>

        {action && (
          <View
            style={[
              styles.footer,
              { backgroundColor: theme.surface, borderTopColor: theme.border },
            ]}
          >
            <Button
              label={busy ? 'Working…' : ACTION_LABELS[action]}
              loading={busy}
              onPress={onPrimary}
            />
          </View>
        )}

        <AssignSheet
          visible={assigning}
          technicians={technicians ?? []}
          currentTechnicianId={job.technician_id}
          jobLine={`${job.services?.name ?? 'Service'} · ${customer}`}
          busy={update.isPending}
          onClose={() => setAssigning(false)}
          onAssign={(technicianId) =>
            void run(async () => {
              // Assigning also moves the job out of "confirmed" — the two are
              // one decision, and leaving the status behind would put the job
              // back in the unassigned queue it just left.
              await update.mutateAsync({ bookingId: job.id, technicianId, status: 'assigned' });
              setAssigning(false);
            })
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function Timeline({ status }: { status: string }) {
  const theme = useTheme();
  const at = BOOKING_TIMELINE_STATUSES.indexOf(status as (typeof BOOKING_TIMELINE_STATUSES)[number]);

  // A cancelled job has no place on this line; showing it part-way along would
  // imply work still to come.
  if (at === -1) return null;

  return (
    <View style={styles.timeline}>
      {BOOKING_TIMELINE_STATUSES.map((s, i) => {
        const done = i <= at;
        return (
          <View key={s} style={styles.step}>
            <View
              style={[
                styles.dot,
                { backgroundColor: done ? theme.primary : theme.border },
              ]}
            />
            <ThemedText
              type="caption"
              themeColor={done ? 'text' : 'textMuted'}
              numberOfLines={1}
              style={styles.stepLabel}
            >
              {STATUS_LABELS[s] ?? s}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

function Row({
  label,
  value,
  accent,
  strong,
}: {
  label: string;
  value: string;
  accent?: boolean;
  strong?: boolean;
}) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText
        type={strong ? 'smallBold' : 'small'}
        themeColor={accent ? 'primary' : 'text'}
        numberOfLines={2}
        style={styles.rowValue}
      >
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  centre: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.four },
  scroll: { paddingBottom: Spacing.six, gap: Spacing.three },
  head: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: Spacing.one },
  body: { paddingHorizontal: Spacing.four },
  timeline: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.four,
    gap: Spacing.one,
  },
  step: { flex: 1, gap: Spacing.one },
  dot: { height: 4, borderRadius: Radius.full },
  stepLabel: { fontSize: 10 },
  card: { marginHorizontal: Spacing.four, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.three },
  rowValue: { flex: 1, textAlign: 'right' },
  link: { paddingTop: Spacing.one },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

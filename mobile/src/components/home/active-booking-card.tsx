import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Elevation, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useMyBookings } from '@/hooks/use-booking';
import { useTheme } from '@/hooks/use-theme';
import { STATUS_LABELS } from '@/lib/booking-status';
import { formatWhen, pickActiveBooking } from '@/lib/home-screen';

/**
 * The customer's live booking, at the top of the home screen.
 *
 * If a car is with the shop, that is the only thing the customer cares about,
 * and until now they had to switch tabs to find it. Renders nothing when there
 * is no live job, so the screen stays clean for someone just browsing.
 */
export function ActiveBookingCard() {
  const theme = useTheme();
  const { user } = useAuth();
  const { data: bookings } = useMyBookings(user?.id);

  const booking = pickActiveBooking(bookings);
  if (!booking) return null;

  const isLive = booking.status === 'in_progress';
  const technician = booking.technicians?.name;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() =>
          router.push({
            pathname: '/(app)/bookings/[bookingId]',
            params: { bookingId: booking.id },
          })
        }
        accessibilityRole="button"
        accessibilityLabel={`${booking.services?.name ?? 'Your booking'}, ${
          STATUS_LABELS[booking.status] ?? booking.status
        }, ${formatWhen(booking.scheduled_at)}`}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: theme.primarySoft,
            borderColor: theme.primary,
            opacity: pressed ? 0.9 : 1,
          },
          Elevation.raised,
        ]}
      >
        <View style={styles.head}>
          <View style={styles.statusRow}>
            {/* A filled dot only while the work is actually happening — it is
                the one state worth drawing the eye to. */}
            {isLive && <View style={[styles.dot, { backgroundColor: theme.primary }]} />}
            <ThemedText type="label" themeColor="primary">
              {STATUS_LABELS[booking.status] ?? booking.status}
            </ThemedText>
          </View>
          <ThemedText type="body" themeColor="primary">
            ›
          </ThemedText>
        </View>

        <ThemedText type="heading" numberOfLines={1}>
          {booking.services?.name ?? 'Your booking'}
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary">
          {formatWhen(booking.scheduled_at)}
          {technician ? ` · ${technician}` : ''}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  dot: { width: 7, height: 7, borderRadius: Radius.full },
});

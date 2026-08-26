import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The booking flow in order. Named here rather than in each screen so the
 * count and the wording cannot drift apart as steps are added.
 */
export const BOOKING_STEPS = ['Vehicle', 'Address', 'Time', 'Payment'] as const;
export type BookingStep = (typeof BOOKING_STEPS)[number];

/**
 * Where the customer is in the booking flow.
 *
 * Four screens deep with nothing but a header title gives no sense of how much
 * is left, and an unknown remaining length is what makes people abandon a
 * checkout. Segments rather than a single bar so each completed step reads as
 * banked, not merely as a percentage.
 */
export function BookingSteps({ current }: { current: BookingStep }) {
  const theme = useTheme();
  const index = BOOKING_STEPS.indexOf(current);

  return (
    <View
      style={styles.wrap}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: BOOKING_STEPS.length, now: index + 1 }}
      accessibilityLabel={`Step ${index + 1} of ${BOOKING_STEPS.length}: ${current}`}
    >
      <View style={styles.track}>
        {BOOKING_STEPS.map((step, i) => (
          <View
            key={step}
            style={[
              styles.segment,
              {
                backgroundColor: i <= index ? theme.primary : theme.border,
                // The current step is full height; done steps stay slimmer so
                // "where I am" reads before "how far I've come".
                height: i === index ? 4 : 3,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.labels}>
        <ThemedText type="caption" themeColor="primary">
          Step {index + 1} of {BOOKING_STEPS.length}
        </ThemedText>
        {index < BOOKING_STEPS.length - 1 && (
          <ThemedText type="caption" themeColor="textMuted">
            Next: {BOOKING_STEPS[index + 1]}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.one,
  },
  track: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  segment: { flex: 1, borderRadius: Radius.full },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
});

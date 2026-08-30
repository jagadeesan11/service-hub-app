import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { TONE_LABELS, type StatusTone } from '@/lib/owner-board';

/**
 * How a job reads at a glance.
 *
 * Colour is not the only signal — each tone also carries its own words, so the
 * board still works for anyone who cannot separate the reds from the greens,
 * and in the sunlight of an actual workshop.
 */
export function StatusChip({ tone, label }: { tone: StatusTone; label?: string }) {
  const theme = useTheme();

  const palette: Record<StatusTone, { fg: string; bg: string }> = {
    unassigned: { fg: theme.error, bg: theme.errorSoft },
    assigned: { fg: theme.primary, bg: theme.primarySoft },
    working: { fg: theme.warning, bg: theme.warningSoft },
    cashDue: { fg: theme.error, bg: theme.errorSoft },
    done: { fg: theme.success, bg: theme.successSoft },
    cancelled: { fg: theme.textMuted, bg: theme.surfaceSunk },
  };

  const { fg, bg } = palette[tone];

  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <ThemedText type="caption" style={{ color: fg }}>
        {label ?? TONE_LABELS[tone]}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
});

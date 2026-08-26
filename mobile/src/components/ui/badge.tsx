import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type BadgeTone = 'neutral' | 'primary' | 'warning' | 'error';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const theme = useTheme();

  const tones: Record<BadgeTone, { bg: string; fg: string }> = {
    neutral: { bg: theme.surfaceSunk, fg: theme.textSecondary },
    primary: { bg: theme.primarySoft, fg: theme.primary },
    warning: { bg: theme.warningSoft, fg: theme.warning },
    error: { bg: theme.errorSoft, fg: theme.error },
  };
  const { bg, fg } = tones[tone];

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <ThemedText type="caption" style={{ color: fg }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
});

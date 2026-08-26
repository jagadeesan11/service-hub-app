import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Grey blocks standing in for content while it loads. Calmer than a spinner
 *  because the layout doesn't jump when the real content arrives. */
export function Skeleton({ height, width = '100%', radius = Radius.md }: {
  height: number;
  width?: number | `${number}%`;
  radius?: number;
}) {
  const theme = useTheme();
  return (
    <View style={{ height, width, borderRadius: radius, backgroundColor: theme.surfaceSunk }} />
  );
}

export function SkeletonList({ count = 3, height = 84 }: { count?: number; height?: number }) {
  return (
    <View style={styles.stack}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} height={height} radius={Radius.lg} />
      ))}
    </View>
  );
}

export function LoadingScreen() {
  const theme = useTheme();
  return (
    <View style={styles.centre}>
      <ActivityIndicator color={theme.primary} />
    </View>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.empty, { borderColor: theme.border }]}>
      <ThemedText type="bodyMedium" style={styles.centreText}>
        {title}
      </ThemedText>
      {description && (
        <ThemedText type="small" themeColor="textMuted" style={styles.centreText}>
          {description}
        </ThemedText>
      )}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.error, { backgroundColor: theme.errorSoft }]}>
      <ThemedText type="small" themeColor="error">
        {message}
      </ThemedText>
      {onRetry && (
        <Button label="Try again" variant="ghost" size="md" fullWidth={false} onPress={onRetry} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.three },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centreText: { textAlign: 'center' },
  empty: {
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
  },
  error: {
    gap: Spacing.two,
    borderRadius: Radius.md,
    padding: Spacing.three,
    alignItems: 'flex-start',
  },
});

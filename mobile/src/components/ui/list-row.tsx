import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** A grouped list, iOS-settings style: one card, hairline-separated rows. */
export function ListGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  const theme = useTheme();

  return (
    <View style={styles.group}>
      {title && (
        <ThemedText type="label" themeColor="textMuted" style={styles.groupTitle}>
          {title}
        </ThemedText>
      )}
      <View
        style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        {children}
      </View>
    </View>
  );
}

export function ListRow({
  label,
  value,
  onPress,
  destructive,
  first,
}: {
  label: string;
  value?: string | null;
  onPress?: () => void;
  destructive?: boolean;
  /** Suppresses the separator on the first row of a group. */
  first?: boolean;
}) {
  const theme = useTheme();

  const content = (
    <>
      <ThemedText
        type="body"
        style={styles.label}
        themeColor={destructive ? 'error' : 'text'}
      >
        {label}
      </ThemedText>

      {value !== undefined && (
        <ThemedText
          type="small"
          themeColor={value ? 'textSecondary' : 'textMuted'}
          numberOfLines={1}
          style={styles.value}
        >
          {value || 'Not set'}
        </ThemedText>
      )}

      {onPress && (
        <ThemedText type="body" themeColor="textMuted">
          ›
        </ThemedText>
      )}
    </>
  );

  const rowStyle = [
    styles.row,
    !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
  ];

  if (!onPress) return <View style={rowStyle}>{content}</View>;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [...rowStyle, pressed && { backgroundColor: theme.surfaceSunk }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  groupTitle: { paddingHorizontal: Spacing.one },
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    minHeight: 52,
  },
  label: { flexShrink: 0 },
  value: { flex: 1, textAlign: 'right' },
});

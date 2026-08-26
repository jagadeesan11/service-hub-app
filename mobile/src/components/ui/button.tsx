import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled,
  loading,
  fullWidth = true,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: theme.primary, fg: theme.primaryText },
    secondary: { bg: theme.surfaceSunk, fg: theme.text, border: theme.border },
    ghost: { bg: 'transparent', fg: theme.primary },
    danger: { bg: theme.errorSoft, fg: theme.error },
  };
  const { bg, fg, border } = palette[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        {
          backgroundColor: bg,
          borderColor: border ?? 'transparent',
          borderWidth: border ? StyleSheet.hairlineWidth : 0,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          // A pressed state that reads on both themes without a second colour.
          opacity: isDisabled ? 0.5 : pressed ? 0.82 : 1,
        },
        style,
      ]}
    >
      {loading && <ActivityIndicator size="small" color={fg} style={styles.spinner} />}
      <ThemedText type="bodyMedium" style={{ color: fg }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
  },
  lg: { paddingVertical: 15, paddingHorizontal: Spacing.four },
  md: { paddingVertical: 10, paddingHorizontal: Spacing.three },
  spinner: { marginRight: 2 },
});

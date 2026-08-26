import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A labelled text input with error state. The auth screens alone need six of
 * these, and hand-rolling the themed borders each time is how they drift.
 */
export const TextField = forwardRef<TextInput, TextInputProps & { label: string; error?: string | null; hint?: string }>(
  function TextField({ label, error, hint, style, ...props }, ref) {
    const theme = useTheme();

    return (
      <View style={styles.wrap}>
        <ThemedText type="label" themeColor="textSecondary">
          {label}
        </ThemedText>

        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={theme.textMuted}
          style={[
            styles.input,
            {
              color: theme.text,
              backgroundColor: theme.surface,
              borderColor: error ? theme.error : theme.border,
            },
            style,
          ]}
          {...props}
        />

        {error ? (
          <ThemedText type="small" themeColor="error">
            {error}
          </ThemedText>
        ) : hint ? (
          <ThemedText type="small" themeColor="textMuted">
            {hint}
          </ThemedText>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 17,
  },
});

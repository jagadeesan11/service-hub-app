import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface Choice<T extends string> {
  value: T;
  label: string;
}

export function ChoiceGroup<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly Choice<T>[];
  value: T | null;
  onChange: (value: T) => void;
  label?: string;
}) {
  const theme = useTheme();

  return (
    <View
      style={styles.group}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            aria-checked={selected}
            accessibilityLabel={option.label}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: selected ? theme.primary : theme.surface,
                borderColor: selected ? theme.primary : theme.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <ThemedText type="small" themeColor={selected ? 'primaryText' : 'text'}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});

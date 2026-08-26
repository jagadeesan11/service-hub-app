import { Pressable, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

import { Elevation, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface CardProps extends ViewProps {
  onPress?: () => void;
  padded?: boolean;
  style?: ViewStyle | ViewStyle[];
}

export function Card({ children, onPress, padded = true, style, ...rest }: CardProps) {
  const theme = useTheme();

  const base: ViewStyle = {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    ...(padded ? { padding: Spacing.three } : null),
    ...(Elevation.card as ViewStyle),
  };

  if (!onPress) {
    return (
      <View style={[base, style]} {...rest}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [base, pressed && { opacity: 0.85 }, style]}
    >
      {children}
    </Pressable>
  );
}

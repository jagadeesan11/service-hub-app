import { StyleSheet, Text, type TextProps } from 'react-native';

import { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'bodyMedium'
  | 'small'
  | 'smallBold'
  | 'caption'
  | 'label'
  | 'price'
  /** Retained so screens not yet migrated keep compiling. */
  | 'default'
  | 'subtitle'
  | 'link'
  | 'code';

export type ThemedTextProps = TextProps & {
  type?: TextVariant;
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'body', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[{ color: theme[themeColor ?? 'text'] }, styles[type], style]}
      {...rest}
    />
  );
}

// A restrained scale: each step is distinguishable at arm's length without
// the 48px-to-16px cliff the template shipped with.
const styles = StyleSheet.create({
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.5 },
  title: { fontSize: 25, lineHeight: 31, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 19, lineHeight: 25, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyMedium: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  small: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  smallBold: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  label: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase' },
  price: { fontSize: 17, lineHeight: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // Legacy aliases.
  default: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  subtitle: { fontSize: 25, lineHeight: 31, fontWeight: '700', letterSpacing: -0.3 },
  link: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  code: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
});

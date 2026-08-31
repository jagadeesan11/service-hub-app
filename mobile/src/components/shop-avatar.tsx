import { Image, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useAppSettings } from '@/hooks/use-app-settings';
import { useTheme } from '@/hooks/use-theme';
import { initialsOf } from '@/lib/team';

/**
 * The shop's mark: its logo when one is configured, its initials when not.
 *
 * The logo is a setting rather than a bundled asset, so the same binary can
 * run a second shop without a release. That also means it can be absent, or
 * fail to load on a bad connection — hence the initials underneath rather than
 * an empty square. `onError` falls back at runtime too, because a URL that
 * once worked can stop working.
 */
export function ShopAvatar({ size = 40, style }: { size?: number; style?: ViewStyle }) {
  const theme = useTheme();
  const { settings } = useAppSettings();

  const url = settings.shop_logo_url;
  const box = {
    width: size,
    height: size,
    borderRadius: Radius.full,
  };

  if (url) {
    return (
      <View style={[box, styles.frame, { backgroundColor: theme.surfaceSunk }, style]}>
        <Image
          source={{ uri: url }}
          style={box}
          resizeMode="cover"
          accessibilityLabel={settings.shop_name}
        />
      </View>
    );
  }

  return (
    <View style={[box, styles.frame, { backgroundColor: theme.primary }, style]}>
      <ThemedText type="smallBold" style={{ color: theme.primaryText }}>
        {initialsOf(settings.shop_name)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});

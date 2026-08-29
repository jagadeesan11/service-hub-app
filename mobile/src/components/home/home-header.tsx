import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useAppSettings } from '@/hooks/use-app-settings';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { firstNameOf, greetingFor } from '@/lib/home-screen';

/**
 * Brand, then person, then task.
 *
 * The screen previously opened on "What do you need today?" and never said
 * whose shop it was. The name comes from app_settings rather than a constant,
 * so it stays right for whoever is running the app — and the greeting uses the
 * customer's own name, which is the cheapest way to make a catalogue screen
 * feel like somewhere they have an account.
 */
export function HomeHeader() {
  const theme = useTheme();
  const { settings } = useAppSettings();
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);

  const firstName = firstNameOf(profile?.name);
  const greeting = greetingFor();

  return (
    <View style={styles.wrap}>
      <View style={styles.brand}>
        <Image
          source={require('@/assets/images/icon.png')}
          style={styles.mark}
          contentFit="cover"
        />
        <ThemedText type="bodyMedium" numberOfLines={1} style={styles.shopName}>
          {settings.shop_name}
        </ThemedText>
      </View>

      <View style={styles.copy}>
        {/* Falls back to the greeting alone rather than "Good evening, there".
            A customer who skipped onboarding has no name, and a placeholder
            reads worse than simply not using one. */}
        <ThemedText type="display" style={styles.greeting}>
          {firstName ? `${greeting}, ${firstName}` : greeting}
        </ThemedText>
        <ThemedText type="body" themeColor="textSecondary">
          What do you need today?
        </ThemedText>
      </View>

      <View style={[styles.rule, { backgroundColor: theme.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  mark: { width: 30, height: 30, borderRadius: Radius.sm },
  shopName: { flex: 1 },
  copy: { gap: Spacing.one },
  greeting: { maxWidth: 320 },
  rule: { height: StyleSheet.hairlineWidth, marginTop: Spacing.one },
});

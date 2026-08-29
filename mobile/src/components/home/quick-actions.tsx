import { router } from 'expo-router';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { CalendarIcon, ChatIcon, HelpIcon, PhoneIcon } from '@/components/home/action-icons';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useAppSettings } from '@/hooks/use-app-settings';
import { useTheme } from '@/hooks/use-theme';
import { whatsappUrl } from '@/lib/social-links';

type Action = {
  key: string;
  label: string;
  Icon: (props: { size?: number; color: string }) => React.ReactElement;
  onPress: () => void;
};

/**
 * Three taps a customer reaches for most, above the catalogue.
 *
 * Which contact channels appear depends on what the shop has configured, so
 * the row never offers a WhatsApp that goes nowhere. Capped at three: a fourth
 * makes each tile too narrow for its label on a 375px screen, and the value
 * here is that they are all reachable without thinking.
 */
export function QuickActions() {
  const theme = useTheme();
  const { settings } = useAppSettings();

  const whatsapp = whatsappUrl(settings.whatsapp_number);

  const actions: Action[] = [
    {
      key: 'bookings',
      label: 'My bookings',
      Icon: CalendarIcon,
      onPress: () => router.push('/(app)/bookings'),
    },
    ...(whatsapp
      ? [
          {
            key: 'whatsapp',
            label: 'WhatsApp',
            Icon: ChatIcon,
            onPress: () => Linking.openURL(whatsapp),
          },
        ]
      : []),
    ...(settings.support_phone
      ? [
          {
            key: 'call',
            label: 'Call us',
            Icon: PhoneIcon,
            onPress: () => Linking.openURL(`tel:${settings.support_phone!.replace(/\s/g, '')}`),
          },
        ]
      : []),
    {
      key: 'help',
      label: 'Help',
      Icon: HelpIcon,
      onPress: () => router.push('/settings/help'),
    },
  ].slice(0, 3);

  return (
    <View style={styles.row}>
      {actions.map(({ key, label, Icon, onPress }) => (
        <Pressable
          key={key}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={({ pressed }) => [
            styles.tile,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View style={[styles.badge, { backgroundColor: theme.primarySoft }]}>
            <Icon size={19} color={theme.primary} />
          </View>
          <ThemedText type="caption" numberOfLines={1}>
            {label}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

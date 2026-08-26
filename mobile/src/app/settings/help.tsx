import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { ListGroup, ListRow } from '@/components/ui/list-row';
import { FAQ } from '@/constants/links';
import { Spacing } from '@/constants/theme';
import { formatShopAddress, useAppSettings } from '@/hooks/use-app-settings';
import { instagramHandle, whatsappUrl } from '@/lib/social-links';

export default function HelpCentreScreen() {
  // Contact details come from the admin panel, so a changed number reaches
  // customers without a store release.
  const { settings } = useAppSettings();
  const address = formatShopAddress(settings);
  const whatsapp = whatsappUrl(settings.whatsapp_number);
  const instagram = instagramHandle(settings.instagram_url);

  // Built as a list rather than a chain of conditional rows: with five
  // optional channels, `first={!a && !b && !c && !d}` is a bug waiting to
  // happen, and whichever ones the shop has filled in should just close up.
  const channels: { label: string; value: string; url: string }[] = [
    settings.support_email && {
      label: 'Email us',
      value: settings.support_email,
      url: `mailto:${settings.support_email}`,
    },
    settings.support_phone && {
      label: 'Call us',
      value: settings.support_phone,
      url: `tel:${settings.support_phone.replace(/\s/g, '')}`,
    },
    whatsapp && {
      label: 'WhatsApp',
      value: settings.whatsapp_number ?? 'Message us',
      url: whatsapp,
    },
    instagram &&
      settings.instagram_url && {
        label: 'Instagram',
        value: instagram,
        url: settings.instagram_url,
      },
    address && {
      label: 'Visit us',
      value: address,
      url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
    },
  ].filter((c): c is { label: string; value: string; url: string } => Boolean(c));

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <ListGroup title={`Get in touch with ${settings.shop_name}`}>
            {channels.map((channel, index) => (
              <ListRow
                key={channel.label}
                first={index === 0}
                label={channel.label}
                value={channel.value}
                onPress={() => Linking.openURL(channel.url)}
              />
            ))}
          </ListGroup>

          <View style={styles.faq}>
            <ThemedText type="label" themeColor="textMuted">
              Common questions
            </ThemedText>

            {FAQ.map((item) => (
              <Card key={item.question} style={styles.faqCard}>
                <ThemedText type="bodyMedium">{item.question}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.answer}
                </ThemedText>
              </Card>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  faq: { gap: Spacing.two },
  faqCard: { gap: Spacing.one },
});

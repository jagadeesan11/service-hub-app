import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { ListGroup, ListRow } from '@/components/ui/list-row';
import { FAQ } from '@/constants/links';
import { Spacing } from '@/constants/theme';
import { formatShopAddress, useAppSettings } from '@/hooks/use-app-settings';

export default function HelpCentreScreen() {
  // Contact details come from the admin panel, so a changed number reaches
  // customers without a store release.
  const { settings } = useAppSettings();
  const address = formatShopAddress(settings);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <ListGroup title={`Get in touch with ${settings.shop_name}`}>
            {settings.support_email ? (
              <ListRow
                first
                label="Email us"
                value={settings.support_email}
                onPress={() => Linking.openURL(`mailto:${settings.support_email}`)}
              />
            ) : null}
            {settings.support_phone ? (
              <ListRow
                first={!settings.support_email}
                label="Call us"
                value={settings.support_phone}
                onPress={() =>
                  Linking.openURL(`tel:${settings.support_phone!.replace(/\s/g, '')}`)
                }
              />
            ) : null}
            {address ? (
              <ListRow
                first={!settings.support_email && !settings.support_phone}
                label="Visit us"
                value={address}
                onPress={() =>
                  Linking.openURL(
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
                  )
                }
              />
            ) : null}
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

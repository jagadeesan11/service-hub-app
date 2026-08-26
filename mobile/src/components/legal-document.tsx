import { Linking, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingScreen } from '@/components/ui/feedback';
import { Spacing } from '@/constants/theme';
import { useAppSettings } from '@/hooks/use-app-settings';

/**
 * Renders a legal document by opening its published URL, which the admin sets
 * in Settings — the URL depends on where the business hosts the document, so
 * it cannot be known at build time.
 *
 * When no URL is configured the screen says so plainly rather than showing
 * invented terms. Placeholder legal copy that looks real is worse than an
 * honest gap: customers rely on it and it is not true.
 */
export function LegalDocument({
  title,
  urlKey,
}: {
  title: string;
  urlKey: 'privacy_url' | 'terms_url';
}) {
  const { settings, isLoading } = useAppSettings();
  const url = settings[urlKey];
  const contact = settings.support_email;

  if (isLoading) return <LoadingScreen />;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        {url ? (
          <View style={styles.body}>
            <ThemedText type="body" themeColor="textSecondary">
              Read the current {title.toLowerCase()} on our website.
            </ThemedText>
            <Button label={`Open ${title.toLowerCase()}`} onPress={() => Linking.openURL(url)} />
          </View>
        ) : (
          <View style={styles.body}>
            <EmptyState
              title={`${title} not published yet`}
              description={
                contact
                  ? `We're preparing this document. In the meantime, contact ${contact} with any questions.`
                  : "We're preparing this document. Get in touch from the Help centre with any questions."
              }
            />
            {contact ? (
              <Button
                label="Email us"
                variant="secondary"
                onPress={() => Linking.openURL(`mailto:${contact}`)}
              />
            ) : null}
          </View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
});

import { Image } from 'expo-image';
import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';

/**
 * The frame every auth screen shares: brand mark, a title, a line of copy,
 * and a form that stays visible above the keyboard.
 *
 * Scrollable because sign-up has five fields and a phone keyboard covers half
 * the screen — without it the password fields are unreachable on a small
 * handset.
 */
export function AuthScreen({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title: string; subtitle: string }>) {
  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.brand}>
              <Image
                source={require('@/assets/images/icon.png')}
                style={styles.mark}
                contentFit="cover"
              />
            </View>

            <View style={styles.copy}>
              <ThemedText type="display">{title}</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                {subtitle}
              </ThemedText>
            </View>

            <View style={styles.form}>{children}</View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    gap: Spacing.four,
  },
  brand: { alignItems: 'flex-start' },
  mark: { width: 56, height: 56, borderRadius: Radius.lg },
  copy: { gap: Spacing.two },
  form: { gap: Spacing.three },
});

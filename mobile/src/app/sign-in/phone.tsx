import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Radius, Spacing } from '@/constants/theme';
import { useAppSettings } from '@/hooks/use-app-settings';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

function isValidPhone(phone: string) {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

export default function PhoneEntryScreen() {
  const theme = useTheme();
  // app_settings is readable without a session, so the shop name is right
  // even on the very first screen.
  const { settings } = useAppSettings();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!isValidPhone(phone)) {
      setError('Enter your number with the country code, like +91 98765 43210.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone });
    setIsSubmitting(false);

    if (otpError) {
      setError(otpError.message);
      return;
    }

    router.push({ pathname: '/sign-in/verify', params: { phone } });
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.brand}>
            <Image
              source={require('@/assets/images/icon.png')}
              style={styles.mark}
              contentFit="cover"
            />
          </View>

          <View style={styles.copy}>
            <ThemedText type="display">Sign in or sign up</ThemedText>
            {/* There is deliberately no separate sign-up button: one number
                either signs you in or creates the account. Saying so removes
                the "where do I register?" hesitation that a single
                sign-in-only screen otherwise causes. */}
            <ThemedText type="body" themeColor="textSecondary">
              Enter your phone number and we&apos;ll text you a code. New to {settings.shop_name}? This creates
              your account — there&apos;s nothing else to fill in first.
            </ThemedText>
          </View>

          <View style={styles.form}>
            <TextInput
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                if (error) setError(null);
              }}
              placeholder="+91 98765 43210"
              placeholderTextColor={theme.textMuted}
              keyboardType="phone-pad"
              autoComplete="tel"
              autoFocus
              accessibilityLabel="Phone number"
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.surface,
                  borderColor: error ? theme.error : theme.border,
                },
              ]}
            />

            {error && (
              <ThemedText type="small" themeColor="error">
                {error}
              </ThemedText>
            )}

            <Button
              label="Send code"
              loading={isSubmitting}
              onPress={handleSubmit}
              style={styles.cta}
            />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  brand: { alignItems: 'flex-start' },
  mark: { width: 56, height: 56, borderRadius: Radius.lg },
  copy: { gap: Spacing.two },
  form: { gap: Spacing.three },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 18,
  },
  cta: { marginTop: Spacing.one },
});

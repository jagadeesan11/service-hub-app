import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export default function VerifyOtpScreen() {
  const theme = useTheme();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  async function handleVerify() {
    if (token.length < 6) {
      setError('Enter the 6-digit code we sent you.');
      return;
    }

    setError(null);
    setNotice(null);
    setIsSubmitting(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    setIsSubmitting(false);

    if (verifyError) setError(verifyError.message);
    // On success the root layout's guard swaps to the authenticated stack.
  }

  async function handleResend() {
    setIsResending(true);
    setError(null);
    setNotice(null);
    const { error: resendError } = await supabase.auth.signInWithOtp({ phone });
    setIsResending(false);

    if (resendError) setError(resendError.message);
    else setNotice('We sent a new code.');
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.copy}>
            <ThemedText type="display">Enter your code</ThemedText>
            <ThemedText type="body" themeColor="textSecondary">
              We sent a 6-digit code to {phone}.
            </ThemedText>
          </View>

          <View style={styles.form}>
            <TextInput
              value={token}
              onChangeText={(text) => {
                setToken(text.replace(/[^0-9]/g, ''));
                if (error) setError(null);
              }}
              placeholder="000000"
              placeholderTextColor={theme.textMuted}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              accessibilityLabel="Verification code"
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
            {notice && (
              <ThemedText type="small" themeColor="primary">
                {notice}
              </ThemedText>
            )}

            <Button label="Verify" loading={isSubmitting} onPress={handleVerify} />

            <View style={styles.links}>
              <Pressable onPress={handleResend} disabled={isResending} accessibilityRole="button">
                <ThemedText type="smallBold" themeColor="primary">
                  {isResending ? 'Sending…' : 'Resend code'}
                </ThemedText>
              </Pressable>

              <Pressable onPress={() => router.back()} accessibilityRole="button">
                <ThemedText type="smallBold" themeColor="textMuted">
                  Change number
                </ThemedText>
              </Pressable>
            </View>
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
    gap: Spacing.five,
  },
  copy: { gap: Spacing.two },
  form: { gap: Spacing.three },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 28,
    letterSpacing: 10,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
});

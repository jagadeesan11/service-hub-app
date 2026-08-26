import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useAppSettings } from '@/hooks/use-app-settings';
import { parseIdentifier, readableAuthError } from '@/lib/auth-identifier';
import { supabase } from '@/lib/supabase';

export default function SignInScreen() {
  // app_settings is readable without a session, so the shop name is right
  // even on the very first screen.
  const { settings } = useAppSettings();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    const parsed = parseIdentifier(identifier);
    if (parsed.kind === 'invalid') {
      setError('Enter the phone number or email address you signed up with.');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword(
      parsed.kind === 'email' ? { email: parsed.email, password } : { phone: parsed.phone, password },
    );
    setIsSubmitting(false);

    // No navigation on success: the root layout's guard swaps the stack the
    // moment the session lands, so pushing here would fight it.
    if (signInError) setError(readableAuthError(signInError));
  }

  return (
    <AuthScreen
      title="Sign in"
      subtitle={`Welcome back to ${settings.shop_name}. Use the phone number or email you signed up with.`}
    >
      <TextField
        label="Phone or email"
        value={identifier}
        onChangeText={(text) => {
          setIdentifier(text);
          if (error) setError(null);
        }}
        placeholder="98765 43210 or you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        autoFocus
      />

      <TextField
        label="Password"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          if (error) setError(null);
        }}
        placeholder="Your password"
        secureTextEntry={!reveal}
        autoCapitalize="none"
        autoComplete="current-password"
        onSubmitEditing={handleSubmit}
        returnKeyType="go"
      />

      <View style={styles.row}>
        <Pressable onPress={() => setReveal((v) => !v)} accessibilityRole="button" hitSlop={8}>
          <ThemedText type="small" themeColor="textSecondary">
            {reveal ? 'Hide password' : 'Show password'}
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => router.push('/sign-in/help')}
          accessibilityRole="link"
          hitSlop={8}
        >
          <ThemedText type="small" themeColor="primary">
            Trouble signing in?
          </ThemedText>
        </Pressable>
      </View>

      {error && (
        <ThemedText type="small" themeColor="error">
          {error}
        </ThemedText>
      )}

      <Button label="Sign in" loading={isSubmitting} onPress={handleSubmit} />

      <View style={styles.footer}>
        <ThemedText type="small" themeColor="textSecondary">
          New here?
        </ThemedText>
        <Pressable onPress={() => router.push('/sign-in/sign-up')} accessibilityRole="link" hitSlop={8}>
          <ThemedText type="smallBold" themeColor="primary">
            Create an account
          </ThemedText>
        </Pressable>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
});

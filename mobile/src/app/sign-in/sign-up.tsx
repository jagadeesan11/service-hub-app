import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useAppSettings } from '@/hooks/use-app-settings';
import { parseIdentifier, readableAuthError } from '@/lib/auth-identifier';
import { supabase } from '@/lib/supabase';

const MIN_PASSWORD = 8;

export default function SignUpScreen() {
  const { settings } = useAppSettings();
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    const parsed = parseIdentifier(identifier);
    if (parsed.kind === 'invalid') {
      setError('Enter a phone number or an email address we can reach you on.');
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Choose a password of at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('Those two passwords don\u2019t match.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const credentials =
      parsed.kind === 'email' ? { email: parsed.email, password } : { phone: parsed.phone, password };
    // The name rides along in user metadata; handle_new_user() copies it into
    // the profile, so onboarding doesn't ask for what was just typed.
    const { data, error: signUpError } = await supabase.auth.signUp({
      ...credentials,
      options: { data: { name: name.trim() } },
    });
    setIsSubmitting(false);

    if (signUpError) {
      setError(readableAuthError(signUpError));
      return;
    }

    // A session means confirmation is off and they are already signed in —
    // the root guard takes over from here. A null session means Supabase is
    // waiting for them to confirm, which has to be said out loud or the screen
    // just appears to do nothing.
    if (!data.session) {
      setPendingConfirmation(
        parsed.kind === 'email'
          ? `We\u2019ve sent a confirmation link to ${parsed.email}. Open it, then sign in.`
          : `We\u2019ve sent a confirmation code to ${parsed.phone}. Confirm it, then sign in.`,
      );
    }
  }

  if (pendingConfirmation) {
    return (
      <AuthScreen title="Almost there" subtitle={pendingConfirmation}>
        <Button label="Back to sign in" onPress={() => router.replace('/sign-in')} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Create your account"
      subtitle={`A ${settings.shop_name} account keeps your vehicles, addresses and booking history in one place.`}
    >
      <TextField
        label="Your name"
        value={name}
        onChangeText={setName}
        placeholder="Vimal Kumar"
        autoCapitalize="words"
        autoComplete="name"
        autoFocus
      />

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
        hint="We use this to reach you about your booking."
      />

      <TextField
        label="Password"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          if (error) setError(null);
        }}
        placeholder={`At least ${MIN_PASSWORD} characters`}
        secureTextEntry={!reveal}
        autoCapitalize="none"
        autoComplete="new-password"
      />

      <TextField
        label="Confirm password"
        value={confirm}
        onChangeText={(text) => {
          setConfirm(text);
          if (error) setError(null);
        }}
        placeholder="Type it again"
        secureTextEntry={!reveal}
        autoCapitalize="none"
        autoComplete="new-password"
        onSubmitEditing={handleSubmit}
        returnKeyType="go"
      />

      <Pressable onPress={() => setReveal((v) => !v)} accessibilityRole="button" hitSlop={8}>
        <ThemedText type="small" themeColor="textSecondary">
          {reveal ? 'Hide passwords' : 'Show passwords'}
        </ThemedText>
      </Pressable>

      {error && (
        <Card style={styles.errorBox}>
          <ThemedText type="small" themeColor="error">
            {error}
          </ThemedText>
        </Card>
      )}

      <Button label="Create account" loading={isSubmitting} onPress={handleSubmit} />

      <View style={styles.footer}>
        <ThemedText type="small" themeColor="textSecondary">
          Already have an account?
        </ThemedText>
        <Pressable onPress={() => router.replace('/sign-in')} accessibilityRole="link" hitSlop={8}>
          <ThemedText type="smallBold" themeColor="primary">
            Sign in
          </ThemedText>
        </Pressable>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  errorBox: { paddingVertical: Spacing.two },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
});

import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { readableAuthError } from '@/lib/auth-identifier';
import { supabase } from '@/lib/supabase';

const MIN_PASSWORD = 8;

/**
 * Reached after the emailed recovery link opens the app. By this point the
 * customer already holds a valid (recovery) session, so this only has to set
 * the new password — there is no token to type.
 *
 * It lives outside sign-in/ because a recovery session IS a session: the root
 * guard has already swapped to the signed-in stack by the time we get here.
 */
export default function ResetPasswordScreen() {
  const { completeRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
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
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsSubmitting(false);

    if (updateError) {
      setError(readableAuthError(updateError));
      return;
    }

    completeRecovery();
    router.replace('/');
  }

  return (
    <AuthScreen
      title="Choose a new password"
      subtitle="You're signed in from the link we emailed. Set a new password and we'll take you back to the app."
    >
      <TextField
        label="New password"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          if (error) setError(null);
        }}
        placeholder={`At least ${MIN_PASSWORD} characters`}
        secureTextEntry={!reveal}
        autoCapitalize="none"
        autoComplete="new-password"
        autoFocus
      />

      <TextField
        label="Confirm new password"
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
        <ThemedText type="small" themeColor="error">
          {error}
        </ThemedText>
      )}

      <Button label="Save new password" loading={isSubmitting} onPress={handleSubmit} />

      <Pressable
        onPress={() => {
          completeRecovery();
          router.replace('/');
        }}
        accessibilityRole="link"
        hitSlop={8}
        style={styles.skip}
      >
        <ThemedText type="small" themeColor="textMuted">
          Skip for now
        </ThemedText>
      </Pressable>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  skip: { alignItems: 'center', marginTop: Spacing.one },
});

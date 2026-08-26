import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { ChoiceGroup } from '@/components/ui/choice-group';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useProfile, useUpdateProfile, type Gender } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';

const GENDERS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
  { value: 'undisclosed', label: 'Prefer not to say' },
] as const satisfies readonly { value: Gender; label: string }[];

/**
 * Profile step shown once, after the phone is verified.
 *
 * Deliberately after auth rather than before: the OTP already proves the
 * phone, so collecting details first would mean holding unverified data and
 * re-entering everything if verification failed. This also makes the step
 * resumable — a customer who quits half way is asked again next launch.
 */
export default function OnboardingScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const updateProfile = useUpdateProfile();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (profile && profile.id !== seededFor) {
    setSeededFor(profile.id);
    setName(profile.name ?? '');
    setEmail(profile.email ?? user?.email ?? '');
    setGender(profile.gender);
    setAddressLine(profile.address_line ?? '');
    setCity(profile.city ?? '');
    setPostalCode(profile.postal_code ?? '');
  }

  async function save(skipped: boolean) {
    if (!user) return;

    if (!skipped && !name.trim()) {
      setError('Please tell us your name so we know who to ask for.');
      return;
    }
    setError(null);

    try {
      await updateProfile.mutateAsync({
        userId: user.id,
        name: name.trim() || null,
        email: email.trim() || null,
        gender,
        address_line: addressLine.trim() || null,
        city: city.trim() || null,
        postal_code: postalCode.trim() || null,
        // Stamped either way: it records that the step was seen, so a
        // customer who skips isn't asked again on every launch.
        onboarded_at: new Date().toISOString(),
      });
      router.replace('/(app)/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your details.');
    }
  }

  const inputStyle = [
    styles.input,
    { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface },
  ];

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={styles.flex}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.head}>
              <ThemedText type="label" themeColor="primary">
                Almost there
              </ThemedText>
              <ThemedText type="display">Tell us about you</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                We use this to address you properly and reach you on the day.
              </ThemedText>
            </View>

            <View style={styles.field}>
              <ThemedText type="smallBold">Full name</ThemedText>
              <TextInput
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  if (error) setError(null);
                }}
                placeholder="Your name"
                placeholderTextColor={theme.textMuted}
                autoFocus
                accessibilityLabel="Full name"
                style={inputStyle}
              />
            </View>

            {/* Phone is already verified, so it's shown as confirmed context
                rather than another thing to type. */}
            {user?.phone ? (
              <View style={[styles.verified, { backgroundColor: theme.primarySoft }]}>
                <ThemedText type="small" themeColor="primary">
                  ✓ {user.phone} verified
                </ThemedText>
              </View>
            ) : null}

            <View style={styles.field}>
              <ThemedText type="smallBold">
                Email{' '}
                <ThemedText type="small" themeColor="textMuted">
                  (optional)
                </ThemedText>
              </ThemedText>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={theme.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                accessibilityLabel="Email"
                style={inputStyle}
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="smallBold">
                Gender{' '}
                <ThemedText type="small" themeColor="textMuted">
                  (optional)
                </ThemedText>
              </ThemedText>
              <ChoiceGroup
                label="Gender"
                options={GENDERS}
                value={gender}
                onChange={setGender}
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="smallBold">
                Service address{' '}
                <ThemedText type="small" themeColor="textMuted">
                  (optional)
                </ThemedText>
              </ThemedText>
              <TextInput
                value={addressLine}
                onChangeText={setAddressLine}
                placeholder="Flat, street, area"
                placeholderTextColor={theme.textMuted}
                accessibilityLabel="Service address"
                style={inputStyle}
              />
              <View style={styles.row}>
                <TextInput
                  value={city}
                  onChangeText={setCity}
                  placeholder="City"
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel="City"
                  style={[...inputStyle, styles.rowItem]}
                />
                <TextInput
                  value={postalCode}
                  onChangeText={setPostalCode}
                  placeholder="PIN code"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="number-pad"
                  accessibilityLabel="PIN code"
                  style={[...inputStyle, styles.rowItem]}
                />
              </View>
            </View>

            {error && (
              <ThemedText type="small" themeColor="error">
                {error}
              </ThemedText>
            )}

            <View style={styles.actions}>
              <Button
                label={updateProfile.isPending ? 'Saving…' : 'Continue'}
                loading={updateProfile.isPending}
                onPress={() => save(false)}
              />
              <Button
                label="Skip for now"
                variant="ghost"
                disabled={updateProfile.isPending}
                onPress={() => save(true)}
              />
            </View>
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  head: { gap: Spacing.one },
  field: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  rowItem: { flex: 1 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  verified: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    marginTop: -Spacing.two,
  },
  actions: { gap: Spacing.two, marginTop: Spacing.one },
});

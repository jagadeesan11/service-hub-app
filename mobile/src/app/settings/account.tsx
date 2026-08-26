import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingScreen } from '@/components/ui/feedback';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { ChoiceGroup } from '@/components/ui/choice-group';
import { useProfile, useUpdateProfile, type Gender } from '@/hooks/use-profile';
import { useAppSettings } from '@/hooks/use-app-settings';
import { useTheme } from '@/hooks/use-theme';

export default function AccountSettingsScreen() {
  const theme = useTheme();
  const { settings } = useAppSettings();
  const { user } = useAuth();
  const { data: profile, isLoading, isError, refetch } = useProfile(user?.id);
  const updateProfile = useUpdateProfile();

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address_line: '',
    city: '',
    postal_code: '',
  });
  const [gender, setGender] = useState<Gender | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Seed the form the first time the profile arrives, using React's
  // "adjust state during render" pattern rather than an effect — an effect
  // here causes a cascading re-render, and keying off the profile id means a
  // background refetch can't clobber what the user is typing.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (profile && profile.id !== seededFor) {
    setSeededFor(profile.id);
    setForm({
      name: profile.name ?? '',
      phone: profile.phone ?? user?.phone ?? '',
      email: profile.email ?? user?.email ?? '',
      address_line: profile.address_line ?? '',
      city: profile.city ?? '',
      postal_code: profile.postal_code ?? '',
    });
    setGender(profile.gender);
  }

  async function handleSave() {
    if (!user) return;
    setError(null);
    setSaved(false);

    try {
      await updateProfile.mutateAsync({
        userId: user.id,
        name: form.name.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address_line: form.address_line.trim() || null,
        city: form.city.trim() || null,
        postal_code: form.postal_code.trim() || null,
        gender,
      });
      setSaved(true);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your details.');
    }
  }

  if (isLoading) return <LoadingScreen />;

  if (isError) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.errorArea} edges={['left', 'right', 'bottom']}>
          <ErrorState message="Could not load your profile." onRetry={() => refetch()} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  const fields = [
    { key: 'name', label: 'Full name', placeholder: 'Your name', keyboard: 'default' },
    { key: 'phone', label: 'Phone', placeholder: '+91 98765 43210', keyboard: 'phone-pad' },
    { key: 'email', label: 'Email', placeholder: 'you@example.com', keyboard: 'email-address' },
    { key: 'address_line', label: 'Service address', placeholder: 'Flat, street, area', keyboard: 'default' },
    { key: 'city', label: 'City', placeholder: 'City', keyboard: 'default' },
    { key: 'postal_code', label: 'PIN code', placeholder: '600001', keyboard: 'number-pad' },
  ] as const;

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={styles.flex} edges={['left', 'right', 'bottom']}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <ThemedText type="small" themeColor="textMuted">
              Your address is used to reach you for the service. {settings.shop_name} never reads your device
              location.
            </ThemedText>

            <View style={styles.fields}>
              {fields.map((field) => (
                <View key={field.key} style={styles.field}>
                  <ThemedText type="smallBold">{field.label}</ThemedText>
                  <TextInput
                    value={form[field.key]}
                    onChangeText={(text) => setForm((prev) => ({ ...prev, [field.key]: text }))}
                    placeholder={field.placeholder}
                    placeholderTextColor={theme.textMuted}
                    keyboardType={field.keyboard}
                    autoCapitalize={field.key === 'email' ? 'none' : 'sentences'}
                    style={[
                      styles.input,
                      { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface },
                    ]}
                  />
                </View>
              ))}
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
                options={[
                  { value: 'female', label: 'Female' },
                  { value: 'male', label: 'Male' },
                  { value: 'other', label: 'Other' },
                  { value: 'undisclosed', label: 'Prefer not to say' },
                ] as const}
                value={gender}
                onChange={setGender}
              />
            </View>

            {error && (
              <ThemedText type="small" themeColor="error">
                {error}
              </ThemedText>
            )}

            <Button
              label={updateProfile.isPending ? 'Saving…' : saved ? 'Saved' : 'Save changes'}
              loading={updateProfile.isPending}
              onPress={handleSave}
            />
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  errorArea: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.four },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  fields: { gap: Spacing.three },
  field: { gap: Spacing.one },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
});

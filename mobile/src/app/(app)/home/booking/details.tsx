import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookingSteps } from '@/components/booking-steps';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/components/ui/feedback';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';

/**
 * Where the job happens and who to call, captured before the booking row is
 * created. Prefilled from the profile but editable per booking — people book
 * for a second car at a parent's address, or from the office.
 */
export default function BookingDetailsScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile(user?.id);
  const params = useLocalSearchParams<{
    serviceId: string;
    addonIds: string;
    assetId?: string;
  }>();

  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [needsPickup, setNeedsPickup] = useState(false);
  const [pickupNotes, setPickupNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (profile && profile.id !== seededFor) {
    setSeededFor(profile.id);
    setContactName(profile.name ?? '');
    setContactPhone(profile.phone ?? user?.phone ?? '');
    setAddress(profile.address_line ?? '');
    setCity(profile.city ?? '');
    setPostalCode(profile.postal_code ?? '');
  }

  function handleContinue() {
    if (!contactName.trim()) {
      setError('We need a name so the technician knows who to ask for.');
      return;
    }
    if (!contactPhone.trim()) {
      setError('A contact number is required so we can reach you on the day.');
      return;
    }
    if (!address.trim()) {
      setError(
        needsPickup
          ? 'We need an address to collect the vehicle from.'
          : 'We need an address to know where to send the technician.',
      );
      return;
    }
    setError(null);

    router.push({
      pathname: '/(app)/home/booking/confirm',
      params: {
        ...params,
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        address: address.trim(),
        city: city.trim(),
        postalCode: postalCode.trim(),
        needsPickup: needsPickup ? '1' : '0',
        pickupNotes: pickupNotes.trim(),
      },
    });
  }

  if (isLoading) return <LoadingScreen />;

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
        <SafeAreaView style={styles.flex} edges={['left', 'right', 'bottom']}>
        <BookingSteps current="Address" />
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.head}>
              <ThemedText type="title">Where and who</ThemedText>
              <ThemedText type="small" themeColor="textMuted">
                Prefilled from your profile — change it if this booking is somewhere else.
              </ThemedText>
            </View>

            <View style={styles.section}>
              <ThemedText type="label" themeColor="textMuted">
                Contact
              </ThemedText>
              <View style={styles.field}>
                <ThemedText type="smallBold">Name</ThemedText>
                <TextInput
                  value={contactName}
                  onChangeText={(t) => {
                    setContactName(t);
                    if (error) setError(null);
                  }}
                  placeholder="Who should we ask for?"
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel="Contact name"
                  style={inputStyle}
                />
              </View>
              <View style={styles.field}>
                <ThemedText type="smallBold">Phone</ThemedText>
                <TextInput
                  value={contactPhone}
                  onChangeText={(t) => {
                    setContactPhone(t);
                    if (error) setError(null);
                  }}
                  placeholder="+91 98765 43210"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="phone-pad"
                  accessibilityLabel="Contact phone"
                  style={inputStyle}
                />
              </View>
            </View>

            <View style={styles.section}>
              <ThemedText type="label" themeColor="textMuted">
                {needsPickup ? 'Collect from' : 'Service address'}
              </ThemedText>
              <View style={styles.field}>
                <TextInput
                  value={address}
                  onChangeText={(t) => {
                    setAddress(t);
                    if (error) setError(null);
                  }}
                  placeholder="Flat, street, area"
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel="Address"
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
            </View>

            <View style={styles.section}>
              <ThemedText type="label" themeColor="textMuted">
                Pickup
              </ThemedText>

              <Pressable
                onPress={() => setNeedsPickup(!needsPickup)}
                accessibilityRole="checkbox"
                aria-checked={needsPickup}
                accessibilityLabel="Collect my vehicle instead of visiting me"
                style={({ pressed }) => [
                  styles.pickupRow,
                  {
                    backgroundColor: needsPickup ? theme.primarySoft : theme.surface,
                    borderColor: needsPickup ? theme.primary : theme.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: needsPickup ? theme.primary : theme.border,
                      backgroundColor: needsPickup ? theme.primary : 'transparent',
                    },
                  ]}
                >
                  {needsPickup && (
                    <ThemedText type="caption" style={{ color: theme.primaryText }}>
                      ✓
                    </ThemedText>
                  )}
                </View>
                <View style={styles.pickupCopy}>
                  <ThemedText type="bodyMedium">Collect my vehicle</ThemedText>
                  <ThemedText type="small" themeColor="textMuted">
                    We&apos;ll pick it up, do the work, and bring it back.
                  </ThemedText>
                </View>
              </Pressable>

              {needsPickup && (
                <View style={styles.field}>
                  <ThemedText type="smallBold">
                    Pickup notes{' '}
                    <ThemedText type="small" themeColor="textMuted">
                      (optional)
                    </ThemedText>
                  </ThemedText>
                  <TextInput
                    value={pickupNotes}
                    onChangeText={setPickupNotes}
                    placeholder="Gate code, parking spot, best time to call…"
                    placeholderTextColor={theme.textMuted}
                    multiline
                    accessibilityLabel="Pickup notes"
                    style={[...inputStyle, styles.multiline]}
                  />
                </View>
              )}
            </View>

            {error && (
              <ThemedText type="small" themeColor="error">
                {error}
              </ThemedText>
            )}

            <Button label="Continue to scheduling" onPress={handleContinue} />
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
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  head: { gap: Spacing.one },
  section: { gap: Spacing.two },
  field: { gap: Spacing.one },
  row: { flexDirection: 'row', gap: Spacing.two },
  rowItem: { flex: 1 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  pickupRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  pickupCopy: { flex: 1, gap: 1 },
});

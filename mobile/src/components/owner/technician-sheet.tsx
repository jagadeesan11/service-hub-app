import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Radius, Spacing } from '@/constants/theme';
import type { OwnerTechnician } from '@/hooks/use-owner';
import { useTheme } from '@/hooks/use-theme';
import { firstNameOf, validateTechnicianName } from '@/lib/team';

/**
 * Adding someone to the team, or fixing their details.
 *
 * "Stand down" rather than delete: removing a technician outright would strip
 * them off every job they have ever done, because the booking's reference is
 * ON DELETE SET NULL. The history would then say nobody worked those jobs.
 */
export function TechnicianSheet({
  visible,
  technician,
  openJobs,
  busy,
  onSave,
  onSetStatus,
  onClose,
}: {
  visible: boolean;
  technician: OwnerTechnician | null;
  openJobs: number;
  busy?: boolean;
  onSave: (input: { name: string; phone: string }) => void;
  onSetStatus?: (status: 'active' | 'inactive') => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [name, setName] = useState(technician?.name ?? '');
  const [phone, setPhone] = useState(technician?.phone ?? '');

  const problem = validateTechnicianName(name);
  const canSave = !problem && !busy;
  const isActive = technician?.status === 'active';
  const blocked = isActive && openJobs > 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />

        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />

          <View style={styles.head}>
            <ThemedText type="heading">
              {technician ? `Edit ${firstNameOf(technician.name)}` : 'Add a technician'}
            </ThemedText>
            {technician ? (
              <ThemedText type="small" themeColor="textSecondary">
                {openJobs > 0
                  ? `${openJobs} job${openJobs > 1 ? 's' : ''} on right now`
                  : 'No open jobs'}
              </ThemedText>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                They can be given jobs as soon as they are added.
              </ThemedText>
            )}
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <ThemedText type="label" themeColor="textSecondary">
                Name
              </ThemedText>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Arun Prakash"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="words"
                maxLength={80}
                accessibilityLabel="Technician name"
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="label" themeColor="textSecondary">
                Phone
              </ThemedText>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="+91 98765 43210"
                placeholderTextColor={theme.textMuted}
                keyboardType="phone-pad"
                maxLength={20}
                accessibilityLabel="Technician phone"
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              />
            </View>

            {/* Only once they have started typing, so an untouched form is not
                already telling them off. */}
            {problem && name.length > 0 ? (
              <ThemedText type="small" themeColor="error">
                {problem}
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.footer}>
            <Button
              label={busy ? 'Saving…' : technician ? 'Save changes' : 'Add technician'}
              loading={busy}
              disabled={!canSave}
              onPress={() => onSave({ name, phone })}
            />

            {technician && onSetStatus && (
              <View style={styles.standDown}>
                {blocked ? (
                  <ThemedText type="small" themeColor="textMuted" style={styles.centred}>
                    Reassign their open jobs before standing them down.
                  </ThemedText>
                ) : (
                  <Pressable
                    onPress={() => onSetStatus(isActive ? 'inactive' : 'active')}
                    accessibilityRole="button"
                    hitSlop={6}
                  >
                    <ThemedText
                      type="smallBold"
                      themeColor={isActive ? 'error' : 'primary'}
                      style={styles.centred}
                    >
                      {isActive ? 'Stand down' : 'Bring back'}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingBottom: Spacing.five,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: Radius.full,
    marginTop: Spacing.two,
  },
  head: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: 2 },
  form: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: Spacing.three },
  field: { gap: Spacing.one },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  footer: { paddingHorizontal: Spacing.four, paddingTop: Spacing.four, gap: Spacing.three },
  standDown: { alignItems: 'center' },
  centred: { textAlign: 'center' },
});

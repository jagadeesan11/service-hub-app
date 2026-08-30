import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { OwnerPromo } from '@/hooks/use-owner-catalog';
import { validatePromoDraft } from '@/lib/catalog';

/**
 * Creating or editing a discount code.
 *
 * Deliberately the short form: code, amount, and whether the app advertises
 * it. Windows, usage caps and per-service targeting live on the web panel —
 * they are set up once at a desk, not adjusted while standing in a workshop.
 */
export function PromoSheet({
  visible,
  promo,
  busy,
  onSave,
  onToggle,
  onDelete,
  onClose,
}: {
  visible: boolean;
  promo: OwnerPromo | null;
  busy?: boolean;
  onSave: (input: {
    code: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    isPublic: boolean;
  }) => void;
  onToggle?: () => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [code, setCode] = useState(promo?.code ?? '');
  const [kind, setKind] = useState<'percentage' | 'fixed'>(promo?.discount_type ?? 'percentage');
  const [value, setValue] = useState(promo ? String(promo.discount_value) : '');
  const [isPublic, setIsPublic] = useState(promo?.is_public ?? true);

  const problem = validatePromoDraft({ code, discount_type: kind, discount_value: value });
  const canSave = !problem && !busy;

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
            <ThemedText type="heading">{promo ? `Edit ${promo.code}` : 'New promo code'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Customers type this before paying. It is checked again at booking.
            </ThemedText>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner}>
            <Field label="Code">
              <TextInput
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                placeholder="SAVE20"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={32}
                accessibilityLabel="Promo code"
                style={[
                  styles.input,
                  styles.code,
                  { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              />
            </Field>

            <Field label="Discount">
              <View style={styles.kindRow}>
                {(['percentage', 'fixed'] as const).map((k) => {
                  const on = kind === k;
                  return (
                    <Pressable
                      key={k}
                      onPress={() => setKind(k)}
                      accessibilityRole="radio"
                      aria-checked={on}
                      style={[
                        styles.kind,
                        {
                          backgroundColor: on ? theme.primary : theme.surface,
                          borderColor: on ? theme.primary : theme.border,
                        },
                      ]}
                    >
                      <ThemedText
                        type="smallBold"
                        style={{ color: on ? theme.primaryText : theme.textSecondary }}
                      >
                        {k === 'percentage' ? '%' : '₹'}
                      </ThemedText>
                    </Pressable>
                  );
                })}

                <TextInput
                  value={value}
                  onChangeText={(t) => setValue(t.replace(/[^0-9]/g, ''))}
                  placeholder={kind === 'percentage' ? 'Percent off' : 'Rupees off'}
                  placeholderTextColor={theme.textMuted}
                  keyboardType="number-pad"
                  accessibilityLabel="Discount amount"
                  style={[
                    styles.input,
                    styles.value,
                    { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                />
              </View>
            </Field>

            <View style={[styles.switchRow, { borderColor: theme.border }]}>
              <View style={styles.switchCopy}>
                <ThemedText type="bodyMedium">Show it in the app</ThemedText>
                <ThemedText type="caption" themeColor="textMuted">
                  Unlisted codes still work for anyone who has one.
                </ThemedText>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                accessibilityLabel="Show this code in the app"
              />
            </View>

            {/* Only once they have typed enough for the message to be about
                their code rather than about an empty box. */}
            {problem && code.length > 0 ? (
              <ThemedText type="small" themeColor="error">
                {problem}
              </ThemedText>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Button
              label={busy ? 'Saving…' : promo ? 'Save changes' : 'Create code'}
              loading={busy}
              disabled={!canSave}
              onPress={() =>
                onSave({
                  code,
                  discountType: kind,
                  discountValue: Number(value),
                  isPublic,
                })
              }
            />

            {promo && (
              <View style={styles.secondaryRow}>
                {onToggle && (
                  <Pressable onPress={onToggle} accessibilityRole="button" hitSlop={6}>
                    <ThemedText type="smallBold" themeColor="primary">
                      {promo.is_active ? 'Pause' : 'Make live'}
                    </ThemedText>
                  </Pressable>
                )}
                {onDelete && (
                  <Pressable onPress={onDelete} accessibilityRole="button" hitSlop={6}>
                    <ThemedText type="smallBold" themeColor="error">
                      Delete
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText type="label" themeColor="textSecondary">
        {label}
      </ThemedText>
      {children}
    </View>
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
    maxHeight: '86%',
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
  scroll: { marginTop: Spacing.three },
  scrollInner: { paddingHorizontal: Spacing.four, gap: Spacing.three },
  field: { gap: Spacing.one },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  code: { letterSpacing: 1.5 },
  value: { flex: 1 },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  kind: {
    width: 48,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
  switchCopy: { flex: 1, gap: 1 },
  footer: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: Spacing.three },
  secondaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.two },
});

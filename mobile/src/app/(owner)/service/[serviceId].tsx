import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState, LoadingScreen } from '@/components/ui/feedback';
import { Radius, Spacing } from '@/constants/theme';
import {
  useOwnerService,
  useUpdateService,
  useUpdateTierPrice,
} from '@/hooks/use-owner-catalog';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration } from '@/lib/catalog';
import {
  DESCRIPTION_MAX,
  draftFrom,
  hasChanges,
  patchFrom,
  validateDraft,
  type ServiceDraft,
} from '@/lib/service-editor';

const PRICE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** "vehicle_size: hatchback" reads as a tier called "Hatchback". */
function tierLabel(condition: Record<string, string>): string {
  const values = Object.values(condition ?? {});
  if (values.length === 0) return 'All vehicles';
  return values
    .map((v) => String(v).replace(/_/g, ' '))
    .map((v) => v.charAt(0).toUpperCase() + v.slice(1))
    .join(' · ');
}

export default function OwnerServiceScreen() {
  const theme = useTheme();
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const { data: service, isLoading, isError, error, refetch } = useOwnerService(serviceId);

  const save = useUpdateService();
  const saveTier = useUpdateTierPrice();

  const [draft, setDraft] = useState<ServiceDraft | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (isLoading) return <LoadingScreen />;

  if (isError || !service) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centre} edges={['left', 'right', 'bottom']}>
          <ErrorState
            message={isError ? (error as Error).message : 'That service could not be found.'}
            onRetry={() => refetch()}
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  // The draft starts from the fetched row and is only created once the screen
  // has data, so a refetch cannot wipe out half-typed edits.
  const current = draft ?? draftFrom(service);
  const dirty = hasChanges(current, service);

  function edit(patch: Partial<ServiceDraft>) {
    setDraft({ ...current, ...patch });
    setProblem(null);
    setSaved(false);
  }

  async function onSave() {
    const complaint = validateDraft(current);
    if (complaint) {
      setProblem(complaint);
      return;
    }

    setProblem(null);
    try {
      await save.mutateAsync({ id: service!.id, ...patchFrom(current) });
      setSaved(true);
      // Drop the local draft so the screen goes back to mirroring the server.
      setDraft(null);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Could not save that.');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.head}>
              <ThemedText type="label" themeColor="textMuted">
                {service.categories?.name ?? 'Service'}
              </ThemedText>
              <ThemedText type="title">{service.name}</ThemedText>
              {service.rating_count > 0 && service.rating_avg !== null ? (
                <ThemedText type="small" themeColor="textSecondary">
                  ★ {service.rating_avg.toFixed(1)} · {service.rating_count} reviews
                </ThemedText>
              ) : null}
            </View>

            <Card style={styles.card}>
              <Field label="Name">
                <TextInput
                  value={current.name}
                  onChangeText={(name) => edit({ name })}
                  placeholder="Service name"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                />
              </Field>

              <Field
                label="Description"
                hint={`${current.description.length}/${DESCRIPTION_MAX}`}
              >
                <TextInput
                  value={current.description}
                  onChangeText={(description) => edit({ description })}
                  placeholder="What the customer gets"
                  placeholderTextColor={theme.textMuted}
                  multiline
                  style={[
                    styles.input,
                    styles.textArea,
                    { color: theme.text, borderColor: theme.border },
                  ]}
                />
              </Field>

              <View style={styles.pair}>
                <Field label="Base price" style={styles.pairItem}>
                  <TextInput
                    value={current.basePrice}
                    onChangeText={(basePrice) => edit({ basePrice })}
                    keyboardType="numeric"
                    inputMode="decimal"
                    placeholder="0"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                  />
                </Field>
                <Field label="Minutes" style={styles.pairItem}>
                  <TextInput
                    value={current.durationMinutes}
                    onChangeText={(durationMinutes) => edit({ durationMinutes })}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    placeholder="—"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                  />
                </Field>
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchCopy}>
                  <ThemedText type="bodyMedium">Bookable</ThemedText>
                  <ThemedText type="caption" themeColor="textMuted">
                    Off takes it off the menu straight away.
                  </ThemedText>
                </View>
                <Switch
                  value={current.isActive}
                  onValueChange={(isActive) => edit({ isActive })}
                  accessibilityLabel="Bookable"
                />
              </View>
            </Card>

            {/* Tier prices save one at a time, on their own. They belong to
                pricing_rules rather than the service, and batching them behind
                the same button would make one failure look like five. */}
            {(service.pricing_rules ?? []).length > 0 && (
              <View style={styles.section}>
                <ThemedText type="label" themeColor="textMuted" style={styles.sectionLabel}>
                  Price by vehicle
                </ThemedText>
                <Card style={styles.card}>
                  {(service.pricing_rules ?? []).map((rule) => (
                    <TierRow
                      key={rule.id}
                      label={tierLabel(rule.condition)}
                      price={rule.price}
                      busy={saveTier.isPending}
                      onSave={async (price) => {
                        setProblem(null);
                        try {
                          await saveTier.mutateAsync({ ruleId: rule.id, price });
                        } catch (err) {
                          setProblem(
                            err instanceof Error ? err.message : 'Could not save that price.',
                          );
                        }
                      }}
                    />
                  ))}
                </Card>
              </View>
            )}

            {(service.addons ?? []).length > 0 && (
              <View style={styles.section}>
                <ThemedText type="label" themeColor="textMuted" style={styles.sectionLabel}>
                  Add-ons
                </ThemedText>
                <Card style={styles.card}>
                  {(service.addons ?? []).map((addon) => (
                    <View key={addon.id} style={styles.line}>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.lineName}>
                        {addon.name}
                      </ThemedText>
                      <ThemedText type="small">{PRICE.format(addon.price)}</ThemedText>
                    </View>
                  ))}
                  <ThemedText type="caption" themeColor="textMuted">
                    Add-ons are added and removed on the web panel.
                  </ThemedText>
                </Card>
              </View>
            )}

            <View style={styles.body}>
              <ThemedText type="caption" themeColor="textMuted">
                {formatDuration(service.duration_minutes)
                  ? `Currently listed as ${formatDuration(service.duration_minutes)}. `
                  : ''}
                Photos and the category are set on the web panel.
              </ThemedText>
            </View>
          </ScrollView>

          <View
            style={[
              styles.footer,
              { backgroundColor: theme.surface, borderTopColor: theme.border },
            ]}
          >
            {problem ? (
              <ThemedText type="small" themeColor="error" style={styles.footerNote}>
                {problem}
              </ThemedText>
            ) : saved ? (
              <ThemedText type="small" themeColor="success" style={styles.footerNote}>
                Saved.
              </ThemedText>
            ) : null}
            <Button
              label={save.isPending ? 'Saving…' : 'Save changes'}
              loading={save.isPending}
              // Nothing to save is not an error worth a message; the button
              // simply has no job until something moves.
              disabled={!dirty || save.isPending}
              onPress={() => void onSave()}
            />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

function Field({
  label,
  hint,
  style,
  children,
}: {
  label: string;
  hint?: string;
  style?: object;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.field, style]}>
      <View style={styles.fieldHead}>
        <ThemedText type="label" themeColor="textMuted">
          {label}
        </ThemedText>
        {hint ? (
          <ThemedText type="caption" themeColor="textMuted">
            {hint}
          </ThemedText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** One tier price, saved on its own. */
function TierRow({
  label,
  price,
  busy,
  onSave,
}: {
  label: string;
  price: number;
  busy?: boolean;
  onSave: (price: number) => void;
}) {
  const theme = useTheme();
  const [text, setText] = useState(String(price));

  const parsed = Number(text.trim());
  const valid = text.trim() !== '' && Number.isFinite(parsed) && parsed >= 0;
  const dirty = valid && parsed !== Number(price);

  return (
    <View style={styles.tierRow}>
      <ThemedText type="small" style={styles.lineName} numberOfLines={1}>
        {label}
      </ThemedText>
      <TextInput
        value={text}
        onChangeText={setText}
        keyboardType="numeric"
        inputMode="decimal"
        accessibilityLabel={`${label} price`}
        style={[styles.tierInput, { color: theme.text, borderColor: theme.border }]}
      />
      <ThemedText
        type="smallBold"
        themeColor={dirty && !busy ? 'primary' : 'textMuted'}
        onPress={dirty && !busy ? () => onSave(parsed) : undefined}
        accessibilityRole={dirty ? 'button' : undefined}
        style={styles.tierSave}
      >
        Save
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  centre: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.four },
  scroll: { paddingBottom: Spacing.six, gap: Spacing.three },
  head: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: 2 },
  body: { paddingHorizontal: Spacing.four },
  section: { gap: Spacing.two },
  sectionLabel: { paddingHorizontal: Spacing.four },
  card: { marginHorizontal: Spacing.four, gap: Spacing.three },
  field: { gap: Spacing.one },
  fieldHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  textArea: { minHeight: 88, textAlignVertical: 'top' },
  pair: { flexDirection: 'row', gap: Spacing.three },
  pairItem: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  switchCopy: { flex: 1, gap: 1 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  lineName: { flex: 1 },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  tierInput: {
    width: 96,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    fontSize: 15,
    textAlign: 'right',
  },
  tierSave: { width: 40, textAlign: 'right' },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  footerNote: { textAlign: 'center' },
});

import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PromoSheet } from '@/components/owner/promo-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { ErrorState, SkeletonList } from '@/components/ui/feedback';
import { Radius, Spacing } from '@/constants/theme';
import {
  useDeletePromoCode,
  useOwnerPromoCodes,
  useOwnerServices,
  useSavePromoCode,
  useToggleService,
  useTogglePromoCode,
  type OwnerPromo,
  type OwnerService,
} from '@/hooks/use-owner-catalog';
import { useTheme } from '@/hooks/use-theme';
import { promoState, promoSummary, serviceSummary, type PromoState } from '@/lib/catalog';

export default function OwnerCatalogScreen() {
  const [problem, setProblem] = useState<string | null>(null);
  const [editing, setEditing] = useState<OwnerPromo | null>(null);
  const [creating, setCreating] = useState(false);

  const services = useOwnerServices();
  const promos = useOwnerPromoCodes();
  const toggleService = useToggleService();
  const savePromo = useSavePromoCode();
  const togglePromo = useTogglePromoCode();
  const deletePromo = useDeletePromoCode();

  const refreshing = services.isRefetching || promos.isRefetching;

  async function run(fn: () => Promise<unknown>) {
    setProblem(null);
    try {
      await fn();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'That did not work.');
    }
  }

  const sheetOpen = creating || editing !== null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                void services.refetch();
                void promos.refetch();
              }}
            />
          }
        >
          <View style={styles.header}>
            <ThemedText type="title">Catalog</ThemedText>
          </View>

          {problem && (
            <View style={styles.body}>
              <ThemedText type="small" themeColor="error">
                {problem}
              </ThemedText>
            </View>
          )}

          <View style={styles.sectionHead}>
            <ThemedText type="label" themeColor="textMuted">
              Services
            </ThemedText>
          </View>

          {services.isLoading ? (
            <View style={styles.body}>
              <SkeletonList count={3} height={72} />
            </View>
          ) : services.isError ? (
            <View style={styles.body}>
              <ErrorState
                message={(services.error as Error).message}
                onRetry={() => services.refetch()}
              />
            </View>
          ) : (
            <View style={styles.stack}>
              {(services.data ?? []).map((s) => (
                <ServiceRow
                  key={s.id}
                  service={s}
                  busy={toggleService.isPending}
                  onToggle={(next) =>
                    void run(() => toggleService.mutateAsync({ id: s.id, isActive: next }))
                  }
                />
              ))}
            </View>
          )}

          <View style={styles.sectionHead}>
            <ThemedText type="label" themeColor="textMuted">
              Promo codes
            </ThemedText>
            <Pressable onPress={() => setCreating(true)} accessibilityRole="button" hitSlop={6}>
              <ThemedText type="smallBold" themeColor="primary">
                New code
              </ThemedText>
            </Pressable>
          </View>

          {promos.isLoading ? (
            <View style={styles.body}>
              <SkeletonList count={2} height={64} />
            </View>
          ) : promos.isError ? (
            <View style={styles.body}>
              <ErrorState
                message={(promos.error as Error).message}
                onRetry={() => promos.refetch()}
              />
            </View>
          ) : (promos.data ?? []).length === 0 ? (
            <View style={styles.body}>
              <Card style={styles.empty}>
                <ThemedText type="bodyMedium">No promo codes</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Create one and customers can use it straight away.
                </ThemedText>
              </Card>
            </View>
          ) : (
            <View style={styles.stack}>
              {(promos.data ?? []).map((p) => (
                <PromoRow key={p.id} promo={p} onPress={() => setEditing(p)} />
              ))}
            </View>
          )}

          <View style={styles.body}>
            <ThemedText type="caption" themeColor="textMuted">
              Tap a service to edit its name, price, duration and description. Photos, add-ons and
              code targeting stay on the web panel — they are desk work, not shop-floor work.
            </ThemedText>
          </View>
        </ScrollView>

        {sheetOpen && (
          <PromoSheet
            visible
            promo={editing}
            busy={savePromo.isPending || togglePromo.isPending || deletePromo.isPending}
            onClose={() => {
              setEditing(null);
              setCreating(false);
            }}
            onSave={(input) =>
              void run(async () => {
                await savePromo.mutateAsync({ ...input, id: editing?.id ?? null });
                setEditing(null);
                setCreating(false);
              })
            }
            onToggle={
              editing
                ? () =>
                    void run(async () => {
                      await togglePromo.mutateAsync({
                        id: editing.id,
                        isActive: !editing.is_active,
                      });
                      setEditing(null);
                    })
                : undefined
            }
            onDelete={
              editing
                ? () =>
                    void run(async () => {
                      await deletePromo.mutateAsync(editing.id);
                      setEditing(null);
                    })
                : undefined
            }
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function ServiceRow({
  service,
  busy,
  onToggle,
}: {
  service: OwnerService;
  busy?: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    // The card is not pressable as a whole. Opening the service and switching
    // it off are siblings, because nesting the switch inside a pressable makes
    // the tap ambiguous on native and invalid HTML on web.
    <Card style={styles.row}>
      <Pressable
        onPress={() =>
          router.push({
            pathname: '/(owner)/service/[serviceId]',
            params: { serviceId: service.id },
          })
        }
        accessibilityRole="button"
        accessibilityLabel={`Open ${service.name}`}
        // The whole strip up to the chevron, not just the words: a tap target
        // the exact size of the text reads as decoration, and this row had no
        // chevron either — so there was nothing to say it opened anything.
        style={({ pressed }) => [styles.rowMain, { opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={styles.rowCopy}>
          <ThemedText type="bodyMedium" numberOfLines={1}>
            {service.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {serviceSummary(service)}
          </ThemedText>
          {service.rating_count > 0 && service.rating_avg !== null ? (
            <ThemedText type="caption" themeColor="textMuted">
              ★ {service.rating_avg.toFixed(1)} · {service.rating_count} reviews
            </ThemedText>
          ) : null}
        </View>

        <ThemedText type="body" themeColor="textMuted">
          ›
        </ThemedText>
      </Pressable>

      {/* The switch is the whole point of this row on a phone: something
          breaks, the service stops being bookable before the next customer
          picks it. */}
      <Switch
        value={service.is_active}
        onValueChange={onToggle}
        disabled={busy}
        accessibilityLabel={`${service.name} bookable`}
      />
    </Card>
  );
}

function PromoRow({ promo, onPress }: { promo: OwnerPromo; onPress: () => void }) {
  const theme = useTheme();
  const state = promoState(promo);

  const tone: Record<PromoState, { fg: string; bg: string; label: string }> = {
    live: { fg: theme.success, bg: theme.successSoft, label: 'Live' },
    paused: { fg: theme.textMuted, bg: theme.surfaceSunk, label: 'Paused' },
    scheduled: { fg: theme.warning, bg: theme.warningSoft, label: 'Scheduled' },
    expired: { fg: theme.error, bg: theme.errorSoft, label: 'Expired' },
  };
  const { fg, bg, label } = tone[state];

  return (
    <Card style={styles.row} onPress={onPress}>
      <View style={styles.rowCopy}>
        <View style={styles.codeRow}>
          <ThemedText type="smallBold" style={styles.code}>
            {promo.code}
          </ThemedText>
          <View style={[styles.badge, { backgroundColor: bg }]}>
            <ThemedText type="caption" style={{ color: fg }}>
              {label}
            </ThemedText>
          </View>
          {!promo.is_public && (
            <ThemedText type="caption" themeColor="textMuted">
              Unlisted
            </ThemedText>
          )}
        </View>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {promoSummary(promo)}
        </ThemedText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: { paddingBottom: Spacing.six },
  header: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  body: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  stack: { paddingHorizontal: Spacing.four, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rowCopy: { flex: 1, gap: 1 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  code: { letterSpacing: 1 },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.two, paddingVertical: 1 },
  empty: { gap: 2 },
});

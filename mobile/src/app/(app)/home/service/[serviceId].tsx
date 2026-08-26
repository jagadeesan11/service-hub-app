import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ServiceIcon } from '@/components/service-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingScreen } from '@/components/ui/feedback';
import { SERVICE_ICONS } from '@/constants/service-icons';
import { Elevation, Radius, Spacing } from '@/constants/theme';
import { useServiceDetail } from '@/hooks/use-catalog';
import { useTheme } from '@/hooks/use-theme';
import { calculatePrice } from '@/lib/pricing';
import type { Addon, PricingRule } from '@/types';

const PRICE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export default function ServiceDetailScreen() {
  const theme = useTheme();
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const { data: service, isLoading, isError, error, refetch } = useServiceDetail(serviceId);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);

  const total = useMemo(
    () => (service ? calculatePrice(service, {}, selectedAddonIds) : 0),
    [service, selectedAddonIds],
  );

  function toggleAddon(addonId: string) {
    setSelectedAddonIds((prev) =>
      prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId],
    );
  }

  if (isLoading) return <LoadingScreen />;

  if (isError || !service) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.errorArea} edges={['left', 'right', 'bottom']}>
          <ErrorState
            message={isError ? (error as Error).message : 'Service not found.'}
            onRetry={isError ? () => refetch() : undefined}
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  const isTiered = service.pricing_type === 'tiered';

  return (
    <ThemedView style={styles.container}>
      {/* The service's own name, so the back stack reads Home → Car Care →
          Ceramic Coating rather than Home → Services → Service. Truncated
          because a header cannot wrap and these names carry warranty
          suffixes. */}
      <Stack.Screen
        options={{
          title: service.name.length > 24 ? `${service.name.slice(0, 23).trimEnd()}…` : service.name,
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <ImageCarousel images={service.images} name={service.name} icon={service.icon} />

          <View style={styles.body}>
            <ThemedText type="title">{service.name}</ThemedText>

            {service.duration_minutes ? (
              <ThemedText type="small" themeColor="textMuted">
                Takes about {formatDuration(service.duration_minutes)}
              </ThemedText>
            ) : null}

            {service.description && (
              <ThemedText type="body" themeColor="textSecondary" style={styles.description}>
                {service.description}
              </ThemedText>
            )}

            {isTiered && service.pricing_rules.length > 0 && (
              <PricingTable rules={service.pricing_rules} />
            )}

            {service.addons.length > 0 && (
              <AddonsList
                addons={service.addons}
                selectedAddonIds={selectedAddonIds}
                onToggle={toggleAddon}
              />
            )}
          </View>
        </ScrollView>

        {/* Sticky footer keeps the price and the action in view while the
            customer scrolls the details — the decision and the commit
            shouldn't be separated by a scroll. */}
        <View
          style={[
            styles.footer,
            { backgroundColor: theme.surface, borderTopColor: theme.border },
            Elevation.raised,
          ]}
        >
          <View style={styles.footerPrice}>
            <ThemedText type="caption" themeColor="textMuted">
              {isTiered ? 'Starting from' : 'Total'}
            </ThemedText>
            <ThemedText type="price">{PRICE.format(total)}</ThemedText>
          </View>

          <Button
            label="Book now"
            fullWidth={false}
            style={styles.footerCta}
            onPress={() =>
              router.push({
                pathname: '/(app)/home/booking/asset',
                params: { serviceId: service.id, addonIds: selectedAddonIds.join(',') },
              })
            }
          />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function ImageCarousel({
  images,
  name,
  icon,
}: {
  images: string[];
  name: string;
  icon: string | null;
}) {
  const { width } = useWindowDimensions();
  const theme = useTheme();

  if (images.length === 0) {
    // No photography yet. The service's own icon says what the job is; a
    // lone letter says nothing, and this is the screen a customer looks at
    // while deciding whether to book.
    const hasIcon = Boolean(icon && SERVICE_ICONS[icon]);

    return (
      <View style={[styles.hero, { width, backgroundColor: theme.primarySoft }]}>
        {hasIcon ? (
          <ServiceIcon name={icon} size={104} />
        ) : (
          <ThemedText
            style={{ color: theme.primary, opacity: 0.3, fontSize: 72, fontWeight: '700' }}
          >
            {name.charAt(0).toUpperCase()}
          </ThemedText>
        )}
      </View>
    );
  }

  return (
    <FlatList
      data={images}
      keyExtractor={(uri) => uri}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      renderItem={({ item }) => (
        <Image
          source={{ uri: item }}
          style={[styles.hero, { width, backgroundColor: theme.surfaceSunk }]}
          contentFit="cover"
        />
      )}
    />
  );
}

/**
 * Columns come from whatever keys the service's own pricing_rules use, so a
 * new vertical with different conditions renders correctly with no code
 * change.
 */
function PricingTable({ rules }: { rules: PricingRule[] }) {
  const theme = useTheme();
  const columns = useMemo(() => {
    const keys = new Set<string>();
    rules.forEach((r) => Object.keys(r.condition).forEach((k) => keys.add(k)));
    return Array.from(keys).sort();
  }, [rules]);

  return (
    <View style={styles.section}>
      <ThemedText type="heading">Pricing</ThemedText>
      <View style={[styles.table, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {rules.map((rule, index) => (
          <View
            key={rule.id}
            style={[
              styles.tableRow,
              index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
            ]}
          >
            <ThemedText type="body" style={styles.tableLabel}>
              {columns.map((c) => rule.condition[c]).filter(Boolean).join(' · ') || '—'}
            </ThemedText>
            <ThemedText type="bodyMedium">{PRICE.format(rule.price)}</ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

function AddonsList({
  addons,
  selectedAddonIds,
  onToggle,
}: {
  addons: Addon[];
  selectedAddonIds: string[];
  onToggle: (id: string) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.section}>
      <ThemedText type="heading">Add-ons</ThemedText>
      <ThemedText type="small" themeColor="textMuted" style={styles.sectionHint}>
        Optional extras, added to your total.
      </ThemedText>

      <View style={styles.addonStack}>
        {addons.map((addon) => {
          const selected = selectedAddonIds.includes(addon.id);
          return (
            <Pressable
              key={addon.id}
              onPress={() => onToggle(addon.id)}
              accessibilityRole="checkbox"
              // `aria-checked` rather than accessibilityState: react-native-web
              // emits role="checkbox" from the former but drops the latter, so
              // screen readers were announcing the control with no state at all.
              aria-checked={selected}
              accessibilityLabel={`${addon.name}, ${PRICE.format(addon.price)}`}
              style={({ pressed }) => [
                styles.addonRow,
                {
                  backgroundColor: selected ? theme.primarySoft : theme.surface,
                  borderColor: selected ? theme.primary : theme.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: selected ? theme.primary : theme.border,
                    backgroundColor: selected ? theme.primary : 'transparent',
                  },
                ]}
              >
                {selected && (
                  <ThemedText type="caption" style={{ color: theme.primaryText }}>
                    ✓
                  </ThemedText>
                )}
              </View>

              <ThemedText type="body" style={styles.addonName}>
                {addon.name}
              </ThemedText>

              <ThemedText type="bodyMedium" themeColor={selected ? 'primary' : 'textSecondary'}>
                +{PRICE.format(addon.price)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hours`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  errorArea: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.four },
  scroll: { paddingBottom: Spacing.five },
  hero: { height: 230, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: Spacing.four, paddingTop: Spacing.four, gap: Spacing.two },
  description: { marginTop: Spacing.one },
  section: { marginTop: Spacing.four, gap: Spacing.two },
  sectionHint: { marginTop: -Spacing.one },
  table: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  tableLabel: { textTransform: 'capitalize' },
  addonStack: { gap: Spacing.two },
  addonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addonName: { flex: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerPrice: { gap: 0 },
  footerCta: { paddingHorizontal: Spacing.five },
});

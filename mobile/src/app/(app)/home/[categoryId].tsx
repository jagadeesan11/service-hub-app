import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ServiceIcon } from '@/components/service-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/feedback';
import { SERVICE_ICONS } from '@/constants/service-icons';
import { Spacing } from '@/constants/theme';
import { useServicesByCategory } from '@/hooks/use-catalog';
import { useTheme } from '@/hooks/use-theme';
import type { Service } from '@/types';

const PRICE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export default function ServiceListScreen() {
  const { categoryId, categoryName } = useLocalSearchParams<{
    categoryId: string;
    categoryName?: string;
  }>();
  const { data: services, isLoading, isError, error, refetch } = useServicesByCategory(categoryId);

  return (
    <ThemedView style={styles.container}>
      {/* The name travels in the route params already; showing it keeps the
          customer oriented after tapping through from Home. */}
      <Stack.Screen options={{ title: categoryName ?? 'Services' }} />
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        {isLoading && (
          <View style={styles.body}>
            <SkeletonList count={3} height={200} />
          </View>
        )}

        {isError && (
          <View style={styles.body}>
            <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
          </View>
        )}

        {!isLoading && !isError && (
          <FlatList
            data={services}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <EmptyState
                title="No services here yet"
                description="Check back soon — this category is still being set up."
              />
            }
            renderItem={({ item }) => <ServiceCard service={item} />}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function ServiceCard({ service }: { service: Service }) {
  const theme = useTheme();

  return (
    <Card
      padded={false}
      onPress={() =>
        router.push({
          pathname: '/(app)/home/service/[serviceId]',
          params: { serviceId: service.id },
        })
      }
      style={styles.card}
    >
      {service.images[0] ? (
        <Image source={{ uri: service.images[0] }} style={styles.image} contentFit="cover" />
      ) : (
        // No photo yet: the service's own icon, falling back to its initial.
        // Both are deliberate-looking, which matters because a shop adding a
        // service rarely has photography ready on day one.
        <View style={[styles.image, styles.imageFallback, { backgroundColor: theme.primarySoft }]}>
          {SERVICE_ICONS[service.icon ?? ''] ? (
            <ServiceIcon name={service.icon} size={44} />
          ) : (
            <ThemedText type="display" style={{ color: theme.primary, opacity: 0.35 }}>
              {service.name.charAt(0).toUpperCase()}
            </ThemedText>
          )}
        </View>
      )}

      <View style={styles.cardBody}>
        <ThemedText type="bodyMedium" numberOfLines={1}>
          {service.name}
        </ThemedText>

        {service.description && (
          <ThemedText type="small" themeColor="textMuted" numberOfLines={2}>
            {service.description}
          </ThemedText>
        )}

        <View style={styles.cardFooter}>
          <View style={styles.priceGroup}>
            <ThemedText type="caption" themeColor="textMuted">
              {service.pricing_type === 'fixed' ? 'Price' : 'From'}
            </ThemedText>
            <ThemedText type="price">{PRICE.format(service.base_price)}</ThemedText>
          </View>

          {service.duration_minutes ? (
            <Badge label={formatDuration(service.duration_minutes)} />
          ) : null}
        </View>
      </View>
    </Card>
  );
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours} hr` : `${hours.toFixed(1)} hr`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  body: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  list: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  card: { overflow: 'hidden' },
  image: { width: '100%', height: 150 },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: Spacing.three, gap: Spacing.one },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
  priceGroup: { gap: 0 },
});

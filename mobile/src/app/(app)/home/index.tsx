import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActiveBookingCard } from '@/components/home/active-booking-card';
import { HomeHeader } from '@/components/home/home-header';
import { QuickActions } from '@/components/home/quick-actions';
import { ShopHoursCard } from '@/components/shop-hours-card';
import { ServiceIcon } from '@/components/service-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/feedback';
import { SERVICE_ICONS } from '@/constants/service-icons';
import { Radius, Spacing } from '@/constants/theme';
import { useCategories } from '@/hooks/use-catalog';
import { useTheme } from '@/hooks/use-theme';
import type { Category } from '@/types';

export default function HomeScreen() {
  const { data: categories, isLoading, isError, error, refetch } = useCategories();

  // Header, live booking and actions ride in ListHeaderComponent rather than
  // sitting above the list: pinned, they would eat most of a small screen
  // before a single category was visible.
  const header = (
    <>
      <HomeHeader />
      <ActiveBookingCard />
      <QuickActions />
      <View style={styles.sectionTitle}>
        <ThemedText type="label" themeColor="textMuted">
          Browse
        </ThemedText>
      </View>
    </>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <FlatList
          // Empty while loading or failed, so the header still renders and the
          // state lands in ListEmptyComponent instead of three parallel branches.
          data={isLoading || isError ? [] : categories}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <View style={styles.body}>
              {isLoading ? (
                <SkeletonList count={3} height={76} />
              ) : isError ? (
                <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
              ) : (
                <EmptyState
                  title="No categories yet"
                  description="Services will appear here once they're published."
                />
              )}
            </View>
          }
          renderItem={({ item }) => <CategoryCard category={item} />}
          // Below the catalogue: people come here to book, and opening hours
          // are the thing they check second. It renders nothing until the
          // hours load, so the list does not end on an empty box.
          ListFooterComponent={
            <View style={styles.footer}>
              <ShopHoursCard />
            </View>
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function CategoryCard({ category }: { category: Category }) {
  const theme = useTheme();

  return (
    <Card
      onPress={() =>
        router.push({
          pathname: '/(app)/home/[categoryId]',
          params: { categoryId: category.id, categoryName: category.name },
        })
      }
      style={styles.card}
    >
      {/* The category's icon when one is set, and a tinted initial when it is
          not — so a brand-new vertical looks intentional rather than broken
          before anyone has picked artwork for it. */}
      <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
        {SERVICE_ICONS[category.icon ?? ''] ? (
          <ServiceIcon name={category.icon} size={26} />
        ) : (
          <ThemedText type="heading" style={{ color: theme.primary }}>
            {category.name.charAt(0).toUpperCase()}
          </ThemedText>
        )}
      </View>

      <View style={styles.cardBody}>
        <ThemedText type="bodyMedium">{category.name}</ThemedText>
        <ThemedText type="small" themeColor="textMuted">
          Browse services
        </ThemedText>
      </View>

      <ThemedText type="body" themeColor="textMuted">
        ›
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  sectionTitle: { paddingHorizontal: Spacing.four, paddingTop: Spacing.four },
  body: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  // No horizontal padding here: the header pieces pad themselves, so padding
  // the container as well would double it for them.
  list: { paddingBottom: Spacing.six, gap: Spacing.two },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginHorizontal: Spacing.four,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 1 },
  footer: { paddingHorizontal: Spacing.four, paddingTop: Spacing.five },
});

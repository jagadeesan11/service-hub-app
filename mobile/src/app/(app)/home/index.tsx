import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <ThemedText type="label" themeColor="primary">
            Book a service
          </ThemedText>
          <ThemedText type="display" style={styles.headline}>
            What do you need today?
          </ThemedText>
        </View>

        {isLoading && (
          <View style={styles.body}>
            <SkeletonList count={3} height={76} />
          </View>
        )}

        {isError && (
          <View style={styles.body}>
            <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
          </View>
        )}

        {!isLoading && !isError && (
          <FlatList
            data={categories}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <EmptyState
                title="No categories yet"
                description="Services will appear here once they're published."
              />
            }
            renderItem={({ item }) => <CategoryCard category={item} />}
          />
        )}
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
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.one,
  },
  headline: { maxWidth: 320 },
  body: { paddingHorizontal: Spacing.four },
  list: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 1 },
});

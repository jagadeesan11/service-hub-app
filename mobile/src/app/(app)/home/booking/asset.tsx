import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DynamicForm } from '@/components/dynamic-form';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/components/ui/feedback';
import { BookingSteps } from '@/components/booking-steps';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useCategoryInputTemplate, useCreateCustomerAsset } from '@/hooks/use-booking';

export default function AssetFormScreen() {
  const { user } = useAuth();
  const { serviceId, addonIds } = useLocalSearchParams<{ serviceId: string; addonIds: string }>();
  const { data: template, isLoading, isError } = useCategoryInputTemplate(serviceId);
  const createAsset = useCreateCustomerAsset();
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  // A category with no input_template needs no asset info at all — skip
  // straight to scheduling instead of showing an empty form.
  useEffect(() => {
    if (template && template.fields.length === 0) {
      router.replace({
        pathname: '/(app)/home/booking/details',
        params: { serviceId, addonIds },
      });
    }
  }, [template, serviceId, addonIds]);

  async function handleContinue() {
    if (!template || !user) return;

    const missing = template.fields.find((field) => field.required && !values[field.name]);
    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }
    setError(null);

    try {
      const asset = await createAsset.mutateAsync({
        userId: user.id,
        type: template.categoryId,
        attributes: values,
      });

      router.push({
        pathname: '/(app)/home/booking/details',
        params: { serviceId, addonIds, assetId: asset.id },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your details.');
    }
  }

  if (isLoading || !template || template.fields.length === 0) {
    return <LoadingScreen />;
  }

  if (isError) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText themeColor="error">Could not load the form for this category.</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <BookingSteps current="Vehicle" />
        <View style={styles.head}>
          <ThemedText type="title">Job details</ThemedText>
          <ThemedText type="small" themeColor="textMuted">
            We need these to price the job and turn up prepared.
          </ThemedText>
        </View>

        <DynamicForm
          fields={template.fields}
          values={values}
          onChange={(name, value) => setValues((prev) => ({ ...prev, [name]: value }))}
        />

        {error && (
          <ThemedText themeColor="error" style={styles.error}>
            {error}
          </ThemedText>
        )}

        <Button
          label={createAsset.isPending ? 'Saving…' : 'Continue'}
          loading={createAsset.isPending}
          onPress={handleContinue}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.four,
  },
  head: { gap: Spacing.one },
  error: {
    marginTop: -Spacing.two,
  },
});

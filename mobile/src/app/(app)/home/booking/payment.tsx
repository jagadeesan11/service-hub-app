import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookingSteps } from '@/components/booking-steps';
import { RazorpayCheckout, type RazorpayResult } from '@/components/razorpay-checkout';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState, LoadingScreen } from '@/components/ui/feedback';
import { Radius, Spacing } from '@/constants/theme';
import { useAppSettings } from '@/hooks/use-app-settings';
import { useAuth } from '@/hooks/use-auth';
import {
  useChooseCashOnDelivery,
  useConfirmPayment,
  useCreateRazorpayOrder,
  type RazorpayOrder,
} from '@/hooks/use-payment';
import { useTheme } from '@/hooks/use-theme';

const PRICE_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

type Method = 'online' | 'cod';

function MethodOption({
  title,
  detail,
  selected,
  onPress,
}: {
  title: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      aria-checked={selected}
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: selected ? theme.primarySoft : theme.surface,
          borderColor: selected ? theme.primary : theme.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.radio,
          { borderColor: selected ? theme.primary : theme.border },
        ]}
      >
        {selected && <View style={[styles.radioDot, { backgroundColor: theme.primary }]} />}
      </View>
      <View style={styles.optionCopy}>
        <ThemedText type="bodyMedium">{title}</ThemedText>
        <ThemedText type="small" themeColor="textMuted">
          {detail}
        </ThemedText>
      </View>
    </Pressable>
  );
}

export default function PaymentScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { settings, isLoading: isSettingsLoading } = useAppSettings();
  const { bookingId, amount, serviceName } = useLocalSearchParams<{
    bookingId: string;
    amount: string;
    serviceName: string;
  }>();

  const createOrder = useCreateRazorpayOrder();
  const confirmPayment = useConfirmPayment();
  const chooseCod = useChooseCashOnDelivery();
  const [order, setOrder] = useState<RazorpayOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canPayOnline = settings.online_payment_enabled;
  const canPayCash = settings.cod_enabled;

  // Default to whichever is actually offered; online wins when both are.
  const [method, setMethod] = useState<Method | null>(null);
  const selectedMethod: Method | null = method ?? (canPayOnline ? 'online' : canPayCash ? 'cod' : null);

  const isBusy = createOrder.isPending || confirmPayment.isPending || chooseCod.isPending;

  function goToBooking() {
    router.replace({ pathname: '/(app)/bookings/[bookingId]', params: { bookingId } });
  }

  async function handlePayOnline() {
    setError(null);
    try {
      setOrder(await createOrder.mutateAsync(bookingId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start payment.');
    }
  }

  async function handlePayCash() {
    setError(null);
    try {
      await chooseCod.mutateAsync(bookingId);
      goToBooking();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm the booking.');
    }
  }

  async function handleSuccess(result: RazorpayResult) {
    setOrder(null);
    try {
      await confirmPayment.mutateAsync({
        bookingId,
        razorpayOrderId: result.orderId,
        razorpayPaymentId: result.paymentId,
        razorpaySignature: result.signature,
      });
      goToBooking();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Your payment went through but we could not confirm the booking. Please contact support.',
      );
    }
  }

  if (isSettingsLoading) return <LoadingScreen />;

  if (!canPayOnline && !canPayCash) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={[styles.safeArea, styles.closed]}>
          <ErrorState message="We're not taking payments right now. Your booking is held as pending — please get in touch and we'll sort it out." />
        </SafeAreaView>
      </ThemedView>
    );
  }

  const total = PRICE_FORMATTER.format(Number(amount));
  const ctaLabel =
    selectedMethod === 'cod' ? `Confirm booking · ${total} in cash` : `Pay ${total}`;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <BookingSteps current="Payment" />
        <ScrollView contentContainerStyle={styles.scroll}>
          <Card style={styles.summary}>
            <ThemedText type="smallBold">{serviceName}</ThemedText>
            <ThemedText type="small" themeColor="textMuted">
              Amount due
            </ThemedText>
            <ThemedText type="title">{total}</ThemedText>
          </Card>

          <View style={styles.section}>
            <ThemedText type="label" themeColor="textMuted">
              How would you like to pay?
            </ThemedText>

            {canPayOnline && (
              <MethodOption
                title="Pay now"
                detail="UPI, card or netbanking. Your slot is confirmed straight away."
                selected={selectedMethod === 'online'}
                onPress={() => {
                  setMethod('online');
                  setError(null);
                }}
              />
            )}

            {canPayCash && (
              <MethodOption
                title="Cash on service"
                detail="Pay the technician when the work is done."
                selected={selectedMethod === 'cod'}
                onPress={() => {
                  setMethod('cod');
                  setError(null);
                }}
              />
            )}
          </View>

          {error && (
            <Card style={[styles.errorBox, { borderColor: theme.error }]}>
              <ThemedText type="small" themeColor="error">
                {error}
              </ThemedText>
            </Card>
          )}
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <Button
            label={
              createOrder.isPending
                ? 'Opening checkout…'
                : confirmPayment.isPending
                  ? 'Confirming payment…'
                  : chooseCod.isPending
                    ? 'Confirming booking…'
                    : error && selectedMethod === 'online'
                      ? `Try again · ${total}`
                      : ctaLabel
            }
            loading={isBusy}
            onPress={selectedMethod === 'cod' ? handlePayCash : handlePayOnline}
          />
        </View>

        {order && (
          <RazorpayCheckout
            visible
            keyId={order.key_id}
            orderId={order.order_id}
            amount={order.amount}
            currency={order.currency}
            name={settings.shop_name}
            description={serviceName}
            prefill={{ email: user?.email, contact: user?.phone }}
            onSuccess={handleSuccess}
            onFailure={(reason) => {
              setOrder(null);
              setError(reason || 'Payment failed. You can try again.');
            }}
            onDismiss={() => setOrder(null)}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  closed: { justifyContent: 'center', paddingHorizontal: Spacing.four },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  summary: { gap: Spacing.one },
  section: { gap: Spacing.two },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioDot: { width: 10, height: 10, borderRadius: Radius.full },
  optionCopy: { flex: 1, gap: 2 },
  errorBox: { borderWidth: 1 },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

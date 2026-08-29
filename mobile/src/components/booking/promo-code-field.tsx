import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  useValidatePromoCode,
  usePublicPromoCodes,
  type PromoValidation,
} from '@/hooks/use-promo';

const PRICE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function summarise(c: {
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_discount_amount: number | null;
  min_order_value: number;
}): string {
  const off =
    c.discount_type === 'percentage'
      ? `${c.discount_value}% off` + (c.max_discount_amount ? `, up to ${PRICE.format(c.max_discount_amount)}` : '')
      : `${PRICE.format(c.discount_value)} off`;
  return c.min_order_value > 0 ? `${off} over ${PRICE.format(c.min_order_value)}` : off;
}

/**
 * Applying a promo code, immediately before the booking is confirmed.
 *
 * The check runs in the database against this exact job — service, vehicle and
 * add-ons all affect whether a code qualifies — and the same function runs
 * again when the booking is created. So this is a genuine answer, not an
 * optimistic one, and a code that lapses in between is caught rather than
 * quietly dropped.
 */
export function PromoCodeField({
  serviceId,
  assetId,
  addonIds,
  applied,
  onApplied,
}: {
  serviceId: string;
  assetId: string | null;
  addonIds: string[];
  applied: PromoValidation | null;
  onApplied: (result: PromoValidation | null) => void;
}) {
  const theme = useTheme();
  const [code, setCode] = useState('');
  const [reason, setReason] = useState<string | null>(null);
  const validate = useValidatePromoCode();
  const { data: available } = usePublicPromoCodes();

  async function apply(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      setReason('Enter a code.');
      return;
    }

    setReason(null);
    try {
      const result = await validate.mutateAsync({
        code: trimmed,
        serviceId,
        assetId,
        addonIds,
      });

      if (!result.valid) {
        setReason(result.reason ?? 'That code is not valid.');
        onApplied(null);
        return;
      }
      setCode('');
      onApplied(result);
    } catch (err) {
      setReason(err instanceof Error ? err.message : 'Could not check that code.');
    }
  }

  if (applied) {
    return (
      <View style={[styles.applied, { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}>
        <View style={styles.appliedCopy}>
          <ThemedText type="smallBold" themeColor="primary">
            {applied.code} applied
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {applied.description || `You save ${PRICE.format(applied.discount_amount ?? 0)}`}
          </ThemedText>
        </View>
        <Pressable
          onPress={() => {
            onApplied(null);
            setReason(null);
          }}
          accessibilityRole="button"
          accessibilityLabel="Remove promo code"
          hitSlop={8}
        >
          <ThemedText type="small" themeColor="primary">
            Remove
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <ThemedText type="label" themeColor="textMuted">
        Promo code
      </ThemedText>

      <View style={styles.row}>
        <TextInput
          value={code}
          onChangeText={(text) => {
            // Codes are stored and shown uppercase; typing lowercase works
            // either way, but echoing it back capitalised makes it obvious
            // that case is not what is wrong when a code is rejected.
            setCode(text.toUpperCase());
            if (reason) setReason(null);
          }}
          placeholder="SAVE20"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={32}
          accessibilityLabel="Promo code"
          onSubmitEditing={() => void apply(code)}
          returnKeyType="done"
          style={[
            styles.input,
            {
              color: theme.text,
              backgroundColor: theme.surface,
              borderColor: reason ? theme.error : theme.border,
            },
          ]}
        />
        <Pressable
          onPress={() => void apply(code)}
          disabled={validate.isPending}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.applyBtn,
            {
              borderColor: theme.primary,
              opacity: pressed || validate.isPending ? 0.6 : 1,
            },
          ]}
        >
          <ThemedText type="smallBold" themeColor="primary">
            {validate.isPending ? 'Checking…' : 'Apply'}
          </ThemedText>
        </Pressable>
      </View>

      {reason && (
        <ThemedText type="small" themeColor="error">
          {reason}
        </ThemedText>
      )}

      {/* Only what the shop chose to advertise. Unlisted codes still work if
          the customer has one, they simply are not shown here. */}
      {available && available.length > 0 && (
        <View style={styles.offers}>
          {available.map((offer) => (
            <Pressable
              key={offer.id}
              onPress={() => void apply(offer.code)}
              accessibilityRole="button"
              accessibilityLabel={`Apply ${offer.code}, ${summarise(offer)}`}
              style={({ pressed }) => [
                styles.offer,
                { borderColor: theme.border, backgroundColor: theme.surface, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <ThemedText type="caption" themeColor="primary">
                {offer.code}
              </ThemedText>
              <ThemedText type="caption" themeColor="textMuted">
                {summarise(offer)}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    letterSpacing: 1,
  },
  applyBtn: {
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  applied: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  appliedCopy: { flex: 1, gap: 1 },
  offers: { gap: Spacing.two },
  offer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});

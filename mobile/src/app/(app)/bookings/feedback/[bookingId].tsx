import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LoadingScreen } from '@/components/ui/feedback';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useBooking } from '@/hooks/use-booking';
import { useBookingFeedback, useFeedbackTags, useSubmitFeedback } from '@/hooks/use-feedback';
import { useTheme } from '@/hooks/use-theme';

/** What each score means, so the number carries the same sense for everyone. */
const RATING_WORDS = ['', 'Poor', 'Not great', 'Fine', 'Good', 'Excellent'];

function Stars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const theme = useTheme();

  return (
    <View style={styles.stars} accessibilityRole="radiogroup" accessibilityLabel="Rating">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        return (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            accessibilityRole="radio"
            aria-checked={value === n}
            accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}
            // Generous hit area: these are the primary control on the screen
            // and get tapped with a thumb, often one-handed.
            hitSlop={8}
            style={({ pressed }) => [styles.star, pressed && { opacity: 0.7 }]}
          >
            <ThemedText
              style={[styles.starGlyph, { color: filled ? theme.warning : theme.border }]}
            >
              ★
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function FeedbackScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  const { data: booking, isLoading: bookingLoading } = useBooking(bookingId);
  const { data: existing, isLoading: feedbackLoading } = useBookingFeedback(bookingId);
  const { data: tags = [] } = useFeedbackTags(booking?.service_id);
  const submit = useSubmitFeedback();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function toggleTag(tag: string) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function handleSubmit() {
    if (rating === 0) {
      setError('Tap a star to rate the service.');
      return;
    }
    if (!user) return;
    setError(null);

    try {
      await submit.mutateAsync({
        bookingId,
        userId: user.id,
        rating,
        comment,
        tags: selectedTags,
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your review.');
    }
  }

  if (bookingLoading || feedbackLoading) return <LoadingScreen />;

  // Already reviewed: show it back rather than letting them submit a second
  // one and hit the unique constraint as an error.
  if (existing) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
          <ScrollView contentContainerStyle={styles.scroll}>
            <ThemedText type="title">Thanks for the feedback</ThemedText>
            <Card style={styles.summary}>
              <ThemedText style={[styles.starGlyph, { color: theme.warning }]}>
                {'★'.repeat(existing.rating)}
                <ThemedText style={[styles.starGlyph, { color: theme.border }]}>
                  {'★'.repeat(5 - existing.rating)}
                </ThemedText>
              </ThemedText>
              {existing.tags.length > 0 && (
                <ThemedText type="small" themeColor="textMuted">
                  {existing.tags.join(' · ')}
                </ThemedText>
              )}
              {existing.comment && <ThemedText type="body">{existing.comment}</ThemedText>}
            </Card>

            {existing.admin_response && (
              <Card style={[styles.summary, { backgroundColor: theme.primarySoft }]}>
                <ThemedText type="label" themeColor="primary">
                  Our reply
                </ThemedText>
                <ThemedText type="body">{existing.admin_response}</ThemedText>
              </Card>
            )}
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={styles.flex} edges={['left', 'right', 'bottom']}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.head}>
              <ThemedText type="title">How did we do?</ThemedText>
              <ThemedText type="small" themeColor="textMuted">
                {booking?.services?.name ?? 'Your service'} · it takes a few seconds and it tells us
                who to send next time.
              </ThemedText>
            </View>

            <View style={styles.ratingBlock}>
              <Stars value={rating} onChange={(v) => { setRating(v); setError(null); }} />
              {rating > 0 && (
                <ThemedText type="bodyMedium" themeColor="textSecondary">
                  {RATING_WORDS[rating]}
                </ThemedText>
              )}
            </View>

            {tags.length > 0 && (
              <View style={styles.section}>
                <ThemedText type="label" themeColor="textMuted">
                  What stood out? (optional)
                </ThemedText>
                <View style={styles.tagRow}>
                  {tags.map((tag) => {
                    const on = selectedTags.includes(tag);
                    return (
                      <Pressable
                        key={tag}
                        onPress={() => toggleTag(tag)}
                        accessibilityRole="checkbox"
                        aria-checked={on}
                        style={({ pressed }) => [
                          styles.tag,
                          {
                            backgroundColor: on ? theme.primarySoft : theme.surface,
                            borderColor: on ? theme.primary : theme.border,
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}
                      >
                        <ThemedText type="small" themeColor={on ? 'primary' : 'textSecondary'}>
                          {tag}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={styles.section}>
              <ThemedText type="label" themeColor="textMuted">
                Anything else? (optional)
              </ThemedText>
              {/* No minimum length. A two-star with no words is still signal,
                  and demanding an explanation loses the review entirely. */}
              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder="Tell us what went well, or what didn't"
                placeholderTextColor={theme.textMuted}
                multiline
                accessibilityLabel="Comment"
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface },
                ]}
              />
            </View>

            {error && (
              <ThemedText type="small" themeColor="error">
                {error}
              </ThemedText>
            )}

            <Button
              label={submit.isPending ? 'Sending…' : 'Send feedback'}
              loading={submit.isPending}
              onPress={handleSubmit}
            />
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  head: { gap: Spacing.one },
  ratingBlock: { alignItems: 'center', gap: Spacing.two },
  stars: { flexDirection: 'row', gap: Spacing.two },
  star: { padding: Spacing.one },
  starGlyph: { fontSize: 36, lineHeight: 42 },
  section: { gap: Spacing.two },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tag: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  summary: { gap: Spacing.two },
});

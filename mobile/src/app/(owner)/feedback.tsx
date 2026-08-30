import { useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReplySheet } from '@/components/owner/reply-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/feedback';
import { Radius, Spacing } from '@/constants/theme';
import {
  useOwnerFeedback,
  useReplyToReview,
  useSetReviewPublished,
  type OwnerReview,
} from '@/hooks/use-owner-feedback';
import { useTheme } from '@/hooks/use-theme';
import {
  averageRating,
  countNeedingReply,
  filterReviews,
  needsReply,
  publishedOnly,
  starsOf,
  type ReviewFilter,
} from '@/lib/feedback-board';

const DATE = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const FILTERS: ReviewFilter[] = ['Needs reply', 'Low ratings', 'All'];

export default function OwnerFeedbackScreen() {
  const theme = useTheme();
  const [filter, setFilter] = useState<ReviewFilter>('Needs reply');
  const [replyTo, setReplyTo] = useState<OwnerReview | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch, isRefetching } = useOwnerFeedback();
  const reply = useReplyToReview();
  const setPublished = useSetReviewPublished();

  const summary = useMemo(
    () => ({
      average: averageRating(data),
      count: publishedOnly(data).length,
      owing: countNeedingReply(data),
      rows: filterReviews(data, filter),
    }),
    [data, filter],
  );

  async function run(fn: () => Promise<unknown>) {
    setProblem(null);
    try {
      await fn();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'That did not work.');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
          }
        >
          <View style={styles.header}>
            <ThemedText type="title">Feedback</ThemedText>
          </View>

          {isLoading ? (
            <View style={styles.body}>
              <SkeletonList count={3} height={110} />
            </View>
          ) : isError ? (
            <View style={styles.body}>
              <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
            </View>
          ) : (
            <>
              <View style={styles.body}>
                <Card style={styles.summary}>
                  <View style={styles.summaryRow}>
                    <View>
                      <ThemedText type="caption" themeColor="textMuted">
                        Average
                      </ThemedText>
                      {/* No reviews is not a bad score — the dash says so
                          rather than claiming 0.0 stars. */}
                      <ThemedText type="price">
                        {summary.average === null ? '—' : summary.average.toFixed(1)}
                      </ThemedText>
                    </View>
                    <View style={styles.summaryRight}>
                      <ThemedText type="body" themeColor="warning">
                        {summary.average === null ? '☆☆☆☆☆' : starsOf(summary.average)}
                      </ThemedText>
                      <ThemedText type="caption" themeColor="textMuted">
                        {summary.count} {summary.count === 1 ? 'review' : 'reviews'}
                      </ThemedText>
                    </View>
                  </View>

                  <ThemedText
                    type="small"
                    themeColor={summary.owing > 0 ? 'error' : 'success'}
                  >
                    {summary.owing > 0
                      ? `${summary.owing} low rating${summary.owing > 1 ? 's need' : ' needs'} a reply`
                      : 'Everything answered'}
                  </ThemedText>
                </Card>
              </View>

              <View style={styles.filters}>
                {FILTERS.map((f) => {
                  const on = filter === f;
                  return (
                    <Pressable
                      key={f}
                      onPress={() => setFilter(f)}
                      accessibilityRole="button"
                      aria-selected={on}
                      style={({ pressed }) => [
                        styles.chip,
                        {
                          backgroundColor: on ? theme.text : theme.surface,
                          borderColor: on ? theme.text : theme.border,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{ color: on ? theme.background : theme.textSecondary }}
                      >
                        {f}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              {problem && (
                <View style={styles.body}>
                  <ThemedText type="small" themeColor="error">
                    {problem}
                  </ThemedText>
                </View>
              )}

              <View style={styles.list}>
                {summary.rows.length === 0 ? (
                  <EmptyState
                    title={filter === 'Needs reply' ? 'Nothing waiting' : 'No reviews here'}
                    description={
                      filter === 'Needs reply'
                        ? 'Every low rating has an answer.'
                        : 'Reviews appear once customers rate a finished job.'
                    }
                  />
                ) : (
                  summary.rows.map((r) => (
                    <ReviewCard
                      key={r.id}
                      review={r}
                      onReply={() => setReplyTo(r)}
                      onHide={() => void run(() => setPublished.mutateAsync({ id: r.id, published: false }))}
                      busy={setPublished.isPending}
                    />
                  ))
                )}
              </View>
            </>
          )}
        </ScrollView>

        {replyTo && (
          <ReplySheet
            visible
            customer={replyTo.profiles?.name ?? 'the customer'}
            rating={replyTo.rating}
            service={replyTo.services?.name ?? 'Service'}
            comment={replyTo.comment}
            busy={reply.isPending}
            onClose={() => setReplyTo(null)}
            onSend={(text) =>
              void run(async () => {
                await reply.mutateAsync({ id: replyTo.id, reply: text });
                setReplyTo(null);
              })
            }
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function ReviewCard({
  review,
  onReply,
  onHide,
  busy,
}: {
  review: OwnerReview;
  onReply: () => void;
  onHide: () => void;
  busy?: boolean;
}) {
  const theme = useTheme();
  const open = needsReply(review);
  const customer = review.profiles?.name ?? 'Unnamed customer';
  const phone = review.profiles?.phone ?? null;

  return (
    <Card
      style={
        // Outlined only while it is still owed an answer, so the queue is
        // visible without reading every card.
        open ? { ...styles.card, borderWidth: 1, borderColor: theme.error } : styles.card
      }
    >
      <View style={styles.cardHead}>
        <ThemedText type="body" themeColor={review.rating <= 2 ? 'error' : 'warning'}>
          {starsOf(review.rating)}
        </ThemedText>
        <ThemedText type="caption" themeColor="textMuted">
          {DATE.format(new Date(review.created_at))}
        </ThemedText>
      </View>

      <ThemedText type="smallBold" numberOfLines={1}>
        {review.services?.name ?? 'Service'}
      </ThemedText>
      <ThemedText type="caption" themeColor="textMuted">
        {[customer, review.technicians?.name].filter(Boolean).join(' · ')}
      </ThemedText>

      {review.comment ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.comment}>
          {review.comment}
        </ThemedText>
      ) : null}

      {review.tags.length > 0 && (
        <ThemedText type="caption" themeColor="textMuted">
          {review.tags.join(' · ')}
        </ThemedText>
      )}

      {review.admin_response ? (
        <View style={[styles.reply, { backgroundColor: theme.surfaceSunk }]}>
          <ThemedText type="caption" themeColor="textMuted">
            You replied
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {review.admin_response}
          </ThemedText>
        </View>
      ) : (
        <View style={styles.actions}>
          <Pressable onPress={onReply} accessibilityRole="button" hitSlop={6}>
            <ThemedText type="smallBold" themeColor="primary">
              Reply
            </ThemedText>
          </Pressable>
          {phone ? (
            <Pressable
              onPress={() => Linking.openURL(`tel:${phone.replace(/\s/g, '')}`)}
              accessibilityRole="button"
              accessibilityLabel={`Call ${customer}`}
              hitSlop={6}
            >
              <ThemedText type="smallBold" themeColor="primary">
                Call
              </ThemedText>
            </Pressable>
          ) : null}
          <Pressable onPress={onHide} accessibilityRole="button" disabled={busy} hitSlop={6}>
            <ThemedText type="smallBold" themeColor="textMuted">
              Hide
            </ThemedText>
          </Pressable>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: { paddingBottom: Spacing.six },
  header: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  body: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  summary: { gap: Spacing.two },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  summaryRight: { alignItems: 'flex-end' },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  list: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: Spacing.two },
  card: { gap: Spacing.one },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  comment: { marginTop: 2 },
  reply: { borderRadius: Radius.md, padding: Spacing.two, gap: 1, marginTop: Spacing.one },
  actions: { flexDirection: 'row', gap: Spacing.four, marginTop: Spacing.one },
});

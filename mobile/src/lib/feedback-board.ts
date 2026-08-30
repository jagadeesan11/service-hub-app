/**
 * Reading a pile of reviews the way a shop owner needs to.
 *
 * Pure and dependency-free: which review is still owed an answer, and what the
 * shop's average actually is, are the two numbers that drive the screen.
 */

export interface BoardReview {
  id: string;
  rating: number;
  comment: string | null;
  admin_response: string | null;
  is_published: boolean;
  created_at: string;
}

/** At or below this, a review is a complaint rather than a score. */
export const LOW_RATING = 2;
/** At or below this, it is worth an owner's attention even if not a complaint. */
export const MEDIOCRE_RATING = 3;

/**
 * A review nobody has answered.
 *
 * Only counts published ones: a hidden review is out of the shop's window, and
 * chasing a reply for something customers cannot see is busywork.
 */
export function needsReply(f: BoardReview): boolean {
  return f.is_published && f.rating <= LOW_RATING && !f.admin_response;
}

export function publishedOnly<T extends BoardReview>(list: T[] | undefined): T[] {
  return (list ?? []).filter((f) => f.is_published);
}

/**
 * The shop's average, over published reviews only.
 *
 * Returns null rather than 0 for an empty list — "0.0 stars" is a claim about
 * the shop, and no reviews is not the same as bad ones.
 */
export function averageRating(list: BoardReview[] | undefined): number | null {
  const published = publishedOnly(list);
  if (published.length === 0) return null;
  const total = published.reduce((n, f) => n + f.rating, 0);
  return Math.round((total / published.length) * 10) / 10;
}

export function countNeedingReply(list: BoardReview[] | undefined): number {
  return (list ?? []).filter(needsReply).length;
}

export type ReviewFilter = 'Needs reply' | 'Low ratings' | 'All';

export function filterReviews<T extends BoardReview>(
  list: T[] | undefined,
  filter: ReviewFilter,
): T[] {
  const published = publishedOnly(list);
  if (filter === 'Needs reply') return published.filter(needsReply);
  if (filter === 'Low ratings') return published.filter((f) => f.rating <= MEDIOCRE_RATING);
  return published;
}

/** Five glyphs, always — a partial row would read as a missing rating. */
export function starsOf(rating: number): string {
  const n = Math.max(0, Math.min(5, Math.round(rating)));
  return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
}

/**
 * Replies a shop can send without composing one from scratch.
 *
 * Offered rather than sent: each is a starting point that lands in the box for
 * editing. A complaint answered with visibly canned words is worse than a slow
 * reply, so nothing here is ever sent untouched.
 */
export const CANNED_REPLIES = [
  'Sorry about the wait — that slot overran and we should have called you. Your next service is on us.',
  'Thank you for telling us. We are re-checking the work and will call you today to set it right.',
  'Glad you liked it. Bring it in for a free top-up wash any time this month.',
];

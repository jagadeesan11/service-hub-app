import { PageHeader } from '@/components/page-header';
import { FeedbackList } from '@/components/feedback/feedback-list';
import { createClient } from '@/lib/supabase/server';
import type { FeedbackListItem } from '@/types/feedback';

export default async function FeedbackPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('service_feedback')
    .select(
      `id, booking_id, rating, comment, tags, is_published, admin_response, responded_at, created_at,
       services(name), technicians(name), profiles(name, phone)`,
    )
    .order('created_at', { ascending: false })
    .returns<FeedbackListItem[]>();

  return (
    <div>
      <PageHeader
        title="Feedback"
        description="What customers said after the work was done. Low ratings come first — an unanswered one-star is the thing worth acting on today."
      />

      {error ? (
        <p className="text-sm text-destructive">Failed to load feedback: {error.message}</p>
      ) : (
        <FeedbackList initialFeedback={data ?? []} />
      )}
    </div>
  );
}

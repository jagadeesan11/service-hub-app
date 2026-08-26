'use client';

import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { FeedbackListItem } from '@/types/feedback';

const DATE = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

type Filter = 'needs_attention' | 'all';

function Stars({ rating }: { rating: number }) {
  return (
    <span
      className={cn(
        'text-sm tabular-nums',
        rating <= 2 ? 'text-destructive' : 'text-muted-foreground',
      )}
      aria-label={`${rating} out of 5`}
    >
      <span aria-hidden>{'★'.repeat(rating)}</span>
      <span aria-hidden className="opacity-30">
        {'★'.repeat(5 - rating)}
      </span>
    </span>
  );
}

export function FeedbackList({ initialFeedback }: { initialFeedback: FeedbackListItem[] }) {
  const [feedback, setFeedback] = useState(initialFeedback);
  // Defaults to the queue, not the archive. Browsing every review is the rare
  // case; answering an unhappy customer today is the job.
  const [filter, setFilter] = useState<Filter>('needs_attention');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsAttention = useMemo(
    () => feedback.filter((f) => f.rating <= 2 && !f.responded_at),
    [feedback],
  );
  const shown = filter === 'needs_attention' ? needsAttention : feedback;

  async function patch(id: string, patchBody: Partial<FeedbackListItem>) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('service_feedback')
      .update(patchBody)
      .eq('id', id);
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return false;
    }
    setFeedback((prev) => prev.map((f) => (f.id === id ? { ...f, ...patchBody } : f)));
    return true;
  }

  async function sendReply(id: string) {
    if (!replyText.trim()) return;
    const ok = await patch(id, {
      admin_response: replyText.trim(),
      responded_at: new Date().toISOString(),
    });
    if (ok) {
      setReplyingTo(null);
      setReplyText('');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={filter === 'needs_attention' ? 'default' : 'outline'}
          onClick={() => setFilter('needs_attention')}
        >
          Needs attention
          {needsAttention.length > 0 && (
            <span className="ml-1.5 rounded-full bg-background/25 px-1.5 text-xs tabular-nums">
              {needsAttention.length}
            </span>
          )}
        </Button>
        <Button
          size="sm"
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
        >
          All ({feedback.length})
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {shown.length === 0 ? (
        <p className="rounded-lg border border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {filter === 'needs_attention'
            ? 'Nothing needs attention. Every low rating has been answered.'
            : 'No feedback yet. Reviews appear here once a completed job is rated.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((item) => (
            <li
              key={item.id}
              className={cn(
                'rounded-lg border bg-card p-4',
                item.rating <= 2 ? 'border-destructive/40' : 'border-border',
                !item.is_published && 'opacity-60',
              )}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <Stars rating={item.rating} />
                  <span className="text-sm font-medium">{item.services?.name ?? 'Service'}</span>
                  {item.technicians?.name && (
                    <span className="text-xs text-muted-foreground">
                      by {item.technicians.name}
                    </span>
                  )}
                  {!item.is_published && <Badge variant="outline">Hidden</Badge>}
                </div>
                <span className="text-xs text-muted-foreground">
                  {DATE.format(new Date(item.created_at))}
                </span>
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                {item.profiles?.name ?? 'Customer'}
                {item.profiles?.phone && ` · ${item.profiles.phone}`}
              </p>

              {item.tags.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">{item.tags.join(' · ')}</p>
              )}

              {item.comment && <p className="mt-2 text-sm">{item.comment}</p>}

              {item.admin_response ? (
                <div className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2">
                  <p className="text-xs font-semibold text-muted-foreground">Your reply</p>
                  <p className="mt-0.5 text-sm">{item.admin_response}</p>
                </div>
              ) : replyingTo === item.id ? (
                <div className="mt-3 space-y-2">
                  <Textarea
                    rows={3}
                    autoFocus
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="The customer sees this in the app."
                  />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={busy} onClick={() => sendReply(item.id)}>
                      {busy ? 'Sending…' : 'Send reply'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReplyingTo(null);
                        setReplyText('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={item.rating <= 2 ? 'default' : 'outline'}
                    onClick={() => {
                      setReplyingTo(item.id);
                      setReplyText('');
                    }}
                  >
                    Reply
                  </Button>
                  {/* Hidden, never deleted — pulling an abusive comment must
                      not quietly improve the average. */}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => patch(item.id, { is_published: !item.is_published })}
                  >
                    {item.is_published ? 'Hide' : 'Unhide'}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

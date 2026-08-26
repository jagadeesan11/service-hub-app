'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';

import {
  deleteSupportRequest,
  saveSupportNote,
  setSupportStatus,
} from '@/app/(dashboard)/support/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { AccountMatch, SupportRequest, SupportStatus } from '@/types/support';

const DATE = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

const STATUS_LABELS: Record<SupportStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
};

const STATUS_VARIANTS: Record<SupportStatus, 'warning' | 'default' | 'success'> = {
  open: 'warning',
  in_progress: 'default',
  resolved: 'success',
};

const FILTERS = [
  { key: 'waiting', label: 'Waiting' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'all', label: 'All' },
] as const;

type Filter = (typeof FILTERS)[number]['key'];

export function SupportQueue({
  initialRequests,
  matches,
}: {
  initialRequests: SupportRequest[];
  matches: Record<string, AccountMatch>;
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [filter, setFilter] = useState<Filter>('waiting');
  const [error, setError] = useState<string | null>(null);

  const visible = requests.filter((r) =>
    filter === 'all'
      ? true
      : filter === 'resolved'
        ? r.status === 'resolved'
        : r.status !== 'resolved',
  );

  function applyStatus(id: string, status: SupportStatus) {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(({ key, label }) => {
          const count =
            key === 'all'
              ? requests.length
              : key === 'resolved'
                ? requests.filter((r) => r.status === 'resolved').length
                : requests.filter((r) => r.status !== 'resolved').length;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={
                filter === key
                  ? 'rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground'
                  : 'rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted'
              }
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {visible.length === 0 ? (
        <p className="rounded-lg border border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Nothing here. Requests arrive when a customer taps &ldquo;Trouble signing in?&rdquo; in the
          app.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              match={matches[request.id]}
              onStatus={applyStatus}
              onRemoved={(id) => setRequests((prev) => prev.filter((r) => r.id !== id))}
              onError={setError}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function RequestCard({
  request,
  match,
  onStatus,
  onRemoved,
  onError,
}: {
  request: SupportRequest;
  match?: AccountMatch;
  onStatus: (id: string, status: SupportStatus) => void;
  onRemoved: (id: string) => void;
  onError: (message: string | null) => void;
}) {
  const [note, setNote] = useState(request.admin_note ?? '');
  const [noteSaved, setNoteSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; message?: string }>, after?: () => void) {
    onError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) onError(result.message ?? 'That did not work.');
      else after?.();
    });
  }

  const isResolved = request.status === 'resolved';
  const noteId = 'note-' + request.id;

  return (
    <li className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium break-all">{request.contact_raw}</span>
        <Badge variant={STATUS_VARIANTS[request.status]}>{STATUS_LABELS[request.status]}</Badge>
        {request.kind === 'password_reset' && <Badge variant="outline">Cannot sign in</Badge>}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {DATE.format(new Date(request.created_at))}
      </p>

      {request.message && (
        <p className="mt-3 text-sm whitespace-pre-wrap text-muted-foreground">{request.message}</p>
      )}

      {/* The reason the queue exists: which account is this, and where do I go
          to fix it. Without the match an admin is left searching by hand. */}
      <div className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-sm">
        {match ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-muted-foreground">Matches account</span>
            <span className="font-medium">{match.name ?? 'Unnamed'}</span>
            <span className="break-all text-muted-foreground">({match.identity})</span>
            <Link href="/users" className="text-primary underline-offset-4 hover:underline">
              Set a new password
            </Link>
          </div>
        ) : (
          <span className="text-muted-foreground">
            No account matches this contact. They may have typed it differently, or never signed up.
          </span>
        )}
      </div>

      <div className="mt-3">
        <label htmlFor={noteId} className="text-xs text-muted-foreground">
          Internal note
        </label>
        <Textarea
          id={noteId}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setNoteSaved(false);
          }}
          rows={2}
          maxLength={2000}
          placeholder="What you did, or what you still need from them."
          className="mt-1"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {request.status === 'open' && (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() =>
              run(
                () => setSupportStatus(request.id, 'in_progress'),
                () => onStatus(request.id, 'in_progress'),
              )
            }
          >
            Start
          </Button>
        )}

        {isResolved ? (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() =>
              run(
                () => setSupportStatus(request.id, 'open'),
                () => onStatus(request.id, 'open'),
              )
            }
          >
            Reopen
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={isPending}
            onClick={() =>
              run(
                () => setSupportStatus(request.id, 'resolved'),
                () => onStatus(request.id, 'resolved'),
              )
            }
          >
            Mark resolved
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          disabled={isPending || note === (request.admin_note ?? '')}
          onClick={() => run(() => saveSupportNote(request.id, note), () => setNoteSaved(true))}
        >
          {noteSaved ? 'Note saved' : 'Save note'}
        </Button>

        <Button
          size="sm"
          variant="destructive"
          disabled={isPending}
          className="ml-auto"
          onClick={() => run(() => deleteSupportRequest(request.id), () => onRemoved(request.id))}
        >
          Delete
        </Button>
      </div>
    </li>
  );
}

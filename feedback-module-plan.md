# Feedback Module — Plan

Ratings and comments on completed jobs, for Nexora. Written to be built in
four shippable slices; slice A is useful on its own.

## 1. Why it exists

Three different people need something from this, and they need different things:

| Who | Needs |
| --- | --- |
| Customer | To be heard when a job goes wrong, without hunting for a phone number |
| Admin | To know which technician or service is generating complaints, before the reviews go public somewhere you don't control |
| Technician | A fair record of their work — the thing that makes ratings acceptable to staff rather than a stick |

Design consequence: a 1-star rating is an **operational alert**, not a data point.
If nothing happens when someone taps one star, the module is decoration.

## 2. Data model

```sql
create table public.service_feedback (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Snapshotted at submit time, not joined at read time: a booking's
  -- technician can be reassigned afterwards, and the review belongs to
  -- whoever actually did the work.
  service_id uuid not null references public.services(id) on delete restrict,
  technician_id uuid references public.technicians(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  tags text[] not null default '{}',
  -- Soft hide rather than delete, so an abusive comment can be pulled
  -- without quietly improving the average.
  is_published boolean not null default true,
  admin_response text,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`unique (booking_id)` — one job, one review. Not one per customer, not one per
service: the unit of work is the booking, and that is also what makes
"have they reviewed this yet?" a single index lookup.

Denormalised aggregates, maintained by an `after insert/update/delete` trigger:

```sql
alter table public.services    add column rating_avg numeric(3,2), add column rating_count integer not null default 0;
alter table public.technicians add column rating_avg numeric(3,2), add column rating_count integer not null default 0;
```

The catalog is read on every app open and reviews are written a few times a
day. Computing the average on read would be the wrong trade. A view would also
work, but it either leaks individual rows through RLS or needs
`security definer` — the counters avoid that question entirely.

### RLS

| Action | Rule |
| --- | --- |
| insert | `user_id = auth.uid()` **and** the booking is theirs **and** `bookings.status = 'completed'` |
| select | own row, admin, or the technician it names |
| update | own row for 7 days (trigger-enforced); admin any time |
| delete | admin only |

`is_published`, `admin_response` and `responded_at` must be admin-only columns.
RLS gates rows, not columns — so this needs a trigger, exactly like
`prevent_self_role_escalation` on `profiles`. **This is the part most likely to
be got wrong**: without it, a customer can publish their own admin response.

The "booking must be completed" check also belongs in a trigger rather than the
policy, so the error message can say *why* instead of failing as a policy
violation.

## 3. Mobile

**Entry points, in order of how many reviews each will actually produce:**

1. **Push on completion** — "How did we do?" deep-linking to the rating screen.
   Reuses `send-booking-notification`, which already fires on `completed`.
2. **Booking detail** — a "Rate this service" card when the booking is
   completed and unreviewed; the same card shows the submitted rating after.
3. **Bookings list** — a small unobtrusive prompt on completed rows.

**Rating screen** (`/(app)/bookings/[bookingId]/feedback`):

- 5 tappable stars, large hit targets, `accessibilityRole="radio"` per star
- Quick-pick tag chips — **sourced from the category**, see §6
- Optional comment, no minimum length (a 2-star with no words is still signal)
- One submit; on success, replace with a thank-you and what they said

**One reminder, 24 hours later, and never again.** Two nudges for a review is
the point at which a service app starts feeling like spam.

## 4. Admin

- **New "Feedback" nav item** — table of rating, service, technician, comment,
  date. Filter by rating, service, technician. Row actions: unpublish, respond.
- **Low-rating queue** — default the list to ≤2 stars and unanswered. That is
  the screen someone should open every morning; everything else is browsing.
- **Dashboard tile** — 30-day average and count, plus a count of unanswered
  low ratings, which is the number that should make someone act.
- **Technician detail** — their average, count, and recent comments. This is
  where feedback stops being a report and starts changing dispatch.

Show `rating_count` next to every average, and suppress the average entirely
below three reviews. One bad first job should not brand a technician at 1.0.

## 5. Notifications

| Event | Who | Channel |
| --- | --- | --- |
| Booking completed | Customer | Push — "How did we do?" |
| 24h, still unreviewed | Customer | Push, once |
| Rating ≤ 2 submitted | Admin | Push + surfaced in the low-rating queue |
| Admin responds | Customer | Push — closes the loop, and it's the cheapest way to turn a 2-star into a retained customer |

## 6. Keeping it config-driven

The build plan's validation checkpoint says a new vertical should launch from
admin entries alone. Hard-coding "Was the finish smooth?" would break that the
first time you add home cleaning.

Add `feedback_tags text[]` to `categories`, edited in the category form. Car
care gets *Finish quality · Punctuality · Cleanliness · Value*; home cleaning
gets its own set; the rating screen renders whatever is there. No new
`input_template` machinery is needed — these are flat labels, not typed fields.

## 7. Slices

| Slice | Contents | Ships on its own? |
| --- | --- | --- |
| **A — Core** | Table, RLS, column-guard trigger, rating screen, booking-detail entry point, admin list | Yes — feedback is captured and readable |
| **B — Signal** | Aggregate trigger, averages on services/technicians, dashboard tile, technician detail | Yes |
| **C — Loop** | Completion push, 24h reminder, low-rating alert, admin response shown in app | Yes |
| **D — Config** | `categories.feedback_tags` + category form field | Yes |

Build A and C before B. Averages over a handful of reviews are noise; the
prompt-and-respond loop is what produces the volume that makes B mean anything.

## 8. Decisions to make before slice A

1. **Edit window** — 7 days is the assumption above. Longer means averages keep
   moving under you; shorter feels punitive.
2. **Who gets rated** — the assumption above is one rating covering the whole
   job. Separate service and technician ratings gets better data and noticeably
   fewer responses.
3. **Public or internal** — the plan treats reviews as internal. Showing them on
   service listings is a different product decision, and it changes the
   moderation burden from "occasionally" to "always".
4. **Cancelled and no-show jobs** — not reviewable here. Worth confirming, since
   a customer whose technician never arrived arguably has the most to say.

## 9. Known traps

- **The column guard.** Ratings without it are self-serve PR for whoever reads
  the docs.
- **Aggregate trigger recursion** — writing to `services` fires that table's
  `set_updated_at`. Harmless, but the trigger must not itself write to
  `service_feedback`.
- **Reassignment after review** — snapshot `technician_id` on submit; do not
  join through `bookings` at read time.
- **Deleting a service with reviews** — `on delete restrict`, or the averages
  and the history disappear together.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  createPromoCode,
  deletePromoCode,
  setPromoActive,
  updatePromoCode,
} from '@/app/(dashboard)/promo-codes/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { PromoCodeWithUsage } from '@/types/promo';

const PRICE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const DATE = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

type Named = { id: string; name: string };

/** A code's real state, which is not the same as its is_active flag. */
function statusOf(c: PromoCodeWithUsage): { label: string; variant: 'success' | 'warning' | 'outline' | 'destructive' } {
  if (!c.is_active) return { label: 'Off', variant: 'outline' };
  const now = Date.now();
  if (c.starts_at && new Date(c.starts_at).getTime() > now) return { label: 'Scheduled', variant: 'warning' };
  if (c.ends_at && new Date(c.ends_at).getTime() < now) return { label: 'Expired', variant: 'destructive' };
  if (c.max_redemptions !== null && c.redeemed >= c.max_redemptions) {
    return { label: 'Fully claimed', variant: 'destructive' };
  }
  return { label: 'Live', variant: 'success' };
}

function describe(c: PromoCodeWithUsage): string {
  const off =
    c.discount_type === 'percentage'
      ? `${c.discount_value}% off` + (c.max_discount_amount ? `, up to ${PRICE.format(c.max_discount_amount)}` : '')
      : `${PRICE.format(c.discount_value)} off`;
  const min = c.min_order_value > 0 ? ` on bookings over ${PRICE.format(c.min_order_value)}` : '';
  return off + min;
}

/** datetime-local wants YYYY-MM-DDTHH:mm in local time, not an ISO string. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PromoCodesManager({
  initialCodes,
  categories,
  services,
}: {
  initialCodes: PromoCodeWithUsage[];
  categories: Named[];
  services: Named[];
}) {
  const router = useRouter();
  const [codes] = useState(initialCodes);
  const [editing, setEditing] = useState<PromoCodeWithUsage | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<{ ok: boolean; message?: string }>, done?: () => void) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? 'That did not work.');
      return;
    }
    done?.();
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {codes.length} {codes.length === 1 ? 'code' : 'codes'}
        </p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setError(null);
            setOpen(true);
          }}
        >
          New code
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {codes.length === 0 ? (
        <p className="rounded-lg border border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No promo codes yet. Create one and it becomes available in the app straight away.
        </p>
      ) : (
        <ul className="space-y-3">
          {codes.map((c) => {
            const status = statusOf(c);
            return (
              <li key={c.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded bg-muted px-2 py-0.5 font-mono text-sm font-semibold">
                    {c.code}
                  </code>
                  <Badge variant={status.variant}>{status.label}</Badge>
                  {!c.is_public && <Badge variant="outline">Unlisted</Badge>}
                </div>

                <p className="mt-1.5 text-sm">{describe(c)}</p>
                {c.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{c.description}</p>
                )}

                <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  <div>
                    <dt className="inline">Used </dt>
                    <dd className="inline tabular-nums">
                      {c.redeemed}
                      {c.max_redemptions !== null ? ` of ${c.max_redemptions}` : ''}
                      {c.discounted_total > 0 ? ` · ${PRICE.format(c.discounted_total)} given` : ''}
                    </dd>
                  </div>
                  {c.per_customer_limit !== null && (
                    <div>
                      <dt className="inline">Per customer </dt>
                      <dd className="inline tabular-nums">{c.per_customer_limit}</dd>
                    </div>
                  )}
                  {(c.starts_at || c.ends_at) && (
                    <div>
                      <dt className="inline">Window </dt>
                      <dd className="inline">
                        {c.starts_at ? DATE.format(new Date(c.starts_at)) : 'any time'} –{' '}
                        {c.ends_at ? DATE.format(new Date(c.ends_at)) : 'no end'}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="inline">Applies to </dt>
                    <dd className="inline">
                      {c.applies_to === 'all'
                        ? 'everything'
                        : c.applies_to === 'category'
                          ? categories
                              .filter((x) => c.category_ids.includes(x.id))
                              .map((x) => x.name)
                              .join(', ') || 'selected categories'
                          : services
                              .filter((x) => c.service_ids.includes(x.id))
                              .map((x) => x.name)
                              .join(', ') || 'selected services'}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void run(() => setPromoActive(c.id, !c.is_active))}
                  >
                    {c.is_active ? 'Switch off' : 'Switch on'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setEditing(c);
                      setError(null);
                      setOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="ml-auto"
                    disabled={busy}
                    onClick={() => void run(() => deletePromoCode(c.id))}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setError(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              void run(
                () => (editing ? updatePromoCode(fd) : createPromoCode(fd)),
                () => setOpen(false),
              );
            }}
          >
            <DialogHeader>
              <DialogTitle>{editing ? `Edit ${editing.code}` : 'New promo code'}</DialogTitle>
              <DialogDescription>
                Customers type this before paying. It is checked again when the booking is created,
                so a code that expires in between is refused rather than silently ignored.
              </DialogDescription>
            </DialogHeader>

            <PromoForm code={editing} categories={categories} services={services} />

            {error && <p className="mb-2 text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving…' : editing ? 'Save changes' : 'Create code'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PromoForm({
  code,
  categories,
  services,
}: {
  code: PromoCodeWithUsage | null;
  categories: Named[];
  services: Named[];
}) {
  const [discountType, setDiscountType] = useState(code?.discount_type ?? 'percentage');
  const [appliesTo, setAppliesTo] = useState(code?.applies_to ?? 'all');

  return (
    <div className="space-y-3 py-3">
      {code && <input type="hidden" name="id" value={code.id} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="code" className="mb-1.5">
            Code
          </Label>
          <Input
            id="code"
            name="code"
            defaultValue={code?.code ?? ''}
            required
            placeholder="SAVE20"
            className="font-mono uppercase"
          />
        </div>
        <div>
          <Label htmlFor="discount_type" className="mb-1.5">
            Type
          </Label>
          {/* A native select: this form is submitted as FormData, and the
              styled Select keeps its value in React state instead. */}
          <select
            id="discount_type"
            name="discount_type"
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as typeof discountType)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed amount</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="discount_value" className="mb-1.5">
            {discountType === 'percentage' ? 'Percent off' : 'Amount off (₹)'}
          </Label>
          <Input
            id="discount_value"
            name="discount_value"
            type="number"
            min="1"
            step="1"
            defaultValue={code?.discount_value ?? ''}
            required
          />
        </div>
        {discountType === 'percentage' && (
          <div>
            <Label htmlFor="max_discount_amount" className="mb-1.5">
              Cap the discount at (₹)
            </Label>
            <Input
              id="max_discount_amount"
              name="max_discount_amount"
              type="number"
              min="1"
              defaultValue={code?.max_discount_amount ?? ''}
              placeholder="No cap"
            />
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="min_order_value" className="mb-1.5">
            Minimum booking (₹)
          </Label>
          <Input
            id="min_order_value"
            name="min_order_value"
            type="number"
            min="0"
            defaultValue={code?.min_order_value ?? 0}
          />
        </div>
        <div>
          <Label htmlFor="max_redemptions" className="mb-1.5">
            Total uses
          </Label>
          <Input
            id="max_redemptions"
            name="max_redemptions"
            type="number"
            min="1"
            defaultValue={code?.max_redemptions ?? ''}
            placeholder="Unlimited"
          />
        </div>
        <div>
          <Label htmlFor="per_customer_limit" className="mb-1.5">
            Per customer
          </Label>
          <Input
            id="per_customer_limit"
            name="per_customer_limit"
            type="number"
            min="1"
            defaultValue={code?.per_customer_limit ?? 1}
            placeholder="Unlimited"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="starts_at" className="mb-1.5">
            Starts
          </Label>
          <Input
            id="starts_at"
            name="starts_at"
            type="datetime-local"
            defaultValue={toLocalInput(code?.starts_at ?? null)}
          />
        </div>
        <div>
          <Label htmlFor="ends_at" className="mb-1.5">
            Ends
          </Label>
          <Input
            id="ends_at"
            name="ends_at"
            type="datetime-local"
            defaultValue={toLocalInput(code?.ends_at ?? null)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="applies_to" className="mb-1.5">
          Applies to
        </Label>
        <select
          id="applies_to"
          name="applies_to"
          value={appliesTo}
          onChange={(e) => setAppliesTo(e.target.value as typeof appliesTo)}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="all">Everything</option>
          <option value="category">Chosen categories</option>
          <option value="service">Chosen services</option>
        </select>
      </div>

      {appliesTo !== 'all' && (
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
          {(appliesTo === 'category' ? categories : services).map((item) => (
            <label key={item.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={appliesTo === 'category' ? 'category_ids' : 'service_ids'}
                value={item.id}
                defaultChecked={
                  appliesTo === 'category'
                    ? code?.category_ids.includes(item.id)
                    : code?.service_ids.includes(item.id)
                }
              />
              {item.name}
            </label>
          ))}
        </div>
      )}

      <div>
        <Label htmlFor="description" className="mb-1.5">
          Description
        </Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          maxLength={200}
          defaultValue={code?.description ?? ''}
          placeholder="Shown to customers alongside the code."
        />
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_active" defaultChecked={code?.is_active ?? true} />
          Active
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_public" defaultChecked={code?.is_public ?? true} />
          List it in the app
          <span className="text-xs text-muted-foreground">
            — unlisted codes still work, they just aren&rsquo;t advertised
          </span>
        </label>
      </div>
    </div>
  );
}

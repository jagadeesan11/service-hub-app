'use client';

import Link from 'next/link';
import { useState } from 'react';

import { ServiceIcon } from '@/components/service-icon';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createClient } from '@/lib/supabase/client';
import type { ServiceWithCategory } from '@/types/database';

const PRICE_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function ServicesTable({ initialServices }: { initialServices: ServiceWithCategory[] }) {
  const [services, setServices] = useState(initialServices);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggleActive(service: ServiceWithCategory) {
    const nextValue = !service.is_active;
    setServices((prev) =>
      prev.map((s) => (s.id === service.id ? { ...s, is_active: nextValue } : s)),
    );
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('services')
      .update({ is_active: nextValue })
      .eq('id', service.id);

    if (updateError) {
      setServices((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, is_active: service.is_active } : s)),
      );
      setError(updateError.message);
    }
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    const removed = services.find((s) => s.id === id);

    setServices((prev) => prev.filter((s) => s.id !== id));
    setPendingDeleteId(null);
    setError(null);

    const supabase = createClient();
    const { error: deleteError } = await supabase.from('services').delete().eq('id', id);

    if (deleteError && removed) {
      setServices((prev) => [...prev, removed].sort((a, b) => a.name.localeCompare(b.name)));
      setError(deleteError.message);
    }
  }

  return (
    <div>
      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Base price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No services yet.
                </TableCell>
              </TableRow>
            ) : (
              services.map((service) => (
                <TableRow key={service.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      <ServiceIcon name={service.icon} size={18} className="shrink-0 text-muted-foreground" />
                      {service.name}
                    </span>
                  </TableCell>
                  <TableCell>{service.categories?.name ?? '—'}</TableCell>
                  <TableCell>
                    {PRICE_FORMATTER.format(service.base_price)}
                    {service.pricing_type !== 'fixed' && (
                      <Badge variant="secondary" className="ml-2">
                        {service.pricing_type}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={service.is_active}
                        onCheckedChange={() => toggleActive(service)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {service.is_active ? 'Active' : 'Hidden'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/services/${service.id}`}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    >
                      Edit
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 text-destructive hover:text-destructive"
                      onClick={() => setPendingDeleteId(service.id)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={pendingDeleteId !== null} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete service</DialogTitle>
            <DialogDescription>
              This permanently deletes the service along with its pricing rules and addons. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

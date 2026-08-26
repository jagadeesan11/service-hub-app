'use client';

import Link from 'next/link';
import { useState } from 'react';

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
import type { Category, Technician } from '@/types/database';

export function TechniciansTable({
  initialTechnicians,
  categories,
}: {
  initialTechnicians: Technician[];
  categories: Category[];
}) {
  const [technicians, setTechnicians] = useState(initialTechnicians);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function categoryNames(categoryIds: string[]) {
    return categories.filter((c) => categoryIds.includes(c.id));
  }

  async function toggleStatus(technician: Technician) {
    const nextStatus = technician.status === 'active' ? 'inactive' : 'active';
    setTechnicians((prev) =>
      prev.map((t) => (t.id === technician.id ? { ...t, status: nextStatus } : t)),
    );
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('technicians')
      .update({ status: nextStatus })
      .eq('id', technician.id);

    if (updateError) {
      setTechnicians((prev) =>
        prev.map((t) => (t.id === technician.id ? { ...t, status: technician.status } : t)),
      );
      setError(updateError.message);
    }
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    const removed = technicians.find((t) => t.id === id);

    setTechnicians((prev) => prev.filter((t) => t.id !== id));
    setPendingDeleteId(null);
    setError(null);

    const supabase = createClient();
    const { error: deleteError } = await supabase.from('technicians').delete().eq('id', id);

    if (deleteError && removed) {
      setTechnicians((prev) => [...prev, removed].sort((a, b) => a.name.localeCompare(b.name)));
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
              <TableHead>Phone</TableHead>
              <TableHead>Categories</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {technicians.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No technicians yet.
                </TableCell>
              </TableRow>
            ) : (
              technicians.map((technician) => (
                <TableRow key={technician.id}>
                  <TableCell className="font-medium">{technician.name}</TableCell>
                  <TableCell className="text-muted-foreground">{technician.phone ?? '—'}</TableCell>
                  <TableCell>
                    {categoryNames(technician.category_ids).length === 0 ? (
                      <span className="text-muted-foreground">None</span>
                    ) : (
                      categoryNames(technician.category_ids).map((c) => (
                        <Badge key={c.id} variant="secondary" className="mr-1">
                          {c.name}
                        </Badge>
                      ))
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={technician.status === 'active'}
                        onCheckedChange={() => toggleStatus(technician)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {technician.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/technicians/${technician.id}`}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    >
                      Edit
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 text-destructive hover:text-destructive"
                      onClick={() => setPendingDeleteId(technician.id)}
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
            <DialogTitle>Delete technician</DialogTitle>
            <DialogDescription>
              This removes the technician from the roster. Any bookings already assigned to them
              become unassigned. This cannot be undone.
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

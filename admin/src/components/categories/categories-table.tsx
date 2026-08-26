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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createClient } from '@/lib/supabase/client';
import type { CategoryWithTemplate } from '@/types/database';

export function CategoriesTable({ initialCategories }: { initialCategories: CategoryWithTemplate[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    const removed = categories.find((c) => c.id === id);

    setCategories((prev) => prev.filter((c) => c.id !== id));
    setPendingDeleteId(null);
    setError(null);

    const supabase = createClient();
    const { error: deleteError } = await supabase.from('categories').delete().eq('id', id);

    if (deleteError && removed) {
      setCategories((prev) => [...prev, removed].sort((a, b) => a.name.localeCompare(b.name)));
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
              <TableHead>Slug</TableHead>
              <TableHead>Input fields</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No categories yet.
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="text-muted-foreground">{category.slug}</TableCell>
                  <TableCell>
                    {category.input_templates?.fields.length ? (
                      category.input_templates.fields.map((field) => (
                        <Badge key={field.name} variant="secondary" className="mr-1">
                          {field.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/categories/${category.id}`}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    >
                      Edit
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 text-destructive hover:text-destructive"
                      onClick={() => setPendingDeleteId(category.id)}
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
            <DialogTitle>Delete category</DialogTitle>
            <DialogDescription>
              This permanently deletes the category and every service under it. This cannot be undone.
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

import Link from 'next/link';

import { PageHeader } from '@/components/page-header';

import { buttonVariants } from '@/components/ui/button';
import { CategoriesTable } from '@/components/categories/categories-table';
import { createClient } from '@/lib/supabase/server';
import type { CategoryWithTemplate } from '@/types/database';

export default async function CategoriesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, icon, input_template_id, input_templates(id, fields)')
    .order('name')
    .returns<CategoryWithTemplate[]>();

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Each category defines what info a booking needs to collect (its input template)."
        action={
          <Link href="/categories/new" className={buttonVariants()}>
            New Category
          </Link>
        }
      />

      {error ? (
        <p className="text-sm text-destructive">Failed to load categories: {error.message}</p>
      ) : (
        <CategoriesTable initialCategories={data ?? []} />
      )}
    </div>
  );
}

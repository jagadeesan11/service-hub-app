import Link from 'next/link';

import { PageHeader } from '@/components/page-header';

import { buttonVariants } from '@/components/ui/button';
import { TechniciansTable } from '@/components/technicians/technicians-table';
import { createClient } from '@/lib/supabase/server';
import type { Category, Technician } from '@/types/database';

export default async function TechniciansPage() {
  const supabase = await createClient();
  const [{ data: technicians, error }, { data: categories }] = await Promise.all([
    supabase.from('technicians').select('*').order('name').returns<Technician[]>(),
    supabase.from('categories').select('id, name, slug, icon, input_template_id').returns<Category[]>(),
  ]);

  return (
    <div>
      <PageHeader
        title="Technicians"
        description="Manage the technician roster and which categories each one can be assigned to."
        action={
          <Link href="/technicians/new" className={buttonVariants()}>
            New Technician
          </Link>
        }
      />

      {error ? (
        <p className="text-sm text-destructive">Failed to load technicians: {error.message}</p>
      ) : (
        <TechniciansTable
          initialTechnicians={technicians ?? []}
          categories={categories ?? []}
        />
      )}
    </div>
  );
}

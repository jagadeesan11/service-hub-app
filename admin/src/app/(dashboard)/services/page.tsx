import Link from 'next/link';

import { PageHeader } from '@/components/page-header';

import { buttonVariants } from '@/components/ui/button';
import { ServicesTable } from '@/components/services/services-table';
import { createClient } from '@/lib/supabase/server';
import type { ServiceWithCategory } from '@/types/database';

export default async function ServicesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('services')
    .select('id, category_id, name, base_price, pricing_type, is_active, categories(id, name)')
    .order('created_at', { ascending: false })
    .returns<ServiceWithCategory[]>();

  return (
    <div>
      <PageHeader
        title="Services"
        description="Manage the services offered under each category."
        action={
          <Link href="/services/new" className={buttonVariants()}>
            New Service
          </Link>
        }
      />

      {error ? (
        <p className="text-sm text-destructive">Failed to load services: {error.message}</p>
      ) : (
        <ServicesTable initialServices={data ?? []} />
      )}
    </div>
  );
}

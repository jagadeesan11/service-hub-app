import { ServiceForm } from '@/components/services/service-form';
import { createClient } from '@/lib/supabase/server';
import type { Category } from '@/types/database';

export default async function NewServicePage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, slug')
    .order('name')
    .returns<Category[]>();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">New Service</h1>
      <ServiceForm categories={categories ?? []} />
    </div>
  );
}

import { notFound } from 'next/navigation';

import { TechnicianForm } from '@/components/technicians/technician-form';
import { createClient } from '@/lib/supabase/server';
import type { Category, Technician } from '@/types/database';

export default async function EditTechnicianPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: technician }, { data: categories }] = await Promise.all([
    supabase.from('technicians').select('*').eq('id', id).returns<Technician[]>().maybeSingle(),
    supabase.from('categories').select('id, name, slug, icon, input_template_id').order('name').returns<Category[]>(),
  ]);

  if (!technician) {
    notFound();
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Edit Technician</h1>
      <TechnicianForm technician={technician} categories={categories ?? []} />
    </div>
  );
}

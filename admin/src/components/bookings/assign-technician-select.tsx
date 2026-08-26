'use client';

import { useState } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';
import type { Technician } from '@/types/database';

export function AssignTechnicianSelect({
  bookingId,
  categoryId,
  technicians,
  onAssigned,
}: {
  bookingId: string;
  categoryId: string;
  technicians: Technician[];
  onAssigned: (technician: Technician) => void;
}) {
  const [isAssigning, setIsAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligible = technicians.filter((t) => t.category_ids.includes(categoryId));

  async function handleAssign(technicianId: string) {
    const technician = eligible.find((t) => t.id === technicianId);
    if (!technician) return;

    setIsAssigning(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ technician_id: technician.id, status: 'assigned' })
      .eq('id', bookingId);

    setIsAssigning(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    onAssigned(technician);
  }

  if (eligible.length === 0) {
    return <span className="text-xs text-muted-foreground">No eligible technicians</span>;
  }

  return (
    <div>
      <Select value="" onValueChange={(value) => value && handleAssign(value)} disabled={isAssigning}>
        <SelectTrigger className="w-full min-w-40">
          <SelectValue placeholder={isAssigning ? 'Assigning...' : 'Assign technician'} />
        </SelectTrigger>
        <SelectContent>
          {eligible.map((technician) => (
            <SelectItem key={technician.id} value={technician.id}>
              {technician.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

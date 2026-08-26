import type { ID } from '@/types/database';

export interface FeedbackListItem {
  id: ID;
  booking_id: ID;
  rating: number;
  comment: string | null;
  tags: string[];
  is_published: boolean;
  admin_response: string | null;
  responded_at: string | null;
  created_at: string;
  services: { name: string } | null;
  technicians: { name: string } | null;
  profiles: { name: string | null; phone: string | null } | null;
}

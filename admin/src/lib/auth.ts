import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/types/database';

/**
 * Who is asking, on the server.
 *
 * The role is read from the database on every request rather than trusted from
 * a cookie or a claim: a role can be changed or revoked while someone is still
 * holding a perfectly valid session, and a stale claim would keep letting them
 * in until they happened to sign out.
 */
export async function getCurrentRole(): Promise<{ id: string; role: UserRole | null } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: UserRole }>();

  return { id: user.id, role: profile?.role ?? null };
}

/**
 * Gate a route segment on being a full admin.
 *
 * Hiding a link is not access control — the URL still resolves, and typing it
 * is not a trick. This is what actually stops a shop owner opening Users, and
 * it belongs in a layout so it covers every page under the segment, including
 * ones added later.
 *
 * Redirects to the dashboard rather than to /login: they are signed in
 * perfectly legitimately, they simply do not have this.
 */
export async function requireAdmin(): Promise<void> {
  const caller = await getCurrentRole();
  if (!caller) redirect('/login');
  if (caller.role !== 'admin') redirect('/');
}

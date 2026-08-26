import { createClient as createServiceClient } from '@supabase/supabase-js';

import { PageHeader } from '@/components/page-header';
import { UsersTable } from '@/components/users/users-table';
import { createClient } from '@/lib/supabase/server';
import type { AppUser } from '@/types/database';

/**
 * Login identities live in auth.users, which PostgREST does not expose, so
 * they need the service key and can only be read here on the server.
 *
 * Worth the extra call: profiles.email is a CONTACT address the customer typed
 * in, not the account they sign in with. Showing it on a screen where you
 * change someone's access is misleading — and useless for the customers who
 * signed up by phone and have no login email at all.
 */
async function loginIdentities(): Promise<Map<string, { email: string | null; phone: string | null }>> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return new Map();

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  return new Map(
    // || not ??: Supabase returns an empty string for an absent email, which
    // ?? passes straight through and which then shadows the phone.
    (data?.users ?? []).map((u) => [u.id, { email: u.email || null, phone: u.phone || null }]),
  );
}

export default async function UsersPage() {
  const supabase = await createClient();
  const [{ data: profiles, error }, { data: auth }, identities] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, phone, email, role, created_at')
      .order('created_at', { ascending: true })
      .returns<AppUser[]>(),
    supabase.auth.getUser(),
    loginIdentities(),
  ]);

  const users = (profiles ?? []).map((p) => {
    const identity = identities.get(p.id);
    return {
      ...p,
      login_email: identity?.email || null,
      login_phone: identity?.phone || null,
    };
  });

  return (
    <div>
      <PageHeader
        title="Users"
        description="Everyone with an account. Staff roles open the admin panel; customers use the mobile app."
      />

      {error ? (
        <p className="text-sm text-destructive">Failed to load users: {error.message}</p>
      ) : (
        <UsersTable users={users} currentUserId={auth.user?.id ?? null} />
      )}
    </div>
  );
}

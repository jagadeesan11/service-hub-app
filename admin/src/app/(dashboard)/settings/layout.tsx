import { requireAdmin } from '@/lib/auth';

/**
 * Settings is admin-only, enforced here rather than in the page.
 *
 * Note what this does and does not do: it stops the screen rendering for
 * anyone who is not an admin. The form itself writes to app_settings from the
 * browser under the caller's own session, and the RLS policy on that table
 * accepts `is_admin()`, which counts shop owners too. Closing that last gap
 * needs a database change, not a change here.
 */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}

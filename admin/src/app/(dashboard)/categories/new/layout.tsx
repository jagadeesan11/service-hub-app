import { requireAdmin } from '@/lib/auth';

/**
 * Creating a category is admin-only.
 *
 * Guarded at the segment rather than in the page, so it holds however the
 * route is reached. The RLS policy on categories refuses the insert anyway —
 * this is what stops a shop owner filling in a form that was always going to
 * be rejected.
 */
export default async function NewCategoryLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}

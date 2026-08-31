import { requireAdmin } from '@/lib/auth';

/**
 * Users is admin-only, enforced here rather than in the page.
 *
 * A layout wraps every route under the segment, so a page added later is
 * covered without anyone remembering to guard it. The sidebar hides the link
 * as well, but that is presentation — this is the part that stops someone
 * simply typing the address.
 *
 * The Server Actions in ./actions.ts check the caller independently. They are
 * public endpoints and this redirect does not protect them.
 */
export default async function UsersLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}

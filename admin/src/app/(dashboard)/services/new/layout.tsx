import { requireAdmin } from '@/lib/auth';

/**
 * Creating a service is admin-only, the same as creating a category.
 *
 * Editing an existing service is deliberately not gated here: a shop owner
 * still needs to correct a price or take something off the menu.
 */
export default async function NewServiceLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}

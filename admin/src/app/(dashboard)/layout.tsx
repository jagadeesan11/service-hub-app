import { redirect } from 'next/navigation';

import { NexoraMark } from '@/components/nexora-mark';
import { SidebarNav } from '@/components/sidebar-nav';
import { SignOutButton } from '@/components/sign-out-button';
import { ThemeToggle } from '@/components/theme-toggle';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="sticky top-0 flex h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <NexoraMark className="size-7 text-foreground" />
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">Nexora</div>
            <div className="text-[11px] text-muted-foreground">Admin</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3">
          <SidebarNav />
        </div>

        <div className="flex flex-col gap-3 border-t border-sidebar-border p-3">
          <ThemeToggle />
          <div className="flex items-center gap-2 rounded-lg px-1">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
              {user.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={user.email}>
              {user.email}
            </div>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}

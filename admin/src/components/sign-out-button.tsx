'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function SignOutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    const { createClient } = await import('@/lib/supabase/client');
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={isSigningOut}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none disabled:opacity-60"
    >
      <LogOut className="size-4" />
      {isSigningOut ? 'Signing out…' : 'Sign out'}
    </button>
  );
}

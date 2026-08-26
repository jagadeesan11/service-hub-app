import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { supabase } from '@/lib/supabase';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);

      // Cached data outlives the session otherwise. Query keys are scoped by
      // user id, so nothing should cross over — but this device is shared in
      // practice (a shop phone, a family handset), and one unscoped key added
      // later would silently show one customer another's bookings. Clearing
      // here makes that impossible rather than merely unlikely.
      //
      // Handled on the event, not just in signOut(), so an expired or revoked
      // session drops its cache too.
      if (event === 'SIGNED_OUT') queryClient.clear();
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  async function signOut() {
    await supabase.auth.signOut();
    // Also cleared directly: the listener is reliable but asynchronous, and a
    // screen still mounted during the redirect must not read stale rows.
    queryClient.clear();
  }

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

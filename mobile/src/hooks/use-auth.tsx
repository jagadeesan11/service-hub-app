import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';

import { supabase } from '@/lib/supabase';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  /** True between opening a password-reset link and setting the new password. */
  isRecovering: boolean;
  completeRecovery: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Pulls auth tokens out of a link the app was opened with.
 *
 * supabase-js only reads tokens from the URL in a browser (the client is
 * created with detectSessionInUrl: false, because there is no window.location
 * on a device). Both shapes are handled: the implicit flow puts the tokens in
 * the fragment, PKCE puts a single code in the query string.
 */
function tokensFromUrl(url: string):
  | { kind: 'session'; access_token: string; refresh_token: string }
  | { kind: 'code'; code: string }
  | null {
  const [, fragment] = url.split('#');
  const query = url.split('?')[1]?.split('#')[0];
  const params = new URLSearchParams(fragment ?? query ?? '');

  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) return { kind: 'session', access_token, refresh_token };

  const code = params.get('code');
  if (code) return { kind: 'code', code };

  return null;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecovering, setIsRecovering] = useState(false);

  // The URL the app was opened with, and any that arrive while it runs.
  const url = Linking.useURL();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);

      // Fired when the session came from a recovery link. The root router
      // reads this to send them to "choose a new password" rather than home —
      // a recovery session is a real session, so nothing else distinguishes it.
      if (event === 'PASSWORD_RECOVERY') setIsRecovering(true);

      // Cached data outlives the session otherwise. Query keys are scoped by
      // user id, so nothing should cross over — but this device is shared in
      // practice (a shop phone, a family handset), and one unscoped key added
      // later would silently show one customer another's bookings. Clearing
      // here makes that impossible rather than merely unlikely.
      //
      // Handled on the event, not just in signOut(), so an expired or revoked
      // session drops its cache too.
      if (event === 'SIGNED_OUT') {
        setIsRecovering(false);
        queryClient.clear();
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  useEffect(() => {
    if (!url) return;
    const parsed = tokensFromUrl(url);
    if (!parsed) return;

    // A recovery link carries type=recovery; treat anything else arriving with
    // tokens as an ordinary sign-in.
    const isRecoveryLink = url.includes('type=recovery');

    (async () => {
      if (parsed.kind === 'session') {
        await supabase.auth.setSession({
          access_token: parsed.access_token,
          refresh_token: parsed.refresh_token,
        });
      } else {
        await supabase.auth.exchangeCodeForSession(parsed.code);
      }
      if (isRecoveryLink) setIsRecovering(true);
    })();
  }, [url]);

  const completeRecovery = useCallback(() => setIsRecovering(false), []);

  async function signOut() {
    await supabase.auth.signOut();
    setIsRecovering(false);
    // Also cleared directly: the listener is reliable but asynchronous, and a
    // screen still mounted during the redirect must not read stale rows.
    queryClient.clear();
  }

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        isLoading,
        isRecovering,
        completeRecovery,
        signOut,
      }}
    >
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

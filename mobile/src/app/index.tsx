import { Redirect } from 'expo-router';

import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';

// Bare "/" has no screen of its own; this routes to wherever the
// Stack.Protected guards in the root layout actually allow.
export default function Index() {
  const { session, user, isLoading } = useAuth();
  const { data: profile, isLoading: isProfileLoading } = useProfile(user?.id);

  if (isLoading) return null;
  if (!session) return <Redirect href="/sign-in/phone" />;

  // Wait for the profile before deciding, otherwise an existing customer
  // gets flashed the onboarding screen on every cold start.
  if (isProfileLoading) return null;

  // Keyed on onboarded_at rather than a missing name, so someone who
  // deliberately skipped isn't asked again every launch.
  if (profile && !profile.onboarded_at) return <Redirect href="/onboarding" />;

  return <Redirect href="/home" />;
}

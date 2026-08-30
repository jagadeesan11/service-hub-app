import { Redirect } from 'expo-router';

import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { isShopSide } from '@/lib/roles';

// Bare "/" has no screen of its own; this routes to wherever the
// Stack.Protected guards in the root layout actually allow.
export default function Index() {
  const { session, user, isLoading, isRecovering } = useAuth();
  const { data: profile, isLoading: isProfileLoading } = useProfile(user?.id);

  if (isLoading) return null;
  if (!session) return <Redirect href="/sign-in" />;

  // Checked before onboarding and home: someone who followed a reset link is
  // signed in, but landing them on the home screen would quietly drop the one
  // thing they opened the app to do.
  if (isRecovering) return <Redirect href="/reset-password" />;

  // Wait for the profile before deciding, otherwise an existing customer
  // gets flashed the onboarding screen on every cold start.
  if (isProfileLoading) return null;

  // The role decides which app this is. Shop staff skip onboarding entirely —
  // it asks for a home address and a vehicle, which is a customer's business.
  if (profile && isShopSide(profile.role)) return <Redirect href="/inbox" />;

  // Keyed on onboarded_at rather than a missing name, so someone who
  // deliberately skipped isn't asked again every launch.
  if (profile && !profile.onboarded_at) return <Redirect href="/onboarding" />;

  return <Redirect href="/home" />;
}

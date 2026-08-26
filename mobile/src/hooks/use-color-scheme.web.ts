import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/** Never changes, so the store never notifies — the only thing that matters is
 *  that the server snapshot differs from the client one. */
const subscribe = () => () => {};

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web.
 *
 * useSyncExternalStore rather than a setState-in-effect flag: React reads the
 * server snapshot during hydration and the client snapshot after, which is
 * exactly the "has hydrated" signal, without the cascading render the effect
 * version causes.
 */
export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const colorScheme = useRNColorScheme();

  return hasHydrated ? colorScheme : 'light';
}

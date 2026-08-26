import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';

/**
 * Registers this device for push notifications and links the Expo push
 * token to the signed-in user's profile (device_tokens.profile_id), so the
 * booking-status webhook (Phase 7, Prompt 18) can find it.
 *
 * No-ops on web (expo-notifications' remote-push story there needs a
 * separate VAPID setup) and on simulators/emulators, and silently gives up
 * if no EAS projectId is configured — unverified beyond code review, since
 * testing needs a real device / dev-client build this environment can't
 * produce.
 */
export function useRegisterPushToken() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || Platform.OS === 'web' || !Device.isDevice) return;

    let cancelled = false;

    (async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let status = existingStatus;
      if (status !== 'granted') {
        ({ status } = await Notifications.requestPermissionsAsync());
      }
      if (status !== 'granted') return;

      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) {
        console.warn('useRegisterPushToken: no EAS projectId configured, skipping.');
        return;
      }

      try {
        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
        if (cancelled) return;

        const { error } = await supabase
          .from('device_tokens')
          .upsert({ profile_id: user.id, token }, { onConflict: 'token' });
        if (error) console.warn('useRegisterPushToken: failed to save token.', error.message);
      } catch (err) {
        console.warn('useRegisterPushToken: could not get a push token.', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);
}

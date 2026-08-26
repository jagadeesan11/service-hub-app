import * as Notifications from 'expo-notifications';

// Controls how a push notification is presented while the app is in the
// foreground (otherwise it's silently swallowed on some platforms).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

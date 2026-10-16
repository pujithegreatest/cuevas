import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

export const ANNOUNCEMENTS_TOPIC = "cuevas-announcements";

function messagingApi() {
  // Load lazily so older development clients can still open the app.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@react-native-firebase/messaging") as typeof import("@react-native-firebase/messaging");
}

export async function configureNotificationChannel() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("announcements", {
      name: "Community announcements",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
    });
  }
}

export async function requestPushPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  await configureNotificationChannel();
  const permission = await Notifications.requestPermissionsAsync();
  return permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function syncPushSubscription(enabled: boolean) {
  if (Platform.OS === "web") return;
  const api = messagingApi();
  const messaging = api.getMessaging();
  if (!enabled) {
    await api.setAutoInitEnabled(messaging, false);
    await api.deleteToken(messaging);
    return;
  }
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) {
    await api.setAutoInitEnabled(messaging, false);
    await api.deleteToken(messaging);
    return;
  }
  await configureNotificationChannel();
  if (Platform.OS === "ios" && !messaging.isDeviceRegisteredForRemoteMessages) {
    await api.registerDeviceForRemoteMessages(messaging);
  }
  await api.getToken(messaging);
  await api.setAutoInitEnabled(messaging, true);
  await api.subscribeToTopic(messaging, ANNOUNCEMENTS_TOPIC);
}

export function observePushNotifications(onTokenChanged: () => void) {
  if (Platform.OS === "web") return () => {};
  const api = messagingApi();
  const messaging = api.getMessaging();
  const stopToken = api.onTokenRefresh(messaging, onTokenChanged);
  const stopMessage = api.onMessage(messaging, async (message) => {
    if (!message.notification) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: message.notification.title,
        body: message.notification.body,
        sound: "default",
        data: message.data || {},
      },
      trigger: Platform.OS === "android" ? { channelId: "announcements" } : null,
    });
  });
  return () => { stopToken(); stopMessage(); };
}

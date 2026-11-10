import * as Notifications from "expo-notifications";

export function observeMessageNotificationOpens(open: (data: Record<string, unknown> | undefined) => void) {
  const listener = Notifications.addNotificationResponseReceivedListener((response) => open(response.notification.request.content.data));
  try {
    const api = require("@react-native-firebase/messaging") as typeof import("@react-native-firebase/messaging");
    const messaging = api.getMessaging();
    const stopNative = api.onNotificationOpenedApp(messaging, (message) => open(message.data));
    api.getInitialNotification(messaging).then((message) => open(message?.data)).catch(() => {});
    return () => { listener.remove(); stopNative(); };
  } catch { return () => listener.remove(); }
}

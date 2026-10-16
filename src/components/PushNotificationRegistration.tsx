import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useAppStore } from "../state/appStore";
import { useNotificationStore } from "../state/notificationStore";
import { observePushNotifications, syncPushSubscription } from "../services/pushNotifications";

let syncQueue: Promise<void> = Promise.resolve();

function shouldReceivePush() {
  return useAppStore.getState().isAuthenticated && useNotificationStore.getState().enabled;
}

function synchronize() {
  // Serialize token changes so a delayed opt-in cannot undo a later logout.
  syncQueue = syncQueue.then(async () => {
    try {
      await syncPushSubscription(shouldReceivePush());
      useNotificationStore.setState({ error: null });
    } catch {
      useNotificationStore.setState({ error: "Notifications could not connect. Check your connection and app version, then try again." });
    }
  });
}

export default function PushNotificationRegistration() {
  const enabled = useNotificationStore((s) => s.enabled);
  const hydrated = useNotificationStore((s) => s.hydrated);
  const authenticated = useAppStore((s) => s.isAuthenticated);
  const email = useAppStore((s) => s.userEmail);

  useEffect(() => {
    if (Platform.OS === "web" || !hydrated) return;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: shouldReceivePush(),
        shouldShowList: shouldReceivePush(),
        shouldPlaySound: shouldReceivePush(),
        shouldSetBadge: false,
      }),
    });
    synchronize();
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") synchronize();
    });
    let stop = () => {};
    try { stop = observePushNotifications(synchronize); } catch { /* Older native builds lack Firebase Messaging. */ }
    return () => { appState.remove(); stop(); };
  }, [enabled, hydrated, authenticated, email]);

  return null;
}

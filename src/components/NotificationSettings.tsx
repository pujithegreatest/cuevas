import React, { useState } from "react";
import { Alert, Linking, Platform, Switch, Text, View } from "react-native";
import { useNotificationStore } from "../state/notificationStore";
import { requestPushPermission } from "../services/pushNotifications";

export default function NotificationSettings({ dark }: { dark: boolean }) {
  const enabled = useNotificationStore((s) => s.enabled);
  const error = useNotificationStore((s) => s.error);
  const setEnabled = useNotificationStore((s) => s.setEnabled);
  const [busy, setBusy] = useState(false);
  if (Platform.OS === "web") return null;

  const toggle = async (value: boolean) => {
    if (!value) { setEnabled(false); return; }
    setBusy(true);
    try {
      if (await requestPushPermission()) setEnabled(true);
      else Alert.alert("Notifications are disabled", "Enable notifications for Cuevas in your phone settings.", [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => { void Linking.openSettings(); } },
      ]);
    } catch {
      Alert.alert("Notifications unavailable", "Install the latest Cuevas build and try again.");
    } finally { setBusy(false); }
  };

  return (
    <View style={{ paddingVertical: 16, paddingHorizontal: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={{ flex: 1, fontWeight: "700", color: dark ? "#CFEFEC" : "#1F2937" }}>Community notifications</Text>
        <Switch accessibilityLabel="Community notifications" value={enabled} disabled={busy} onValueChange={toggle} trackColor={{ true: "#057D78" }} />
      </View>
      {error ? (
        <Text style={{ paddingVertical: 8, color: dark ? "#FCA5A5" : "#B91C1C" }}>{error}</Text>
      ) : null}
    </View>
  );
}

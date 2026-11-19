import React, { useEffect, useState } from "react";
import { Alert, Linking, Platform, Pressable, Switch, Text, View } from "react-native";
import { useNotificationStore } from "../state/notificationStore";
import { requestPushPermission } from "../services/pushNotifications";
import { dmRequest } from "../services/directMessages";
import { useAppStore } from "../state/appStore";

const choices = {
  dm: ["DMs", "All messages", "Direct messages and group mentions", "Off"],
  recurringMissions: ["Recurring missions", "Every occurrence", "Series changes only", "Off"],
  missionEvents: ["Mission events", "Reminders and updates", "Time changes and cancellations only", "Off"],
  missionChat: ["Mission chat", "All messages", "Mentions only", "Off"],
  zaps: ["Zaps", "Every zap", "Daily summary", "Off"],
  comments: ["Comments", "All comments on my posts", "Replies and mentions only", "Off"],
} as const;
type Category = keyof typeof choices;
type Preference = "all" | "limited" | "off";
type Preferences = Record<Category, Preference>;
const values: Preference[] = ["all", "limited", "off"];

export default function NotificationSettings({ dark }: { dark: boolean }) {
  const enabled = useNotificationStore((s) => s.enabled);
  const error = useNotificationStore((s) => s.error);
  const setEnabled = useNotificationStore((s) => s.setEnabled);
  const [busy, setBusy] = useState(false);
  const email = useAppStore(s => s.userEmail);
  const [loaded, setLoaded] = useState<{ email: typeof email; preferences: Preferences } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const preferences = loaded?.email === email ? loaded?.preferences : undefined;

  useEffect(() => {
    if (Platform.OS === "web" || !email) return;
    let active = true;
    setLoadError(false);
    dmRequest<{ preferences: Preferences }>("getNotificationPreferences")
      .then(result => { if (active) setLoaded({ email, preferences: result.preferences }); })
      .catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [email, retry]);
  if (Platform.OS === "web") return null;

  const select = (category: Category) => {
    Alert.alert(choices[category][0], undefined, [
      ...values.map((value, index) => ({
        text: choices[category][index + 1],
        onPress: async () => {
          if (saving) return;
          setSaving(true);
          try {
            const result = await dmRequest<{ preferences: Preferences }>("setNotificationPreference", { category, value });
            setLoaded({ email, preferences: result.preferences });
          } catch { Alert.alert("Could not save notification preference", "Please try again."); }
          finally { setSaving(false); }
        },
      })),
    ]);
  };

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
        <Text style={{ flex: 1, fontWeight: "700", color: dark ? "#CFEFEC" : "#1F2937" }}>Push notifications</Text>
        <Switch accessibilityLabel="Push notifications" value={enabled} disabled={busy} onValueChange={toggle} trackColor={{ true: "#057D78" }} />
      </View>
      {preferences && (Object.keys(choices) as Category[]).map(category => (
        <Pressable key={category} accessibilityRole="button" disabled={saving}
          onPress={() => select(category)}
          style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: dark ? "#354849" : "#D7E4E4" }}>
          <Text style={{ color: dark ? "#CFEFEC" : "#1F2937", fontWeight: "600" }}>{choices[category][0]}</Text>
          <Text style={{ color: dark ? "#AEBCC3" : "#52616B" }}>{choices[category][values.indexOf(preferences[category]) + 1]}</Text>
        </Pressable>
      ))}
      {loadError && !preferences && (
        <Pressable accessibilityRole="button" onPress={() => setRetry(value => value + 1)}>
          <Text style={{ paddingVertical: 10, color: dark ? "#CFEFEC" : "#1F2937" }}>Could not load push preferences. Retry</Text>
        </Pressable>
      )}
      {error ? (
        <Text style={{ paddingVertical: 8, color: dark ? "#FCA5A5" : "#B91C1C" }}>{error}</Text>
      ) : null}
    </View>
  );
}

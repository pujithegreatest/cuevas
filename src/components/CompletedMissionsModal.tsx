import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "./Ionicons";
import { useAppStore } from "../state/appStore";
import { fetchCompletedProfileMissions, CompletedProfileMission } from "../api/cuevas-missions";

export default function CompletedMissionsModal({ visible, handle, onClose }: {
  visible: boolean;
  handle: string;
  onClose: () => void;
}) {
  const dark = useAppStore((s) => s.isDarkMode);
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<CompletedProfileMission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setItems([]);
    setError("");
    setLoading(true);
    fetchCompletedProfileMissions(handle).then((missions) => {
      if (active) setItems(missions);
    }).catch(() => {
      if (active) setError("Could not load completed missions.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [visible, handle, retry]);
  const text = dark ? "#CFEFEC" : "#1F2937";
  const secondary = dark ? "#B3BAC4" : "#59636E";
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: dark ? "#0B1115" : "#FFFFFF" }}>
        <View style={{ paddingTop: insets.top + 10, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={onClose} accessibilityLabel="Close completed missions" hitSlop={12}>
            <Ionicons name="close" size={26} color={text} />
          </Pressable>
          <Text style={{ color: text, fontSize: 18, fontWeight: "700" }}>Completed Missions</Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 30 }}>
          {loading ? <ActivityIndicator color="#06A7A1" accessibilityLabel="Loading completed missions" /> : error ? (
            <View>
              <Text style={{ color: text }}>{error}</Text>
              <Pressable onPress={() => setRetry((n) => n + 1)} style={{ paddingVertical: 16 }}>
                <Text style={{ color: text, fontWeight: "700" }}>Retry</Text>
              </Pressable>
            </View>
          ) : items.length === 0 ? (
            <Text style={{ color: secondary }}>No completed missions yet.</Text>
          ) : items.map((item) => (
            <View key={item.missionId} style={{ paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: dark ? "#374151" : "#DCE2E5" }}>
              <Text style={{ color: text, fontSize: 17, fontWeight: "700" }}>{item.title}</Text>
              <Text style={{ color: secondary, marginTop: 6 }}>{item.date || "Completed"}</Text>
              <Text style={{ color: dark ? "#68DED5" : "#057D78", marginTop: 6, fontWeight: "700" }}>{item.points} Cuevas</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

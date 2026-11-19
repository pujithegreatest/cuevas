import React, { useCallback, useState } from "react";
import { Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import { Ionicons } from "./Ionicons";

type RewardMedia = {
  id: string;
  title: string;
  alt: string;
  mediaUrl: string;
  hdUrl: string | null;
};

const ENDPOINT = "https://www.ecothot.com/_functions/cuevasRewardsMedia";

function wixImage(value: unknown): value is string {
  return typeof value === "string" && value.length <= 2048
    && /^https:\/\/static\.wixstatic\.com\/media\/[^?#]+\.(gif|jpe?g|png|webp)(?:[?#].*)?$/i.test(value);
}

function isRewardMedia(value: unknown): value is RewardMedia {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && typeof item.title === "string"
    && typeof item.alt === "string" && wixImage(item.mediaUrl)
    && (item.hdUrl === null || wixImage(item.hdUrl));
}

function RewardImage({ item, expanded = false }: { item: RewardMedia; expanded?: boolean }) {
  const [hdFailed, setHdFailed] = useState(false);
  const [failed, setFailed] = useState(false);
  const usingHd = Boolean(expanded && item.hdUrl && !hdFailed && item.hdUrl !== item.mediaUrl);
  if (failed) {
    return <Text style={{ color: "#a9b5bd", textAlign: "center" }}>Image unavailable</Text>;
  }
  return (
    <Image
      source={{ uri: usingHd ? item.hdUrl! : item.mediaUrl }}
      style={{ width: "100%", height: "100%" }}
      contentFit="contain"
      accessibilityLabel={item.alt}
      accessible
      autoplay
      cachePolicy="disk"
      onError={() => usingHd ? setHdFailed(true) : setFailed(true)}
    />
  );
}

export function RewardsMediaGallery({ dark }: { dark: boolean }) {
  const [items, setItems] = useState<RewardMedia[]>([]);
  const [selected, setSelected] = useState<RewardMedia | null>(null);
  const { width, height } = useWindowDimensions();
  const tile = Math.min(440, Math.max(1, width - 48));
  const expanded = Math.min(960, Math.max(1, width - 32), Math.max(1, height - 168));
  const text = dark ? "#CFEFEC" : "#17232C";
  const surface = dark ? "#222A2C" : "#F4FAFA";

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    fetch(ENDPOINT, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted && Array.isArray(data?.items)) {
          setItems(data.items.filter(isRewardMedia).slice(0, 30));
        }
      })
      .catch(() => {})
      .finally(() => clearTimeout(timeout));
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []));

  if (!items.length) return null;
  return (
    <View style={{ width: "100%", marginBottom: 28, gap: 12 }}>
      <Text accessibilityRole="header" style={{ color: text, fontSize: 18, fontWeight: "700" }}>
        Featured Rewards
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={items.length > 1}
        contentContainerStyle={{ gap: 12, paddingBottom: 6 }}>
        {items.map(item => (
          <Pressable key={item.id} accessibilityRole="button"
            accessibilityLabel={`Enlarge ${item.title}. ${item.alt}`}
            onPress={() => setSelected(item)} style={{ width: tile, gap: 8 }}>
            <View style={{ width: "100%", aspectRatio: 1, overflow: "hidden", borderRadius: 8,
              alignItems: "center", justifyContent: "center", backgroundColor: surface }}>
              <RewardImage key={item.mediaUrl} item={item} />
              <View pointerEvents="none" style={{ position: "absolute", right: 8, bottom: 8,
                borderRadius: 6, padding: 6, backgroundColor: "#193337" }}>
                <Ionicons name="expand-outline" size={18} color="#FFFFFF" />
              </View>
            </View>
            <Text style={{ color: text, fontWeight: "600" }}>{item.title}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        {selected && (
          <View accessibilityViewIsModal style={{ flex: 1, justifyContent: "center",
            alignItems: "center", backgroundColor: "rgba(0,0,0,0.88)" }}>
            <View style={{ width: expanded, gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", minHeight: 44 }}>
                <Text numberOfLines={2} style={{ flex: 1, color: "#FFFFFF", fontWeight: "700" }}>
                  {selected.title}
                </Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Close reward image"
                  onPress={() => setSelected(null)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </Pressable>
              </View>
              <View style={{ width: expanded, aspectRatio: 1, alignItems: "center", justifyContent: "center",
                borderRadius: 8, overflow: "hidden", backgroundColor: "#222A2C" }}>
                <RewardImage item={selected} expanded />
              </View>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

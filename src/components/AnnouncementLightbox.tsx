import React, { useEffect, useRef, useState } from "react";
import { AppState, Modal, Platform, Pressable, Text, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { X } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppStore } from "../state/appStore";
import { useMessagingStore } from "../state/messagingStore";

type Announcement = { id: string; title: string; imageUrl: string; revision: number; endsAt: string };
const endpoint = "https://www.ecothot.com/_functions/cuevasAnnouncements";
const identity = (item: Announcement) => `${item.id}:${item.revision}`;

export default function AnnouncementLightbox() {
  const authenticated = useAppStore(s => s.isAuthenticated);
  const email = useAppStore(s => s.userEmail);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const current = useRef<Announcement | null>(null);
  const storageKey = useRef("");
  const seen = useRef<string[]>([]);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const side = Math.max(1, Math.min(440, width - 48, height - insets.top - insets.bottom - 112));

  useEffect(() => {
    current.current = null; setAnnouncement(null);
    if (!authenticated || !email) return;
    let active = true;
    let checking = false;
    let hydrated = false;
    let shownThisSession = false;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    const key = `cuevas:announcements:v1:${encodeURIComponent(email.trim().toLowerCase())}`;
    storageKey.current = key;
    seen.current = [];
    const hide = () => { current.current = null; setAnnouncement(null); };
    const check = async () => {
      if (!active || !hydrated || checking || AppState.currentState !== "active" || (Platform.OS === "web" && document.hidden)) return;
      checking = true;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(endpoint, { signal: controller.signal, headers: { Accept: "application/json" } });
        if (!response.ok) return;
        const data = await response.json();
        if (!active || data.success !== true || !Array.isArray(data.announcements)) return;
        const items: Announcement[] = data.announcements.filter((item: Announcement) => item && typeof item.id === "string" && typeof item.imageUrl === "string" && item.imageUrl.startsWith("https://") && Number.isFinite(Date.parse(item.endsAt)));
        if (current.current) {
          if (!items.some(item => identity(item) === identity(current.current!))) hide();
          return;
        }
        if (shownThisSession || useMessagingStore.getState().visible) return;
        const item = items.find(item => !seen.current.includes(identity(item)));
        if (!item) return;
        const fetchedAt = Date.now();
        const remaining = Date.parse(item.endsAt) - Date.parse(data.serverTime);
        if (!Number.isFinite(remaining) || remaining <= 0) return;
        const loaded = await Image.prefetch(item.imageUrl);
        if (!active || !loaded || Date.now() - fetchedAt >= remaining || useMessagingStore.getState().visible || AppState.currentState !== "active" || (Platform.OS === "web" && document.hidden)) return;
        shownThisSession = true;
        current.current = item; setAnnouncement(item);
        clearTimeout(expiry);
        expiry = setTimeout(() => { if (active) hide(); }, Math.min(remaining - (Date.now() - fetchedAt), 2147483647));
      } catch { /* Announcements must never block login or offline app use. */ }
      finally { checking = false; clearTimeout(timeout); }
    };
    const resume = () => { shownThisSession = false; void check(); };
    const listener = AppState.addEventListener("change", state => { if (state === "active") resume(); });
    const visibility = () => { if (!document.hidden) resume(); };
    if (Platform.OS === "web") document.addEventListener("visibilitychange", visibility);
    const start = setTimeout(() => {
      void (async () => {
        try { const saved = JSON.parse(await AsyncStorage.getItem(key) || "[]"); if (active) seen.current = Array.isArray(saved) ? saved.filter(value => typeof value === "string") : []; } catch { /* Use session-only suppression if local storage is unavailable. */ }
        hydrated = true;
        if (active) await check();
      })();
    }, 2500);
    const interval = setInterval(() => void check(), 60000);
    return () => { active = false; clearTimeout(start); clearTimeout(expiry); clearInterval(interval); listener.remove(); if (Platform.OS === "web") document.removeEventListener("visibilitychange", visibility); };
  }, [authenticated, email]);

  const dismiss = () => {
    if (!current.current) return;
    const values = [...new Set([...seen.current, identity(current.current)])].slice(-500);
    seen.current = values;
    void AsyncStorage.setItem(storageKey.current, JSON.stringify(values)).catch(() => {});
    current.current = null; setAnnouncement(null);
  };
  if (!announcement) return null;
  return <Modal transparent visible animationType="fade" statusBarTranslucent presentationStyle="overFullScreen" onRequestClose={dismiss}>
    <View accessibilityViewIsModal style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,8,12,0.70)", paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <Pressable accessibilityLabel="Dismiss announcement backdrop" onPress={dismiss} style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }} />
      <View style={{ width: side }}>
        <View style={{ position: "absolute", top: -44, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 44 }}>
          <Text numberOfLines={1} style={{ flex: 1, color: "#8DF5E8", fontSize: 12, fontWeight: "800" }}>CUEVAS / TRANSMISSION</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close announcement" onPress={dismiss} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><X color="#E0FFF8" size={24} /></Pressable>
        </View>
        <View testID="announcement-square" style={{ width: side, height: side, borderRadius: 8, borderWidth: 1, borderColor: "#43DFCD", backgroundColor: "#071B22", overflow: "hidden", shadowColor: "#32D9CC", shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 10 }}>
          <Image source={{ uri: announcement.imageUrl }} accessibilityLabel={announcement.title} style={{ width: "100%", height: "100%" }} contentFit="contain" onError={() => { current.current = null; setAnnouncement(null); }} />
          {[{ top: 5, left: 5 }, { top: 5, right: 5 }, { bottom: 5, left: 5 }, { bottom: 5, right: 5 }].map((position, index) => <View key={index} pointerEvents="none" style={{ position: "absolute", ...position, width: 16, height: 16, borderColor: index % 2 ? "#BAAEF5" : "#91FFEB", borderTopWidth: index < 2 ? 2 : 0, borderBottomWidth: index > 1 ? 2 : 0, borderLeftWidth: index % 2 === 0 ? 2 : 0, borderRightWidth: index % 2 === 1 ? 2 : 0 }} />)}
        </View>
        <View style={{ position: "absolute", bottom: -16, height: 16, flexDirection: "row", alignItems: "center", gap: 5 }}><View style={{ height: 2, width: 40, backgroundColor: "#43DFCD" }} /><View style={{ height: 2, width: 12, backgroundColor: "#BAAEF5" }} /></View>
      </View>
    </View>
  </Modal>;
}

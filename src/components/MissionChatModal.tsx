import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  MissionChatMessage,
  MissionChatRole,
  fetchMissionChatMessages,
  sendMissionChatMessage,
} from "../api/cuevas-mission-chat";
import { CuevasMission } from "../api/cuevas-missions";
import { Ionicons } from "./Ionicons";

interface Props {
  visible: boolean;
  mission: CuevasMission | null;
  userEmail?: string | null;
  userHandle?: string | null;
  authorRole: MissionChatRole;
  businessHandle?: string | null;
  isDarkMode?: boolean;
  onClose: () => void;
}

function formatMessageTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function MissionChatModal({
  visible,
  mission,
  userEmail,
  userHandle,
  authorRole,
  businessHandle,
  isDarkMode = true,
  onClose,
}: Props) {
  const [messages, setMessages] = useState<MissionChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef<FlatList<MissionChatMessage>>(null);
  const insets = useSafeAreaInsets();
  const textColor = isDarkMode ? "#CFEFEC" : "#1F2937";
  const mutedColor = isDarkMode ? "#9CA3AF" : "#5F6B73";
  const canSend = draft.trim().length > 0 && !isSending;

  const loadMessages = useCallback(
    async (quiet = false) => {
      if (!visible || !mission?.id) return;
      if (!quiet) setIsLoading(true);
      try {
        const nextMessages = await fetchMissionChatMessages({
          missionId: mission.id,
          userEmail,
          businessHandle: businessHandle || mission.businessHandle,
          authorRole,
        });
        setMessages(nextMessages);
        setStatus(null);
      } catch (error) {
        setStatus(String((error as any)?.message || error));
      } finally {
        if (!quiet) setIsLoading(false);
      }
    },
    [authorRole, businessHandle, mission?.businessHandle, mission?.id, userEmail, visible]
  );

  useEffect(() => {
    if (!visible) return;
    loadMessages();
    const timer = setInterval(() => loadMessages(true), 4000);
    return () => clearInterval(timer);
  }, [loadMessages, visible]);

  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages.length]);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!mission?.id || !text || isSending) return;
    setDraft("");
    setIsSending(true);
    try {
      const message = await sendMissionChatMessage({
        missionId: mission.id,
        text,
        userEmail,
        userHandle: userHandle || userEmail?.split("@")[0] || "cuevas",
        authorRole,
        businessHandle: businessHandle || mission.businessHandle,
      });
      setMessages((current) => [...current.filter((item) => item.id !== message.id), message]);
      setStatus(null);
    } catch (error) {
      setDraft(text);
      setStatus(String((error as any)?.message || error));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? -24 : 0}
        style={{ flex: 1 }}
      >
        <LinearGradient colors={isDarkMode ? ["#081920", "#0A0A0A"] : ["#E8FFFC", "#FFFFFF"]} style={{ flex: 1 }}>
          <View
            style={{
              paddingTop: insets.top + 12,
              paddingHorizontal: 16,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: "rgba(6,167,161,0.22)",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={28} color={textColor} />
            </Pressable>
            <View style={{ alignItems: "center", flex: 1, paddingHorizontal: 12 }}>
              <Text style={{ color: textColor, fontWeight: "900", fontSize: 18 }} numberOfLines={1}>
                Mission Chat
              </Text>
              <Text style={{ color: "#06A7A1", fontWeight: "800", fontSize: 11 }} numberOfLines={1}>
                {mission?.title || "Cuevas mission"} · {authorRole === "vendor" ? "vendor channel" : "volunteer channel"}
              </Text>
            </View>
            <Pressable onPress={() => loadMessages()} hitSlop={10}>
              <Ionicons name="refresh" size={22} color="#06A7A1" />
            </Pressable>
          </View>

          <View style={{ flex: 1, paddingHorizontal: 14 }}>
            {isLoading ? <ActivityIndicator color="#06A7A1" style={{ marginTop: 18 }} /> : null}
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item.id || `${item.createdAt}-${item.authorHandle}`}
              contentContainerStyle={{ paddingVertical: 16, flexGrow: 1 }}
              ListEmptyComponent={
                !isLoading ? (
                  <View
                    style={{
                      borderRadius: 22,
                      borderWidth: 1,
                      borderColor: "rgba(6,167,161,0.24)",
                      padding: 16,
                      backgroundColor: "rgba(6,167,161,0.08)",
                    }}
                  >
                    <Text style={{ color: textColor, fontWeight: "900" }}>No messages yet.</Text>
                    <Text style={{ color: mutedColor, marginTop: 4, lineHeight: 18 }}>
                      Use this channel for event timing, supplies, meeting spots, and check-in updates.
                    </Text>
                  </View>
                ) : null
              }
              renderItem={({ item }) => {
                const mine = item.authorEmail && userEmail && item.authorEmail.toLowerCase() === userEmail.toLowerCase();
                const vendor = item.authorRole === "vendor";
                const bubbleBg = mine
                  ? "#06A7A1"
                  : vendor
                  ? isDarkMode
                    ? "rgba(128,23,31,0.28)"
                    : "rgba(128,23,31,0.10)"
                  : isDarkMode
                  ? "rgba(255,255,255,0.08)"
                  : "#FFFFFF";
                const bubbleText = mine ? (isDarkMode ? "#FFFFFF" : "#10252B") : textColor;
                return (
                  <View style={{ alignItems: mine ? "flex-end" : "flex-start", marginBottom: 10 }}>
                    <View
                      style={{
                        maxWidth: "86%",
                        borderRadius: 20,
                        paddingHorizontal: 13,
                        paddingVertical: 10,
                        backgroundColor: bubbleBg,
                        borderWidth: 1,
                        borderColor: vendor ? "rgba(255,86,100,0.38)" : "rgba(6,167,161,0.25)",
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                        <Text style={{ color: mine ? bubbleText : "#06A7A1", fontWeight: "900", fontSize: 11 }}>
                          @{item.authorHandle || "cuevas"}
                        </Text>
                        {vendor ? (
                          <View
                            style={{
                              marginLeft: 6,
                              borderRadius: 999,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              backgroundColor: "rgba(255,255,255,0.12)",
                            }}
                          >
                            <Text style={{ color: isDarkMode ? "#FFFFFF" : "#80171F", fontWeight: "900", fontSize: 8 }}>VENDOR</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={{ color: bubbleText, fontWeight: "800", lineHeight: 19 }}>{item.text}</Text>
                      <Text style={{ color: mine ? "rgba(255,255,255,0.75)" : mutedColor, fontSize: 10, marginTop: 5 }}>
                        {formatMessageTime(item.createdAt)}
                      </Text>
                    </View>
                  </View>
                );
              }}
            />
          </View>

          {status ? (
            <Text style={{ color: status.includes("failed") || status.includes("Invalid") ? "#EF4444" : "#06A7A1", fontWeight: "800", fontSize: 12, paddingHorizontal: 18, paddingBottom: 6 }}>
              {status}
            </Text>
          ) : null}

          <View
            style={{
              paddingHorizontal: 12,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 10),
              borderTopWidth: 1,
              borderTopColor: "rgba(6,167,161,0.20)",
              backgroundColor: isDarkMode ? "transparent" : "rgba(255,255,255,0.96)",
              flexDirection: "row",
              alignItems: "flex-end",
              gap: 10,
            }}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={authorRole === "vendor" ? "Coordinate with volunteers..." : "Message the mission group..."}
              placeholderTextColor="#5F6B73"
              multiline
              maxLength={1000}
              style={{
                flex: 1,
                maxHeight: 110,
                minHeight: 46,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: isDarkMode ? "rgba(6,167,161,0.30)" : "rgba(6,167,161,0.48)",
                backgroundColor: isDarkMode ? "rgba(255,255,255,0.07)" : "#FFFFFF",
                color: textColor,
                paddingLeft: 14,
                paddingRight: 14,
                paddingVertical: 11,
                fontWeight: "800",
              }}
            />
            <Pressable
              onPress={sendMessage}
              disabled={!canSend}
              style={({ pressed }) => ({
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#06A7A1",
                borderWidth: isDarkMode ? 0 : 2,
                borderColor: canSend ? "#057D78" : "#8FE7E2",
                shadowColor: "#000",
                shadowOpacity: isDarkMode ? 0 : 0.14,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 3 },
                elevation: isDarkMode ? 0 : 3,
                opacity: pressed || !canSend ? 0.72 : 1,
              })}
              accessibilityLabel="Send mission chat message"
            >
              {isSending ? (
                <ActivityIndicator color={isDarkMode ? "#FFFFFF" : "#111827"} />
              ) : (
                <Ionicons name="send" size={19} color={isDarkMode ? "#FFFFFF" : "#111827"} />
              )}
            </Pressable>
          </View>
        </LinearGradient>
      </KeyboardAvoidingView>
    </Modal>
  );
}

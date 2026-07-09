import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "./Ionicons";
import { REPORT_REASONS, ReportReason } from "../api/moderation-reports";

interface ReportReasonModalProps {
  visible: boolean;
  title: string;
  targetLabel: string;
  isDarkMode: boolean;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (reason: ReportReason) => void;
}

export default function ReportReasonModal({
  visible,
  title,
  targetLabel,
  isDarkMode,
  submitting,
  onCancel,
  onSubmit,
}: ReportReasonModalProps) {
  const [selected, setSelected] = useState<ReportReason>("Spam or scam");
  const text = isDarkMode ? "#CFEFEC" : "#1F2937";
  const sub = isDarkMode ? "#9CA3AF" : "#6B7280";
  const surface = isDarkMode ? "#111827" : "#FFFFFF";
  const rowBg = isDarkMode ? "#17212C" : "#F3F4F6";
  const { height } = useWindowDimensions();
  const modalMaxHeight = Math.min(height - 64, 600);
  const reasonMaxHeight = Math.max(170, Math.min(302, modalMaxHeight - 214));

  useEffect(() => {
    if (visible) setSelected("Spam or scam");
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        onPress={onCancel}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.62)",
          alignItems: "center",
          justifyContent: "center",
          padding: 18,
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            width: "100%",
            maxWidth: 390,
            maxHeight: modalMaxHeight,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: "rgba(250,204,21,0.45)",
            backgroundColor: surface,
            padding: 14,
            overflow: "hidden",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                backgroundColor: "rgba(250,204,21,0.14)",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 10,
              }}
            >
              <Ionicons name="warning-outline" size={22} color="#FACC15" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: text, fontSize: 18, fontWeight: "900" }}>{title}</Text>
              <Text style={{ color: sub, marginTop: 2, fontSize: 12, fontWeight: "700" }}>
                {targetLabel}
              </Text>
            </View>
          </View>

          <ScrollView
            style={{ maxHeight: reasonMaxHeight, flexGrow: 0 }}
            contentContainerStyle={{ paddingTop: 2, paddingBottom: 2 }}
            showsVerticalScrollIndicator={false}
          >
            {REPORT_REASONS.map((reason) => {
              const active = selected === reason;
              return (
                <Pressable
                  key={reason}
                  onPress={() => setSelected(reason)}
                  style={({ pressed }) => ({
                    minHeight: 40,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: active ? "#FACC15" : isDarkMode ? "#374151" : "#E5E7EB",
                    backgroundColor: active ? "rgba(250,204,21,0.12)" : rowBg,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 5,
                    width: "100%",
                    opacity: pressed ? 0.76 : 1,
                  })}
                >
                  <View style={{ width: 26, alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                    <Ionicons
                      name={active ? "radio-button-on" : "radio-button-off"}
                      size={18}
                      color={active ? "#FACC15" : sub}
                    />
                  </View>
                  <Text
                    numberOfLines={3}
                    style={{
                      color: active ? "#FFF7C2" : isDarkMode ? "#E9FFFC" : "#111827",
                      fontSize: 14.5,
                      lineHeight: 18,
                      fontWeight: "900",
                      flex: 1,
                      minWidth: 0,
                      paddingRight: 4,
                      includeFontPadding: false,
                    }}
                  >
                    {reason}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ flexDirection: "row", marginTop: 10 }}>
            <Pressable
              onPress={onCancel}
              disabled={submitting}
              style={({ pressed }) => ({
                flex: 1,
                marginRight: 5,
                minHeight: 46,
                borderRadius: 16,
                backgroundColor: rowBg,
                borderWidth: 1,
                borderColor: isDarkMode ? "#374151" : "#E5E7EB",
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed || submitting ? 0.72 : 1,
              })}
            >
              <Text style={{ color: text, fontWeight: "900" }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => onSubmit(selected)}
              disabled={submitting}
              style={({ pressed }) => ({
                flex: 1,
                marginLeft: 5,
                minHeight: 46,
                borderRadius: 16,
                backgroundColor: "#FACC15",
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed || submitting ? 0.75 : 1,
              })}
            >
              <Text style={{ color: "#111827", fontWeight: "900" }}>
                {submitting ? "Sending..." : "Send Report"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

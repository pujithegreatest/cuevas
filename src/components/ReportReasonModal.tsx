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
  const text = isDarkMode ? "#FFFFFF" : "#1F2937";
  const sub = isDarkMode ? "#D1D5DB" : "#6B7280";
  const surface = isDarkMode ? "#111827" : "#FFFFFF";
  const rowBg = isDarkMode ? "#17212C" : "#F3F4F6";
  const actionBg = isDarkMode ? "rgba(250,204,21,0.14)" : "#FACC15";
  const actionText = isDarkMode ? "#FFFFFF" : "#111827";
  const { height } = useWindowDimensions();
  const modalMaxHeight = Math.min(height - 48, 560);
  const reasonMaxHeight = Math.max(250, Math.min(430, modalMaxHeight - 176));

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
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
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
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 4 }}
            showsVerticalScrollIndicator={false}
          >
            {REPORT_REASONS.map((reason) => {
              const active = selected === reason;
              return (
                <Pressable
                  key={reason}
                  onPress={() => setSelected(reason)}
                  style={({ pressed }) => ({
                    minHeight: 54,
                    paddingHorizontal: 6,
                    paddingVertical: 8,
                    marginBottom: 10,
                    width: "100%",
                    opacity: pressed ? 0.76 : 1,
                  })}
                >
                  <View style={{ width: "100%", flexDirection: "row", alignItems: "center" }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 14,
                        flexShrink: 0,
                      }}
                    >
                      <Ionicons
                        name={active ? "radio-button-on" : "radio-button-off"}
                        size={30}
                        color={active ? "#FACC15" : sub}
                      />
                    </View>
                    <Text
                      numberOfLines={2}
                      style={{
                        color: active ? "#FFF7C2" : isDarkMode ? "#E9FFFC" : "#111827",
                        fontSize: 16,
                        lineHeight: 20,
                        fontWeight: "900",
                        flex: 1,
                        minWidth: 0,
                        paddingRight: 4,
                        includeFontPadding: false,
                      }}
                    >
                      {reason}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 12,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel report"
              onPress={onCancel}
              disabled={submitting}
              style={({ pressed }) => ({
                width: "35%",
                borderRadius: 18,
                paddingVertical: 12,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.75 : submitting ? 0.55 : 1,
                backgroundColor: rowBg,
              })}
            >
              <Text style={{ color: text, fontWeight: "900", fontSize: 15 }}>Cancel</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send report"
              onPress={() => onSubmit(selected)}
              disabled={submitting}
              style={({ pressed }) => ({
                width: "61%",
                borderRadius: 18,
                paddingVertical: 12,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.8 : submitting ? 0.65 : 1,
                backgroundColor: actionBg,
                borderWidth: isDarkMode ? 1 : 0,
                borderColor: "#FACC15",
              })}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="send" size={16} color={actionText} />
                <Text style={{ color: actionText, fontWeight: "900", fontSize: 15, marginLeft: 8 }}>
                  {submitting ? "Sending..." : "Send Report"}
                </Text>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

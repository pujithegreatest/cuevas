import React, { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
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
  const rowBg = isDarkMode ? "#0B1115" : "#F3F4F6";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        onPress={onCancel}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.62)",
          alignItems: "center",
          justifyContent: "center",
          padding: 22,
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            width: "100%",
            maxWidth: 390,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: "rgba(250,204,21,0.45)",
            backgroundColor: surface,
            padding: 18,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 15,
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

          <View>
            {REPORT_REASONS.map((reason) => {
              const active = selected === reason;
              return (
                <Pressable
                  key={reason}
                  onPress={() => setSelected(reason)}
                  style={({ pressed }) => ({
                    minHeight: 44,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: active ? "#FACC15" : isDarkMode ? "#374151" : "#E5E7EB",
                    backgroundColor: active ? "rgba(250,204,21,0.12)" : rowBg,
                    paddingHorizontal: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 8,
                    opacity: pressed ? 0.76 : 1,
                  })}
                >
                  <Ionicons
                    name={active ? "radio-button-on" : "radio-button-off"}
                    size={18}
                    color={active ? "#FACC15" : sub}
                  />
                  <Text style={{ marginLeft: 10, color: text, fontWeight: "800", flex: 1 }}>
                    {reason}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ flexDirection: "row", marginTop: 16 }}>
            <Pressable
              onPress={onCancel}
              disabled={submitting}
              style={({ pressed }) => ({
                flex: 1,
                marginRight: 5,
                minHeight: 48,
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
                minHeight: 48,
                borderRadius: 16,
                backgroundColor: "#FACC15",
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed || submitting ? 0.75 : 1,
              })}
            >
              <Text style={{ color: "#111827", fontWeight: "900" }}>
                {submitting ? "Sending..." : "Report"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

import React from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "./Ionicons";
import { MissionShare } from "../types/feed";

interface MissionShareCardProps {
  mission: MissionShare;
  isDarkMode: boolean;
  compact?: boolean;
  onPress?: () => void;
}

function metaLabel(value?: string | number | null) {
  if (value === undefined || value === null || value === "") return "";
  return String(value);
}

export default function MissionShareCard({
  mission,
  isDarkMode,
  compact,
  onPress,
}: MissionShareCardProps) {
  const text = isDarkMode ? "#CFEFEC" : "#10252B";
  const sub = isDarkMode ? "#9CA3AF" : "#5F6B73";
  const cardBg = isDarkMode ? "rgba(6,43,49,0.72)" : "#F8FFFE";
  const chipBg = isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(6,167,161,0.09)";
  const points = Number(mission.points || 0);
  const handle = mission.businessHandle || "cuevas-partner";

  const details = [
    { icon: "location-outline", label: metaLabel(mission.location) },
    { icon: "calendar-outline", label: metaLabel(mission.eventDate) },
    {
      icon: "hourglass-outline",
      label: mission.durationHours ? `${mission.durationHours} hr` : "",
    },
    { icon: "shield-check", label: metaLabel(mission.difficulty) },
  ].filter((item) => item.label);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }: any) => ({
        marginTop: compact ? 8 : 10,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "rgba(6,167,161,0.38)",
        backgroundColor: cardBg,
        overflow: "hidden",
        opacity: pressed ? 0.78 : 1,
      })}
    >
      <View
        style={{
          height: 6,
          backgroundColor: "#06A7A1",
          opacity: isDarkMode ? 0.85 : 1,
        }}
      />
      <View style={{ padding: compact ? 12 : 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: compact ? 44 : 52,
              height: compact ? 44 : 52,
              borderRadius: compact ? 15 : 17,
              backgroundColor: "#062B31",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <Image
              source={require("../../assets/coin.gif")}
              style={{ width: compact ? 30 : 36, height: compact ? 30 : 36 }}
              contentFit="contain"
            />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
              <Text
                numberOfLines={1}
                style={{
                  color: "#06A7A1",
                  fontSize: 11,
                  fontWeight: "900",
                }}
              >
                @{handle}
              </Text>
              {mission.businessVerified ? (
                <Ionicons name="checkmark-circle" size={13} color="#06A7A1" style={{ marginLeft: 4 }} />
              ) : null}
            </View>
            <Text
              numberOfLines={2}
              style={{
                color: text,
                fontSize: compact ? 15 : 17,
                fontWeight: "900",
                lineHeight: compact ? 18 : 21,
              }}
            >
              {mission.title || "Cuevas Mission"}
            </Text>
          </View>
          {points > 0 ? (
            <View
              style={{
                borderRadius: 999,
                backgroundColor: isDarkMode ? "rgba(6,167,161,0.18)" : "#E8FFFC",
                borderWidth: 1,
                borderColor: "#06A7A1",
                paddingHorizontal: 10,
                paddingVertical: 6,
                marginLeft: 8,
              }}
            >
              <Text style={{ color: "#06A7A1", fontSize: 12, fontWeight: "900" }}>
                +{points} ₡
              </Text>
            </View>
          ) : null}
        </View>

        {mission.description ? (
          <Text
            numberOfLines={compact ? 2 : 3}
            style={{
              color: sub,
              fontSize: compact ? 12 : 13,
              lineHeight: compact ? 17 : 19,
              marginTop: 10,
              fontWeight: "700",
            }}
          >
            {mission.description}
          </Text>
        ) : null}

        {details.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10 }}>
            {details.map((item) => (
              <View
                key={`${item.icon}-${item.label}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderRadius: 999,
                  backgroundColor: chipBg,
                  paddingHorizontal: 9,
                  paddingVertical: 6,
                  marginRight: 7,
                  marginBottom: 7,
                }}
              >
                <Ionicons name={item.icon} size={12} color="#06A7A1" />
                <Text
                  numberOfLines={1}
                  style={{
                    color: sub,
                    fontSize: 10,
                    fontWeight: "800",
                    marginLeft: 5,
                    maxWidth: compact ? 118 : 180,
                  }}
                >
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

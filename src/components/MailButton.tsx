import React from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Mail } from "lucide-react-native";
import { useAppStore } from "../state/appStore";

export default function MailButton({ onPress, unread = 0, label = "Messages" }: { onPress: () => void; unread?: number; label?: string }) {
  const dark = useAppStore((s) => s.isDarkMode);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={({ pressed }) => ({ width: 46, height: 46, opacity: pressed ? 0.75 : 1, marginLeft: 12 })}>
    <LinearGradient colors={dark ? ["#154F58", "#329795", "#735A81", "#123E42"] : ["#D5FFFF", "#9AE9DA", "#E3D3F0", "#CAFAF3"]} locations={[0, 0.4, 0.65, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: 8, borderWidth: 1, borderColor: dark ? "#66D8D3" : "#31B5AE", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <View pointerEvents="none" style={{ position: "absolute", height: 70, width: 7, backgroundColor: "rgba(255,255,255,0.24)", transform: [{ rotate: "35deg" }], left: 9 }} />
      <Mail size={25} color={dark ? "#EAFFFC" : "#075D61"} strokeWidth={1.8} />
    </LinearGradient>
    {unread > 0 && <View style={{ position: "absolute", right: -5, top: -5, borderRadius: 10, minWidth: 19, height: 19, paddingHorizontal: 4, backgroundColor: "#C23E66", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "white", fontSize: 10, fontWeight: "800" }}>{unread > 9 ? "9+" : unread}</Text></View>}
  </Pressable>;
}

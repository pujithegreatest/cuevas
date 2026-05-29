import React, { useEffect } from "react";
import { Text, View, Pressable } from "react-native";
import { Image } from "expo-image";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import { StoryStickerOverlay } from "../types/story";

const EMOJI: Record<StoryStickerOverlay["kind"], string> = {
  custom: "",
  timestamp: "",
  location: "📍",
  fire: "🔥",
  heart: "❤️",
  lightning: "⚡",
  skull: "💀",
  star: "⭐",
  alien: "👽",
  robot: "🤖",
  moon: "🌙",
};

interface Props {
  overlay: StoryStickerOverlay;
  canvasWidth: number;
  canvasHeight: number;
  selected: boolean;
  onSelect: () => void;
  onChange: (next: StoryStickerOverlay) => void;
  onRequestDelete: () => void;
}

export default function DraggableSticker({
  overlay,
  canvasWidth,
  canvasHeight,
  selected,
  onSelect,
  onChange,
  onRequestDelete,
}: Props) {
  const tx = useSharedValue(overlay.x * canvasWidth);
  const ty = useSharedValue(overlay.y * canvasHeight);
  const scale = useSharedValue(overlay.scale);
  const rotation = useSharedValue(overlay.rotation);

  useEffect(() => {
    tx.value = overlay.x * canvasWidth;
    ty.value = overlay.y * canvasHeight;
    scale.value = overlay.scale;
    rotation.value = overlay.rotation;
  }, [overlay.x, overlay.y, overlay.scale, overlay.rotation, canvasWidth, canvasHeight]);

  const pan = Gesture.Pan()
    .onStart(() => {})
    .onUpdate((e) => {
      tx.value = overlay.x * canvasWidth + e.translationX;
      ty.value = overlay.y * canvasHeight + e.translationY;
    })
    .onEnd(() => {
      const nx = Math.max(0, Math.min(1, tx.value / canvasWidth));
      const ny = Math.max(0, Math.min(1, ty.value / canvasHeight));
      runOnJS(onChange)({ ...overlay, x: nx, y: ny });
    });

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const next = Math.max(0.4, Math.min(4, overlay.scale * e.scale));
      scale.value = next;
    })
    .onEnd(() => {
      runOnJS(onChange)({ ...overlay, scale: scale.value });
    });

  const rotate = Gesture.Rotation()
    .onUpdate((e) => {
      rotation.value = overlay.rotation + e.rotation;
    })
    .onEnd(() => {
      runOnJS(onChange)({ ...overlay, rotation: rotation.value });
    });

  const tap = Gesture.Tap()
    .onEnd(() => {
      runOnJS(onSelect)();
    });

  const composed = Gesture.Simultaneous(
    Gesture.Race(tap, pan),
    pinch,
    rotate
  );

  const aStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
      { rotateZ: `${rotation.value}rad` },
    ],
  }));

  const label =
    overlay.imageUri
      ? ""
      : overlay.kind === "custom"
      ? overlay.text || overlay.label || "✨"
      : overlay.kind === "timestamp"
      ? overlay.text || formatNow()
      : EMOJI[overlay.kind];

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
          },
          aStyle,
        ]}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: overlay.kind === "timestamp" ? 10 : 4,
            paddingVertical: overlay.kind === "timestamp" ? 4 : 2,
            borderRadius: 12,
            backgroundColor:
              overlay.kind === "timestamp"
                ? "rgba(0,0,0,0.45)"
                : "transparent",
            borderWidth: selected ? 1 : 0,
            borderColor: "#06A7A1",
          }}
        >
          {overlay.imageUri ? (
            <Image
              source={{ uri: overlay.imageUri }}
              style={{ width: 96, height: 96 }}
              contentFit="contain"
            />
          ) : (
            <Text
              style={{
                color: "#fff",
                fontSize: overlay.kind === "timestamp" ? 16 : 48,
                fontWeight: "800",
                letterSpacing: overlay.kind === "timestamp" ? 1 : 0,
              }}
            >
              {label}
            </Text>
          )}
          {selected && (
            <Pressable
              onPress={onRequestDelete}
              hitSlop={10}
              style={{
                position: "absolute",
                top: -10,
                right: -10,
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: "#80171F",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>
                ×
              </Text>
            </Pressable>
          )}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

function formatNow(): string {
  const d = new Date();
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

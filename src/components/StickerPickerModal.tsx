import React, { useState } from "react";
import { Modal, View, Text, Pressable, ScrollView } from "react-native";
import { Image } from "expo-image";
import { StorySticker, StoryStickerPick } from "../types/story";

interface Props {
  visible: boolean;
  isDarkMode: boolean;
  onClose: () => void;
  onPick: (sticker: StoryStickerPick) => void;
}

const CUEVAS_ITEMS: StoryStickerPick[] = [
  { kind: "custom", label: "Smoke", preview: "💨", text: "💨" },
  { kind: "custom", label: "Money", preview: "🤑", text: "🤑" },
  { kind: "custom", label: "Sleepy", preview: "😴", text: "😴" },
  { kind: "custom", label: "Drool", preview: "🤤", text: "🤤" },
  { kind: "custom", label: "Side Eye", preview: "👀", text: "👀" },
  { kind: "custom", label: "Cash Face", preview: "💵", text: "💵" },
  { kind: "custom", label: "Think", preview: "🤔", text: "🤔" },
  { kind: "custom", label: "Zen", preview: "😌", text: "😌" },
  { kind: "custom", label: "Flex", preview: "👍", text: "👍" },
  { kind: "custom", label: "Bubble", preview: "🫧", text: "🫧" },
  { kind: "custom", label: "Night Cap", preview: "😪", text: "😪" },
  { kind: "custom", label: "Ice", preview: "🥶", text: "🥶" },
  { kind: "custom", label: "Love", preview: "😍", text: "😍" },
  { kind: "custom", label: "Hearts", preview: "😘", text: "😘" },
  { kind: "custom", label: "Cry Beam", preview: "😭", text: "😭" },
  { kind: "custom", label: "Single Tear", preview: "🥲", text: "🥲" },
  { kind: "custom", label: "Glass Eye", preview: "🥹", text: "🥹" },
];

const EMOJI_ITEMS: StoryStickerPick[] = [
  { kind: "timestamp", label: "Time", preview: "🕒" },
  { kind: "location", label: "Spot", preview: "📍" },
  { kind: "fire", label: "Fire", preview: "🔥" },
  { kind: "heart", label: "Love", preview: "❤️" },
  { kind: "lightning", label: "Bolt", preview: "⚡" },
  { kind: "skull", label: "Skull", preview: "💀" },
  { kind: "star", label: "Star", preview: "⭐" },
  { kind: "alien", label: "Alien", preview: "👽" },
  { kind: "robot", label: "Robot", preview: "🤖" },
  { kind: "moon", label: "Moon", preview: "🌙" },
];

export default function StickerPickerModal({
  visible,
  isDarkMode,
  onClose,
  onPick,
}: Props) {
  const [showMore, setShowMore] = useState(false);
  const items = showMore ? EMOJI_ITEMS : CUEVAS_ITEMS;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            width: "100%",
            maxWidth: 360,
            backgroundColor: isDarkMode ? "#1F2937" : "#fff",
            borderRadius: 18,
            padding: 18,
          }}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: "800",
              color: isDarkMode ? "#CFEFEC" : "#1F2937",
              marginBottom: 12,
              textAlign: "center",
            }}
          >
            Pick a Sticker
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
              gap: 8,
            }}
          >
            <Pressable
              onPress={() => setShowMore(false)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: !showMore ? "#06A7A1" : isDarkMode ? "#0b1115" : "#f3f4f6",
              }}
            >
              <Text style={{ color: !showMore ? "#fff" : isDarkMode ? "#CFEFEC" : "#111827", fontWeight: "900" }}>
                Cuevas
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowMore(true)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: showMore ? "#06A7A1" : isDarkMode ? "#0b1115" : "#f3f4f6",
              }}
            >
              <Text style={{ color: showMore ? "#fff" : isDarkMode ? "#CFEFEC" : "#111827", fontWeight: "900" }}>
                More List
              </Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal={false}
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 360 }}
          >
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "space-around",
              }}
            >
              {items.map((it, index) => (
                <Pressable
                  key={`${it.kind}-${it.label || index}`}
                  onPress={() => onPick(it)}
                  style={{
                    width: "30%",
                    aspectRatio: 1,
                    margin: "1.5%",
                    borderRadius: 14,
                    backgroundColor: isDarkMode ? "#0b1115" : "#f3f4f6",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {it.imageUri ? (
                    <Image
                      source={{ uri: it.imageUri }}
                      style={{ width: 50, height: 50 }}
                      contentFit="contain"
                    />
                  ) : (
                    <Text style={{ fontSize: 30 }}>{it.preview}</Text>
                  )}
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      marginTop: 4,
                      color: isDarkMode ? "#9ca3af" : "#4b5563",
                    }}
                  >
                    {it.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

import React from "react";
import { View, Modal, Pressable, Dimensions, StatusBar } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "./Ionicons";

interface ImageViewerModalProps {
  visible: boolean;
  imageUri: string | null;
  onClose: () => void;
}

export default function ImageViewerModal({
  visible,
  imageUri,
  onClose,
}: ImageViewerModalProps) {
  const { width, height } = Dimensions.get("window");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" />
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.95)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {imageUri && (
          <Image
            source={{ uri: imageUri }}
            style={{ width, height: height * 0.9 }}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        )}
        <Pressable
          onPress={onClose}
          style={{
            position: "absolute",
            top: 60,
            right: 20,
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: "rgba(0,0,0,0.5)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="close" size={28} color="white" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

import React from "react";
import { Text, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { StoryTextOverlay } from "../types/story";
import AnimatedStoryText from "./AnimatedStoryText";

interface Props {
  overlay: StoryTextOverlay;
  canvasWidth: number;
  canvasHeight: number;
  selected: boolean;
  onSelect: () => void;
  onChange: (next: StoryTextOverlay) => void;
  onRequestEdit: () => void;
  onRequestDelete?: () => void;
}

export default function DraggableStoryText({
  overlay,
  canvasWidth,
  canvasHeight,
  selected,
  onSelect,
  onChange,
  onRequestEdit,
  onRequestDelete,
}: Props) {
  const tx = useSharedValue(overlay.x * canvasWidth);
  const ty = useSharedValue(overlay.y * canvasHeight);
  const scale = useSharedValue(overlay.scale);
  const rotation = useSharedValue(overlay.rotation);

  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startRot = useSharedValue(0);

  const commit = () => {
    onChange({
      ...overlay,
      x: Math.max(0, Math.min(1, tx.value / canvasWidth)),
      y: Math.max(0, Math.min(1, ty.value / canvasHeight)),
      scale: scale.value,
      rotation: rotation.value,
    });
  };

  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = tx.value;
      startY.value = ty.value;
      runOnJS(onSelect)();
    })
    .onUpdate((e) => {
      tx.value = startX.value + e.translationX;
      ty.value = startY.value + e.translationY;
    })
    .onEnd(() => {
      runOnJS(commit)();
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
      runOnJS(onSelect)();
    })
    .onUpdate((e) => {
      scale.value = Math.max(0.5, Math.min(4, startScale.value * e.scale));
    })
    .onEnd(() => {
      runOnJS(commit)();
    });

  const rot = Gesture.Rotation()
    .onStart(() => {
      startRot.value = rotation.value;
      runOnJS(onSelect)();
    })
    .onUpdate((e) => {
      rotation.value = startRot.value + e.rotation;
    })
    .onEnd(() => {
      runOnJS(commit)();
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      runOnJS(onRequestEdit)();
    });

  const singleTap = Gesture.Tap()
    .onEnd(() => {
      runOnJS(onSelect)();
    });

  const composed = Gesture.Simultaneous(
    pan,
    pinch,
    rot,
    Gesture.Exclusive(doubleTap, singleTap)
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
      { rotateZ: `${rotation.value}rad` },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 10,
            borderWidth: selected ? 1.5 : 0,
            borderColor: "rgba(255,255,255,0.6)",
            borderStyle: "dashed",
            maxWidth: canvasWidth * 0.9,
          },
          animatedStyle,
        ]}
      >
        <AnimatedStoryText overlay={overlay} fontSize={28} />
        {selected && onRequestDelete && (
          <Pressable
            onPress={onRequestDelete}
            hitSlop={10}
            style={{
              position: "absolute",
              top: -10,
              right: -10,
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: "rgba(0,0,0,0.7)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>
              ×
            </Text>
          </Pressable>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

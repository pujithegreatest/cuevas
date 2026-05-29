import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolate,
  interpolateColor,
} from "react-native-reanimated";

type SV = ReturnType<typeof useSharedValue<number>>;
import { StoryTextOverlay } from "../types/story";

interface Props {
  overlay: StoryTextOverlay;
  fontSize?: number;
}

function staticStyle(s: StoryTextOverlay["style"], color: string) {
  switch (s) {
    case "neon":
      return {
        color,
        fontWeight: "800" as const,
        textShadowColor: color,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 12,
      };
    case "mono":
      return {
        color,
        fontWeight: "600" as const,
        fontFamily: "Courier",
        letterSpacing: 1,
      };
    case "chrome":
      return {
        color: "#ffffff",
        fontWeight: "900" as const,
        textShadowColor: "rgba(0,0,0,0.8)",
        textShadowOffset: { width: 1, height: 2 },
        textShadowRadius: 3,
      };
    case "blood":
      return {
        color: "#ffffff",
        fontWeight: "800" as const,
        textShadowColor: "#80171F",
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
      };
    default:
      return { color, fontWeight: "700" as const };
  }
}

function TickerText({ text, fontSize }: { text: string; fontSize: number }) {
  const x = useSharedValue(0);
  const [w, setW] = useState(220);

  useEffect(() => {
    x.value = 0;
    x.value = withRepeat(
      withTiming(-w, { duration: Math.max(4000, w * 30), easing: Easing.linear }),
      -1,
      false
    );
  }, [w]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  const content = `${text}   ★   `;
  return (
    <View
      style={{
        width: Math.max(200, fontSize * 8),
        height: fontSize * 1.6,
        overflow: "hidden",
        backgroundColor: "rgba(0,0,0,0.85)",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#06A7A1",
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <Animated.View style={[{ flexDirection: "row" }, style]}>
        <Text
          onLayout={(e) => setW(e.nativeEvent.layout.width)}
          style={{
            color: "#06A7A1",
            fontSize,
            fontWeight: "800",
            paddingHorizontal: 8,
            letterSpacing: 1,
          }}
        >
          {content}
        </Text>
        <Text
          style={{
            color: "#06A7A1",
            fontSize,
            fontWeight: "800",
            paddingHorizontal: 8,
            letterSpacing: 1,
          }}
        >
          {content}
        </Text>
      </Animated.View>
    </View>
  );
}

function WaveChar({
  ch,
  index,
  t,
  color,
  fontSize,
}: {
  ch: string;
  index: number;
  t: SV;
  color: string;
  fontSize: number;
}) {
  const animStyle = useAnimatedStyle(() => {
    const phase = (t.value * 2 * Math.PI + index * 0.5) % (2 * Math.PI);
    const dy = Math.sin(phase) * (fontSize * 0.18);
    return { transform: [{ translateY: dy }] };
  });
  return (
    <Animated.Text
      style={[
        {
          color,
          fontSize,
          fontWeight: "800",
          textShadowColor: color,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 8,
        },
        animStyle,
      ]}
    >
      {ch === " " ? "\u00A0" : ch}
    </Animated.Text>
  );
}

function WaveText({
  text,
  color,
  fontSize,
}: {
  text: string;
  color: string;
  fontSize: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = 0;
    t.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const chars = Array.from(text);
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {chars.map((ch, i) => (
        <WaveChar
          key={i}
          ch={ch}
          index={i}
          t={t}
          color={color}
          fontSize={fontSize}
        />
      ))}
    </View>
  );
}

function GlitchText({
  text,
  color,
  fontSize,
}: {
  text: string;
  color: string;
  fontSize: number;
}) {
  const shift = useSharedValue(0);
  useEffect(() => {
    shift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 120 }),
        withTiming(-1, { duration: 100 }),
        withTiming(0, { duration: 80 }),
        withTiming(0, { duration: 600 })
      ),
      -1,
      false
    );
  }, []);

  const redStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(shift.value, [-1, 0, 1], [-3, 0, 2]) }],
  }));
  const cyanStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(shift.value, [-1, 0, 1], [3, 0, -2]) }],
  }));
  const mainColor = useAnimatedStyle(() => ({
    color: interpolateColor(shift.value, [-1, 0, 1], [color, "#ffffff", color]),
  }));

  const base = {
    position: "absolute" as const,
    top: 0,
    left: 0,
    fontSize,
    fontWeight: "900" as const,
  };

  return (
    <View style={{ minWidth: fontSize * text.length * 0.55, height: fontSize * 1.2 }}>
      <Animated.Text style={[base, { color: "#ff0040", opacity: 0.75 }, redStyle]}>
        {text}
      </Animated.Text>
      <Animated.Text style={[base, { color: "#00e0ff", opacity: 0.7 }, cyanStyle]}>
        {text}
      </Animated.Text>
      <Animated.Text style={[base, mainColor]}>{text}</Animated.Text>
    </View>
  );
}

export default function AnimatedStoryText({ overlay, fontSize = 28 }: Props) {
  const text = overlay.text || "Tap to edit";

  switch (overlay.style) {
    case "ticker":
      return <TickerText text={text} fontSize={fontSize} />;
    case "wave":
      return <WaveText text={text} color={overlay.color} fontSize={fontSize} />;
    case "glitch":
      return (
        <GlitchText text={text} color={overlay.color} fontSize={fontSize} />
      );
    default: {
      const s = staticStyle(overlay.style, overlay.color);
      return (
        <Text style={[{ fontSize, textAlign: "center" }, s]}>{text}</Text>
      );
    }
  }
}

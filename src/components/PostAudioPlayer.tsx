import React, { useEffect, useRef, useState } from "react";
import { LayoutChangeEvent, Pressable, Text, View } from "react-native";
import { Audio } from "expo-av";
import { Image } from "expo-image";
import { Ionicons } from "./Ionicons";
import { PostAudio } from "../types/feed";

const PLAYHEAD_URI =
  "https://static.wixstatic.com/media/2d1963_8669792e43224b528732c48c4472f5e9~mv2.png";

interface PostAudioPlayerProps {
  audio: PostAudio;
  isDarkMode: boolean;
}

function normalizeWixAudioUrl(uri: string) {
  const base = uri.split("#", 2)[0];
  const wixAudioAsImageMatch = base.match(
    /^https?:\/\/static\.wixstatic\.com\/media\/([^/?#]+)\.(m4a|mp3|aac|wav)~mv2\.jpg$/i
  );
  if (wixAudioAsImageMatch?.[1] && wixAudioAsImageMatch?.[2]) {
    return `https://static.wixstatic.com/mp3/${wixAudioAsImageMatch[1]}.${wixAudioAsImageMatch[2].toLowerCase()}`;
  }
  const wixMediaAudioMatch = base.match(
    /^https?:\/\/static\.wixstatic\.com\/media\/([^/?#]+)~mv2\.(m4a|mp3|aac|wav)$/i
  );
  if (wixMediaAudioMatch?.[1] && wixMediaAudioMatch?.[2]) {
    return `https://static.wixstatic.com/mp3/${wixMediaAudioMatch[1]}.${wixMediaAudioMatch[2].toLowerCase()}`;
  }
  return base;
}

function formatTime(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "0:00";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function PostAudioPlayer({ audio, isDarkMode }: PostAudioPlayerProps) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(audio.durationMs || 0);
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, []);

  const onStatusUpdate = (status: any) => {
    if (!status?.isLoaded) return;
    setIsPlaying(!!status.isPlaying);
    setPositionMs(status.positionMillis || 0);
    if (status.durationMillis) setDurationMs(status.durationMillis);
    if (status.didJustFinish) {
      setIsPlaying(false);
      setPositionMs(0);
      soundRef.current?.setPositionAsync(0).catch(() => {});
    }
  };

  const ensureSound = async () => {
    if (soundRef.current) return soundRef.current;
    const { sound } = await Audio.Sound.createAsync(
      { uri: normalizeWixAudioUrl(audio.uri) },
      { shouldPlay: false },
      onStatusUpdate
    );
    soundRef.current = sound;
    return sound;
  };

  const toggle = async () => {
    const sound = await ensureSound();
    const status: any = await sound.getStatusAsync();
    if (status?.isLoaded && status.isPlaying) {
      await sound.pauseAsync();
    } else {
      await sound.playAsync();
    }
  };

  const handleTrackLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  const seek = async (event: any) => {
    const duration = durationMs || audio.durationMs || 0;
    if (!trackWidth || !duration) return;
    const next = Math.max(0, Math.min(1, event.nativeEvent.locationX / trackWidth)) * duration;
    setPositionMs(next);
    const sound = await ensureSound();
    await sound.setPositionAsync(next);
  };

  const progress = durationMs ? Math.max(0, Math.min(1, positionMs / durationMs)) : 0;

  return (
    <View
      style={{
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "rgba(6,167,161,0.42)",
        borderRadius: 16,
        padding: 14,
        backgroundColor: isDarkMode ? "rgba(6,167,161,0.10)" : "rgba(6,167,161,0.08)",
        shadowColor: "#06A7A1",
        shadowOpacity: 0.22,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 0 },
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
        <Pressable
          onPress={toggle}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: "#06A7A1",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Ionicons name={isPlaying ? "pause" : "play"} size={20} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: isDarkMode ? "#CFEFEC" : "#111827",
              fontSize: 15,
              fontWeight: "900",
            }}
            numberOfLines={1}
          >
            {audio.title || "Cuevas Audio Transmission"}
          </Text>
          <Text
            style={{
              color: isDarkMode ? "#06A7A1" : "#057D78",
              fontSize: 11,
              fontWeight: "800",
              letterSpacing: 1.2,
              marginTop: 3,
            }}
            numberOfLines={1}
          >
            {audio.artist || "CUEVAS SIGNAL"} • {formatTime(positionMs)} / {formatTime(durationMs)}
          </Text>
        </View>
      </View>

      <Pressable
        onLayout={handleTrackLayout}
        onPress={seek}
        style={{
          height: 26,
          justifyContent: "center",
        }}
      >
        <View
          style={{
            height: 7,
            borderRadius: 999,
            backgroundColor: isDarkMode ? "#061A1D" : "#0B1115",
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              backgroundColor: "#FF4757",
            }}
          />
        </View>
        <Image
          source={{ uri: PLAYHEAD_URI }}
          style={{
            position: "absolute",
            left: Math.max(0, progress * Math.max(trackWidth - 28, 0)),
            width: 28,
            height: 28,
            top: -1,
          }}
          contentFit="contain"
        />
      </Pressable>
    </View>
  );
}

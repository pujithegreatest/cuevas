import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  FlatList,
  Image as RNImage,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { Audio } from "expo-av";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "./Ionicons";
import { useAppStore } from "../state/appStore";
import { MUSIC_LIBRARY, LibrarySong, resolveSongSourceUri } from "../utils/musicLibrary";
import { StoryMusic } from "../types/story";

interface MusicPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (music: StoryMusic) => void;
  initialMusic?: StoryMusic | null;
  maxSegmentMs?: number;
}

const SEGMENT_DEFAULT_MS = 15000;
const TIMELINE_WIDTH = Dimensions.get("window").width - 48;
const BAR_COUNT = 48;

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function pseudoBars(seed: string): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const out: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    const norm = (h % 1000) / 1000;
    const wave = Math.sin(i * 0.38) * 0.4 + 0.6;
    out.push(Math.max(0.18, Math.min(1, norm * 0.7 + wave * 0.4)));
  }
  return out;
}

export default function MusicPickerModal({
  visible,
  onClose,
  onSelect,
  initialMusic,
  maxSegmentMs = SEGMENT_DEFAULT_MS,
}: MusicPickerModalProps) {
  const isDarkMode = useAppStore((s) => s.isDarkMode);
  const [stage, setStage] = useState<"list" | "trim">("list");
  const [selectedSong, setSelectedSong] = useState<LibrarySong | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [startMs, setStartMs] = useState(0);
  const [playingMode, setPlayingMode] = useState<"none" | "clip" | "full">("none");
  const [loading, setLoading] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);
  const playStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const segmentMs = Math.min(maxSegmentMs, Math.max(1000, durationMs || maxSegmentMs));
  const offset = useSharedValue(0);
  const startOffset = useSharedValue(0);
  const playheadOffset = useSharedValue(0);

  const playingModeRef = useRef<"none" | "clip" | "full">("none");
  const startMsRef = useRef(0);
  const segmentMsRef = useRef(SEGMENT_DEFAULT_MS);
  const durationMsRef = useRef(0);

  useEffect(() => {
    playingModeRef.current = playingMode;
  }, [playingMode]);
  useEffect(() => {
    startMsRef.current = startMs;
  }, [startMs]);
  useEffect(() => {
    segmentMsRef.current = segmentMs;
  }, [segmentMs]);
  useEffect(() => {
    durationMsRef.current = durationMs;
  }, [durationMs]);

  const setStartFromOffset = (px: number) => {
    if (!durationMs) return;
    const usableWidth = TIMELINE_WIDTH;
    const maxStart = Math.max(0, durationMs - segmentMs);
    const pct = Math.max(0, Math.min(1, px / usableWidth));
    setStartMs(Math.round(maxStart * pct));
  };

  const unload = async () => {
    if (playStopTimerRef.current) {
      clearTimeout(playStopTimerRef.current);
      playStopTimerRef.current = null;
    }
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
    playheadOffset.value = 0;
    setPlayingMode("none");
  };

  useEffect(() => {
    if (!visible) {
      unload();
      setStage("list");
      setSelectedSong(null);
      setDurationMs(0);
      setStartMs(0);
      offset.value = 0;
      playheadOffset.value = 0;
    }
    return () => {
      unload();
    };
  }, [visible]);

  useEffect(() => {
    if (initialMusic && visible) {
      const sng = MUSIC_LIBRARY.find((s) => s.id === initialMusic.id);
      if (sng) {
        handleChooseSong(sng, initialMusic.startMs);
      }
    }
  }, [visible]);

  const handleChooseSong = async (song: LibrarySong, presetStartMs = 0) => {
    setLoading(true);
    setSelectedSong(song);
    setStage("trim");
    await unload();

    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const uri = await resolveSongSourceUri(song);
      if (!uri) {
        setLoading(false);
        return;
      }
      const { sound, status } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false, isLooping: false, volume: 1, progressUpdateIntervalMillis: 60 },
        (s) => {
          if (!s.isLoaded) return;
          const mode = playingModeRef.current;
          const pos = s.positionMillis || 0;
          const dur = s.durationMillis || durationMsRef.current || 1;

          if (mode === "clip") {
            const segStart = startMsRef.current;
            const segLen = segmentMsRef.current;
            const segEnd = segStart + segLen;
            const segWidthPx =
              durationMsRef.current > 0
                ? (segLen / durationMsRef.current) * TIMELINE_WIDTH
                : Math.max(40, 60);
            if (pos >= segEnd - 80 || pos < segStart - 100) {
              soundRef.current
                ?.setPositionAsync(segStart)
                .catch(() => {});
              playheadOffset.value = offset.value;
            } else {
              const rel = Math.max(0, Math.min(segLen, pos - segStart));
              playheadOffset.value =
                offset.value + (rel / segLen) * segWidthPx;
            }
          } else if (mode === "full") {
            playheadOffset.value = (pos / dur) * TIMELINE_WIDTH;
          }

          if ((s as { didJustFinish?: boolean }).didJustFinish) {
            if (playStopTimerRef.current) {
              clearTimeout(playStopTimerRef.current);
              playStopTimerRef.current = null;
            }
            playheadOffset.value = 0;
            setPlayingMode("none");
          }
        }
      );
      soundRef.current = sound;
      let dur = 0;
      if (status.isLoaded && status.durationMillis) {
        dur = status.durationMillis;
      }
      setDurationMs(dur || song.durationMs || 60000);
      const maxStart = Math.max(0, (dur || song.durationMs || 60000) - segmentMs);
      const clampedStart = Math.max(0, Math.min(maxStart, presetStartMs));
      setStartMs(clampedStart);
      const pct = maxStart > 0 ? clampedStart / maxStart : 0;
      offset.value = pct * TIMELINE_WIDTH;
    } catch {}
    setLoading(false);
  };

  const stopPlayback = async () => {
    if (playStopTimerRef.current) {
      clearTimeout(playStopTimerRef.current);
      playStopTimerRef.current = null;
    }
    const sound = soundRef.current;
    if (sound) {
      try {
        const s = await sound.getStatusAsync();
        if (s.isLoaded && s.isPlaying) {
          await sound.pauseAsync();
        }
      } catch {}
    }
    playheadOffset.value = 0;
    playingModeRef.current = "none";
    setPlayingMode("none");
  };

  const playClip = async () => {
    const sound = soundRef.current;
    if (!sound) return;
    try {
      if (playStopTimerRef.current) {
        clearTimeout(playStopTimerRef.current);
        playStopTimerRef.current = null;
      }
      const s = await sound.getStatusAsync();
      if (!s.isLoaded) return;
      playingModeRef.current = "clip";
      setPlayingMode("clip");
      playheadOffset.value = 0;
      await sound.playFromPositionAsync(startMs);
    } catch {
      setPlayingMode("none");
    }
  };

  const playFull = async () => {
    const sound = soundRef.current;
    if (!sound) return;
    try {
      if (playStopTimerRef.current) {
        clearTimeout(playStopTimerRef.current);
        playStopTimerRef.current = null;
      }
      const s = await sound.getStatusAsync();
      if (!s.isLoaded) return;
      playingModeRef.current = "full";
      setPlayingMode("full");
      playheadOffset.value = 0;
      await sound.playFromPositionAsync(0);
    } catch {
      setPlayingMode("none");
    }
  };

  const togglePreviewClip = async () => {
    if (loading) return;
    if (playingMode === "clip") {
      await stopPlayback();
    } else {
      await stopPlayback();
      await playClip();
    }
  };

  const togglePlayFull = async () => {
    if (loading) return;
    if (playingMode === "full") {
      await stopPlayback();
    } else {
      await stopPlayback();
      await playFull();
    }
  };

  const handleConfirm = async () => {
    if (!selectedSong) return;
    const endMs = Math.min(durationMs || startMs + segmentMs, startMs + segmentMs);
    await unload();
    onSelect({ id: selectedSong.id, startMs, endMs });
    onClose();
  };

  const pan = Gesture.Pan()
    .onBegin(() => {
      startOffset.value = offset.value;
    })
    .onUpdate((e) => {
      const next = Math.max(0, Math.min(TIMELINE_WIDTH, startOffset.value + e.translationX));
      offset.value = next;
      runOnJS(setStartFromOffset)(next);
    })
    .onEnd(() => {
      offset.value = withTiming(offset.value, { duration: 80, easing: Easing.out(Easing.ease) });
    });

  const cursorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  const playheadStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: playheadOffset.value }],
  }));

  const bars = selectedSong ? pseudoBars(selectedSong.id) : [];
  const bg = isDarkMode ? "#1a1a1a" : "#ffffff";
  const text = isDarkMode ? "#CFEFEC" : "#1F2937";
  const sub = isDarkMode ? "#888" : "#6B7280";
  const accent = "#06A7A1";
  const surface = isDarkMode ? "#2a2a2a" : "#F3F4F6";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: bg }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: isDarkMode ? "#333" : "#E5E7EB",
            }}
          >
            <Pressable
              onPress={
                stage === "trim"
                  ? async () => {
                      await stopPlayback();
                      setStage("list");
                    }
                  : async () => {
                      await unload();
                      onClose();
                    }
              }
              hitSlop={10}
            >
              <Ionicons
                name={stage === "trim" ? "chevron-back" : "close"}
                size={26}
                color={text}
              />
            </Pressable>
            <Text style={{ color: text, fontWeight: "700", fontSize: 16 }}>
              {stage === "list" ? "Add music" : "Choose section"}
            </Text>
            <View style={{ width: 26 }} />
          </View>

          {stage === "list" ? (
            <FlatList
              data={MUSIC_LIBRARY}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingVertical: 8 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleChooseSong(item)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                  }}
                >
                  <RNImage
                    source={item.cover}
                    style={{ width: 52, height: 52, borderRadius: 8 }}
                  />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ color: text, fontWeight: "700", fontSize: 15 }} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={{ color: sub, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                      {item.artist}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: accent,
                    }}
                  >
                    <Ionicons name="add" size={20} color="#fff" />
                  </View>
                </Pressable>
              )}
            />
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {selectedSong && (
                <View style={{ alignItems: "center" }}>
                  <RNImage
                    source={selectedSong.cover}
                    style={{ width: 220, height: 220, borderRadius: 16, marginBottom: 18 }}
                  />
                  <Text style={{ color: text, fontWeight: "800", fontSize: 18 }} numberOfLines={1}>
                    {selectedSong.title}
                  </Text>
                  <Text style={{ color: sub, fontSize: 13, marginTop: 4 }}>{selectedSong.artist}</Text>

                  <View
                    style={{
                      marginTop: 18,
                      flexDirection: "row",
                      gap: 10,
                    }}
                  >
                    <Pressable
                      onPress={togglePreviewClip}
                      disabled={loading}
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 16,
                        borderRadius: 999,
                        backgroundColor: playingMode === "clip" ? "#80171F" : accent,
                        flexDirection: "row",
                        alignItems: "center",
                      }}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons
                            name={playingMode === "clip" ? "pause" : "play"}
                            size={16}
                            color="#fff"
                          />
                          <Text style={{ color: "#fff", fontWeight: "700", marginLeft: 8, fontSize: 13 }}>
                            {playingMode === "clip" ? "Pause clip" : "Preview clip"}
                          </Text>
                        </>
                      )}
                    </Pressable>
                    <Pressable
                      onPress={togglePlayFull}
                      disabled={loading}
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 16,
                        borderRadius: 999,
                        backgroundColor: playingMode === "full" ? "#80171F" : "transparent",
                        borderWidth: 1.5,
                        borderColor: playingMode === "full" ? "#80171F" : accent,
                        flexDirection: "row",
                        alignItems: "center",
                      }}
                    >
                      <Ionicons
                        name={playingMode === "full" ? "pause" : "musical-notes"}
                        size={16}
                        color={playingMode === "full" ? "#fff" : accent}
                      />
                      <Text
                        style={{
                          color: playingMode === "full" ? "#fff" : accent,
                          fontWeight: "700",
                          marginLeft: 8,
                          fontSize: 13,
                        }}
                      >
                        {playingMode === "full" ? "Pause" : "Full song"}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={{ marginTop: 28, width: "100%" }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                    >
                      <Text style={{ color: sub, fontSize: 12 }}>
                        Start {formatTime(startMs)}
                      </Text>
                      <Text style={{ color: sub, fontSize: 12 }}>
                        {Math.round(segmentMs / 1000)}s clip
                      </Text>
                      <Text style={{ color: sub, fontSize: 12 }}>
                        Track {formatTime(durationMs)}
                      </Text>
                    </View>

                    <GestureDetector gesture={pan}>
                      <View
                        style={{
                          height: 64,
                          backgroundColor: surface,
                          borderRadius: 12,
                          overflow: "hidden",
                          flexDirection: "row",
                          alignItems: "flex-end",
                          paddingHorizontal: 6,
                        }}
                      >
                        {bars.map((b, i) => (
                          <View
                            key={i}
                            style={{
                              flex: 1,
                              marginHorizontal: 1,
                              height: 56 * b,
                              backgroundColor: isDarkMode ? "#3a3a3a" : "#D1D5DB",
                              borderRadius: 2,
                            }}
                          />
                        ))}
                        <Animated.View
                          pointerEvents="none"
                          style={[
                            {
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: Math.max(
                                40,
                                durationMs > 0 ? (segmentMs / durationMs) * TIMELINE_WIDTH : 60
                              ),
                              height: "100%",
                              borderRadius: 12,
                              borderWidth: 3,
                              borderColor: accent,
                              backgroundColor: `${accent}33`,
                            },
                            cursorStyle,
                          ]}
                        />
                        {playingMode !== "none" && (
                          <Animated.View
                            pointerEvents="none"
                            style={[
                              {
                                position: "absolute",
                                top: -4,
                                left: 0,
                                width: 3,
                                height: 72,
                                borderRadius: 2,
                                backgroundColor: "#ffffff",
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 0 },
                                shadowOpacity: 0.6,
                                shadowRadius: 4,
                              },
                              playheadStyle,
                            ]}
                          />
                        )}
                      </View>
                    </GestureDetector>

                    <Text style={{ color: sub, fontSize: 11, marginTop: 6, textAlign: "center" }}>
                      Drag to choose the part of the song that plays under your post.
                    </Text>
                  </View>

                  <Pressable
                    onPress={handleConfirm}
                    style={{
                      marginTop: 24,
                      paddingVertical: 14,
                      borderRadius: 14,
                      backgroundColor: accent,
                      width: "100%",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
                      Use this clip
                    </Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

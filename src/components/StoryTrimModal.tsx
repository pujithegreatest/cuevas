import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  Dimensions,
  StatusBar,
  StyleSheet,
} from "react-native";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import * as VideoThumbnails from "expo-video-thumbnails";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from "react-native-reanimated";
import { Ionicons } from "./Ionicons";
import { LiveFilterHud } from "./StoryFilterCanvas";
import { StoryFilter } from "../types/story";

interface StoryTrimModalProps {
  visible: boolean;
  videoUri: string;
  liveFilter?: StoryFilter | null;
  initialDurationMs?: number;
  maxClipMs?: number;
  onCancel: () => void;
  onConfirm: (result: {
    startMs: number;
    endMs: number;
    durationMs: number;
  }) => void;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const TRACK_HORIZONTAL_MARGIN = 28;
const TRACK_WIDTH = SCREEN_W - TRACK_HORIZONTAL_MARGIN * 2;
const HANDLE_WIDTH = 16;
const HANDLE_HIT_PAD = 22;
const WRAPPER_PAD = HANDLE_WIDTH / 2 + HANDLE_HIT_PAD;
const WRAPPER_WIDTH = TRACK_WIDTH + WRAPPER_PAD * 2;
const TRACK_HEIGHT = 56;
const HANDLE_OVERHANG = 8;
const WRAPPER_HEIGHT = TRACK_HEIGHT + HANDLE_OVERHANG * 2;
const THUMB_COUNT = 8;
const PREVIEW_HEIGHT = SCREEN_H * 0.6;

const formatTime = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const tenths = Math.max(0, Math.floor((ms % 1000) / 100));
  return `${String(s).padStart(2, "0")}.${tenths}s`;
};

export default function StoryTrimModal({
  visible,
  videoUri,
  liveFilter,
  initialDurationMs,
  maxClipMs = 15000,
  onCancel,
  onConfirm,
}: StoryTrimModalProps) {
  const videoRef = useRef<Video | null>(null);
  const [durationMs, setDurationMs] = useState<number>(initialDurationMs || 0);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const startMs = useSharedValue(0);
  const endMs = useSharedValue(0);
  const playheadMs = useSharedValue(0);

  const [displayStart, setDisplayStart] = useState(0);
  const [displayEnd, setDisplayEnd] = useState(0);

  const pendingStartRef = useRef(0);
  const pendingEndRef = useRef(0);
  const seekDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      setDurationMs(initialDurationMs || 0);
      setThumbs([]);
      setIsReady(false);
      setErrorMsg(null);
      startMs.value = 0;
      endMs.value = 0;
      playheadMs.value = 0;
      setDisplayStart(0);
      setDisplayEnd(0);
    }
  }, [visible]);

  useEffect(() => {
    if (visible && durationMs > 0 && thumbs.length === 0) {
      generateThumbs(durationMs);
    }
  }, [visible, durationMs]);

  const generateThumbs = async (totalMs: number) => {
    try {
      const out: string[] = [];
      for (let i = 0; i < THUMB_COUNT; i++) {
        const time = (i / (THUMB_COUNT - 1)) * Math.max(1, totalMs - 100);
        try {
          const t = await VideoThumbnails.getThumbnailAsync(videoUri, {
            time: Math.floor(time),
            quality: 0.4,
          });
          out.push(t.uri);
        } catch {
          out.push("");
        }
      }
      setThumbs(out);
    } catch {
      // ignore — render colored placeholders
    }
  };

  const initRange = (totalMs: number) => {
    const clip = Math.min(totalMs, maxClipMs);
    startMs.value = 0;
    endMs.value = clip;
    playheadMs.value = 0;
    pendingStartRef.current = 0;
    pendingEndRef.current = clip;
    setDisplayStart(0);
    setDisplayEnd(clip);
  };

  const onVideoLoad = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    const d = status.durationMillis || 0;
    if (d > 0 && (!durationMs || Math.abs(d - durationMs) > 50)) {
      setDurationMs(d);
      initRange(d);
    } else if (durationMs > 0 && endMs.value === 0) {
      initRange(durationMs);
    }
    setIsReady(true);
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    const pos = status.positionMillis || 0;
    playheadMs.value = pos;
    if (pos >= endMs.value - 30 && status.isPlaying) {
      videoRef.current?.setPositionAsync(startMs.value).catch(() => {});
    }
  };

  const commitStart = (ms: number) => {
    pendingStartRef.current = ms;
    setDisplayStart(ms);
    if (seekDebounceRef.current) clearTimeout(seekDebounceRef.current);
    seekDebounceRef.current = setTimeout(() => {
      videoRef.current?.setPositionAsync(ms).catch(() => {});
    }, 40);
  };

  const commitEnd = (ms: number) => {
    pendingEndRef.current = ms;
    setDisplayEnd(ms);
    if (seekDebounceRef.current) clearTimeout(seekDebounceRef.current);
    seekDebounceRef.current = setTimeout(() => {
      const previewTarget = Math.max(0, ms - 600);
      videoRef.current?.setPositionAsync(previewTarget).catch(() => {});
    }, 40);
  };

  const total = Math.max(1, durationMs);

  const startPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .hitSlop({
          top: HANDLE_OVERHANG + 12,
          bottom: HANDLE_OVERHANG + 12,
          left: HANDLE_HIT_PAD,
          right: HANDLE_HIT_PAD,
        })
        .onChange((e) => {
          const deltaMs = (e.changeX / TRACK_WIDTH) * total;
          let next = startMs.value + deltaMs;
          const minAllowed = 0;
          const maxAllowed = endMs.value - 500;
          if (next < minAllowed) next = minAllowed;
          if (next > maxAllowed) next = maxAllowed;
          if (endMs.value - next > maxClipMs) {
            next = endMs.value - maxClipMs;
          }
          startMs.value = next;
          runOnJS(commitStart)(next);
        })
        .onEnd(() => {
          runOnJS(commitStart)(startMs.value);
        }),
    [total]
  );

  const endPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .hitSlop({
          top: HANDLE_OVERHANG + 12,
          bottom: HANDLE_OVERHANG + 12,
          left: HANDLE_HIT_PAD,
          right: HANDLE_HIT_PAD,
        })
        .onChange((e) => {
          const deltaMs = (e.changeX / TRACK_WIDTH) * total;
          let next = endMs.value + deltaMs;
          const minAllowed = startMs.value + 500;
          const maxAllowed = total;
          if (next < minAllowed) next = minAllowed;
          if (next > maxAllowed) next = maxAllowed;
          if (next - startMs.value > maxClipMs) {
            next = startMs.value + maxClipMs;
          }
          endMs.value = next;
          runOnJS(commitEnd)(next);
        })
        .onEnd(() => {
          runOnJS(commitEnd)(endMs.value);
        }),
    [total]
  );

  const startHandleStyle = useAnimatedStyle(() => ({
    left: WRAPPER_PAD + (startMs.value / total) * TRACK_WIDTH - HANDLE_WIDTH / 2,
  }));
  const endHandleStyle = useAnimatedStyle(() => ({
    left: WRAPPER_PAD + (endMs.value / total) * TRACK_WIDTH - HANDLE_WIDTH / 2,
  }));
  const selectionStyle = useAnimatedStyle(() => {
    const left = (startMs.value / total) * TRACK_WIDTH;
    const width = ((endMs.value - startMs.value) / total) * TRACK_WIDTH;
    return { left, width: Math.max(0, width) };
  });
  const playheadStyle = useAnimatedStyle(() => ({
    left: (playheadMs.value / total) * TRACK_WIDTH - 1,
    opacity:
      playheadMs.value >= startMs.value && playheadMs.value <= endMs.value
        ? 1
        : 0,
  }));

  const leftDimStyle = useAnimatedStyle(() => ({
    width: (startMs.value / total) * TRACK_WIDTH,
  }));
  const rightDimStyle = useAnimatedStyle(() => ({
    width: TRACK_WIDTH - (endMs.value / total) * TRACK_WIDTH,
  }));

  const handleConfirm = () => {
    if (!isReady || durationMs <= 0) {
      setErrorMsg("Loading video — try again in a sec.");
      return;
    }
    const s = pendingStartRef.current;
    const e = pendingEndRef.current;
    if (e - s < 400) {
      setErrorMsg("Clip too short — drag the handles wider.");
      return;
    }
    onConfirm({
      startMs: Math.floor(s),
      endMs: Math.floor(e),
      durationMs: Math.floor(e - s),
    });
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="overFullScreen"
      transparent
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <StatusBar hidden />
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000" }}>
        <View style={{ flex: 1 }}>
          {/* Header */}
          <LinearGradient
            colors={["rgba(0,0,0,0.85)", "transparent"]}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 120,
              zIndex: 2,
            }}
            pointerEvents="none"
          />
          <View
            style={{
              position: "absolute",
              top: 56,
              left: 16,
              right: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              zIndex: 3,
            }}
          >
            <Pressable onPress={onCancel} hitSlop={10}>
              <Ionicons name="close" size={28} color="white" />
            </Pressable>
            <Text
              style={{
                color: "white",
                fontWeight: "800",
                letterSpacing: 1.2,
              }}
            >
              TRIM CLIP
            </Text>
            <Pressable
              onPress={handleConfirm}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                backgroundColor: "#06A7A1",
                borderRadius: 18,
              }}
            >
              <Text style={{ color: "white", fontWeight: "800" }}>Next</Text>
            </Pressable>
          </View>

          {/* Video preview */}
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: SCREEN_W,
                height: PREVIEW_HEIGHT,
                overflow: "hidden",
              }}
            >
              <Video
                ref={videoRef}
                source={{ uri: videoUri }}
                style={{ width: SCREEN_W, height: PREVIEW_HEIGHT }}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                isLooping
                isMuted={false}
                volume={1}
                onLoad={onVideoLoad}
                onPlaybackStatusUpdate={onPlaybackStatusUpdate}
              />
              {liveFilter && liveFilter !== "none" ? (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <LiveFilterHud
                    filter={liveFilter}
                    width={SCREEN_W}
                    height={PREVIEW_HEIGHT}
                    showColorLayer
                  />
                </View>
              ) : null}
            </View>
          </View>

          {/* Bottom panel */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.9)"]}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 220,
            }}
            pointerEvents="none"
          />

          <View
            style={{
              position: "absolute",
              bottom: 32,
              left: 0,
              right: 0,
              alignItems: "center",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                width: TRACK_WIDTH,
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  color: "#06A7A1",
                  fontWeight: "700",
                  fontFamily: "Courier",
                  fontSize: 12,
                }}
              >
                IN {formatTime(displayStart)}
              </Text>
              <Text
                style={{
                  color: "white",
                  fontWeight: "800",
                  fontFamily: "Courier",
                  fontSize: 13,
                }}
              >
                {formatTime(displayEnd - displayStart)}
              </Text>
              <Text
                style={{
                  color: "#06A7A1",
                  fontWeight: "700",
                  fontFamily: "Courier",
                  fontSize: 12,
                }}
              >
                OUT {formatTime(displayEnd)}
              </Text>
            </View>

            {/* Track wrapper — no clipping; holds inner track and handles as siblings */}
            <View
              style={{
                width: WRAPPER_WIDTH,
                height: WRAPPER_HEIGHT,
                justifyContent: "center",
              }}
            >
              {/* Inner filmstrip-track — clipped */}
              <View
                style={{
                  position: "absolute",
                  left: WRAPPER_PAD,
                  top: HANDLE_OVERHANG,
                  width: TRACK_WIDTH,
                  height: TRACK_HEIGHT,
                  borderRadius: 10,
                  overflow: "hidden",
                  backgroundColor: "#111",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.12)",
                }}
              >
                <View style={{ flexDirection: "row", flex: 1 }}>
                  {Array.from({ length: THUMB_COUNT }).map((_, i) => {
                    const thumb = thumbs[i];
                    return (
                      <View
                        key={i}
                        style={{
                          flex: 1,
                          backgroundColor: "#222",
                          overflow: "hidden",
                        }}
                      >
                        {thumb ? (
                          <Image
                            source={{ uri: thumb }}
                            style={{ width: "100%", height: "100%" }}
                            contentFit="cover"
                          />
                        ) : null}
                      </View>
                    );
                  })}
                </View>

                {/* Dim left/right of selection */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    {
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      backgroundColor: "rgba(0,0,0,0.55)",
                      left: 0,
                    },
                    leftDimStyle,
                  ]}
                />
                <Animated.View
                  pointerEvents="none"
                  style={[
                    {
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      backgroundColor: "rgba(0,0,0,0.55)",
                      right: 0,
                    },
                    rightDimStyle,
                  ]}
                />

                {/* Selection outline */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    {
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      borderTopWidth: 2,
                      borderBottomWidth: 2,
                      borderColor: "#06A7A1",
                    },
                    selectionStyle,
                  ]}
                />

                {/* Playhead */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    {
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      width: 2,
                      backgroundColor: "#ffffff",
                    },
                    playheadStyle,
                  ]}
                />
              </View>

              {/* Handles — siblings of inner track, not clipped */}
              <GestureDetector gesture={startPanGesture}>
                <Animated.View
                  style={[
                    {
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      width: HANDLE_WIDTH,
                      backgroundColor: "#06A7A1",
                      borderRadius: 4,
                      alignItems: "center",
                      justifyContent: "center",
                    },
                    startHandleStyle,
                  ]}
                >
                  <View
                    style={{
                      width: 2,
                      height: 16,
                      backgroundColor: "white",
                      borderRadius: 1,
                    }}
                  />
                </Animated.View>
              </GestureDetector>

              <GestureDetector gesture={endPanGesture}>
                <Animated.View
                  style={[
                    {
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      width: HANDLE_WIDTH,
                      backgroundColor: "#06A7A1",
                      borderRadius: 4,
                      alignItems: "center",
                      justifyContent: "center",
                    },
                    endHandleStyle,
                  ]}
                >
                  <View
                    style={{
                      width: 2,
                      height: 16,
                      backgroundColor: "white",
                      borderRadius: 1,
                    }}
                  />
                </Animated.View>
              </GestureDetector>
            </View>

            <Text
              style={{
                color: "rgba(255,255,255,0.55)",
                fontSize: 11,
                marginTop: 10,
                fontFamily: "Courier",
                letterSpacing: 1,
              }}
            >
              MAX {Math.round(maxClipMs / 1000)}s • DRAG HANDLES TO TRIM
            </Text>

            {errorMsg && (
              <Text
                style={{
                  color: "#ff8080",
                  fontSize: 12,
                  marginTop: 6,
                  fontWeight: "700",
                }}
              >
                {errorMsg}
              </Text>
            )}
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

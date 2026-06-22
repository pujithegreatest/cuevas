import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
} from "react-native";
import {
  CameraView,
  CameraType,
  CameraMode,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";
import { Audio } from "expo-av";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
  Easing,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "./Ionicons";
import StoryFilterCanvas, { LiveFilterHud } from "./StoryFilterCanvas";
import { StoryFilter } from "../types/story";

interface StoryCameraModalProps {
  visible: boolean;
  onClose: () => void;
  onCapture: (asset: {
    uri: string;
    type: "image" | "video";
    durationMs?: number;
    liveFilter?: StoryFilter;
  }) => void;
  onPickLibrary?: () => void;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const MAX_RECORD_MS = 15000;
const LIVE_SNAPSHOT_PREVIEW_MS = 520;
const RECORD_BTN_SIZE = 84;
const RING_SIZE = 104;
type LiveFilter =
  | "none"
  | "heatwave"
  | "hologram"
  | "glitch"
  | "matrix"
  | "scanner"
  | "xray"
  | "infrared"
  | "neon"
  | "vaporwave"
  | "thermal"
  | "predator"
  | "chrome"
  | "radioactive"
  | "void";

const LIVE_FILTER_OPTIONS: {
  id: Exclude<LiveFilter, "none">;
  label: string;
  icon: string;
  accent: string;
}[] = [
  { id: "heatwave", label: "Heatwave", icon: "flame-outline", accent: "#ff9f1c" },
  { id: "hologram", label: "Holo ID", icon: "sparkles-outline", accent: "#00eaff" },
  { id: "glitch", label: "Signal", icon: "flash-outline", accent: "#ff3bd4" },
  { id: "matrix", label: "Code ID", icon: "pulse-outline", accent: "#58ff39" },
  { id: "scanner", label: "Sweep", icon: "qr-code-outline", accent: "#00ffc8" },
  { id: "xray", label: "Bone", icon: "eye-outline", accent: "#cfefff" },
  { id: "infrared", label: "IR Lock", icon: "radio-button-on-outline", accent: "#ff2d55" },
  { id: "neon", label: "Circuit", icon: "flash-outline", accent: "#00f5ff" },
  { id: "vaporwave", label: "Synth", icon: "color-wand-outline", accent: "#ff4dff" },
  { id: "thermal", label: "Heatmap", icon: "sunny", accent: "#ff6a00" },
  { id: "predator", label: "Tracker", icon: "radio-button-on-outline", accent: "#ff4d26" },
  { id: "chrome", label: "LiDAR", icon: "globe-outline", accent: "#dbeafe" },
  { id: "radioactive", label: "Rad", icon: "flash-outline", accent: "#b6ff00" },
  { id: "void", label: "Gravity", icon: "moon", accent: "#9b87ff" },
];

export default function StoryCameraModal({
  visible,
  onClose,
  onCapture,
  onPickLibrary,
}: StoryCameraModalProps) {
  const cameraRef = useRef<CameraView | null>(null);
  const [facing, setFacing] = useState<CameraType>("back");
  const [mode, setMode] = useState<CameraMode>("picture");
  const [cameraMode, setCameraMode] = useState<CameraMode>("picture");
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [liveFilter, setLiveFilter] = useState<LiveFilter>("none");
  const [cameraReady, setCameraReady] = useState(false);
  const [previewFrameUri, setPreviewFrameUri] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const progress = useSharedValue(0);
  const redDot = useSharedValue(0);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewFrameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPreviewCaptureInFlightRef = useRef(false);
  const isFinalCaptureInFlightRef = useRef(false);
  const recordStartRef = useRef<number>(0);
  const cameraModeRef = useRef<CameraMode>("picture");
  const shouldUseSnapshotPreview =
    visible &&
    permission?.granted &&
    cameraReady &&
    mode === "picture" &&
    cameraMode === "picture" &&
    !isRecording &&
    liveFilter !== "none";
  const isShowingSnapshotPreview =
    shouldUseSnapshotPreview && previewFrameUri !== null;

  const setNativeCameraMode = (nextMode: CameraMode) => {
    cameraModeRef.current = nextMode;
    setCameraMode(nextMode);
  };

  const prepareNativeCameraMode = async (nextMode: CameraMode) => {
    if (cameraModeRef.current === nextMode) return;
    setNativeCameraMode(nextMode);
    await new Promise((resolve) => setTimeout(resolve, 180));
  };

  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    if (mode !== "video") return;
    let cancelled = false;
    (async () => {
      if (!micPermission?.granted) {
        try {
          await requestMicPermission();
        } catch {}
      }
      if (cancelled) return;
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: true,
          staysActiveInBackground: false,
        });
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, mode]);

  useEffect(() => {
    if (!visible) {
      cleanupRecording();
      setIsRecording(false);
      setElapsedMs(0);
      setMode("picture");
      setNativeCameraMode("picture");
      setLiveFilter("none");
      setCameraReady(false);
      setPreviewFrameUri(null);
      setErrorMsg(null);
      progress.value = 0;
      redDot.value = 0;
    }
  }, [visible]);

  useEffect(() => {
    if (!shouldUseSnapshotPreview) {
      if (previewFrameTimerRef.current) {
        clearTimeout(previewFrameTimerRef.current);
        previewFrameTimerRef.current = null;
      }
      isPreviewCaptureInFlightRef.current = false;
      setPreviewFrameUri(null);
      return;
    }

    let cancelled = false;

    const scheduleNextPreviewFrame = () => {
      if (!cancelled) {
        previewFrameTimerRef.current = setTimeout(
          capturePreviewFrame,
          LIVE_SNAPSHOT_PREVIEW_MS
        );
      }
    };

    const capturePreviewFrame = async () => {
      if (
        cancelled ||
        !cameraRef.current ||
        isPreviewCaptureInFlightRef.current ||
        isFinalCaptureInFlightRef.current ||
        cameraModeRef.current !== "picture"
      ) {
        scheduleNextPreviewFrame();
        return;
      }

      isPreviewCaptureInFlightRef.current = true;
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.35,
          skipProcessing: true,
          shutterSound: false,
        });
        if (!cancelled && photo?.uri) {
          setPreviewFrameUri(photo.uri);
        }
      } catch {
        if (!cancelled) {
          setPreviewFrameUri(null);
        }
      } finally {
        isPreviewCaptureInFlightRef.current = false;
        scheduleNextPreviewFrame();
      }
    };

    previewFrameTimerRef.current = setTimeout(capturePreviewFrame, 120);

    return () => {
      cancelled = true;
      if (previewFrameTimerRef.current) {
        clearTimeout(previewFrameTimerRef.current);
        previewFrameTimerRef.current = null;
      }
    };
  }, [shouldUseSnapshotPreview, liveFilter, facing]);

  useEffect(() => {
    if (isRecording) {
      redDot.value = withTiming(1, {
        duration: 600,
        easing: Easing.inOut(Easing.ease),
      });
      const loop = () => {
        redDot.value = withTiming(
          redDot.value > 0.5 ? 0 : 1,
          { duration: 600 },
          () => {}
        );
      };
      const id = setInterval(loop, 600);
      return () => clearInterval(id);
    } else {
      redDot.value = 0;
    }
  }, [isRecording]);

  const cleanupRecording = () => {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    cancelAnimation(progress);
  };

  const handleClose = () => {
    if (isRecording) {
      try {
        cameraRef.current?.stopRecording();
      } catch {}
    }
    cleanupRecording();
    onClose();
  };

  const flipCamera = () => {
    if (isRecording) return;
    setCameraReady(false);
    setPreviewFrameUri(null);
    setFacing((f) => (f === "back" ? "front" : "back"));
  };

  const handleTakePhoto = async () => {
    setErrorMsg(null);
    if (!cameraRef.current) return;
    try {
      isFinalCaptureInFlightRef.current = true;
      if (previewFrameTimerRef.current) {
        clearTimeout(previewFrameTimerRef.current);
        previewFrameTimerRef.current = null;
      }
      for (let i = 0; i < 10 && isPreviewCaptureInFlightRef.current; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      await prepareNativeCameraMode("picture");
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: true,
        shutterSound: false,
      });
      if (photo?.uri) {
        onCapture({
          uri: photo.uri,
          type: "image",
          liveFilter: liveFilter === "none" ? undefined : liveFilter,
        });
      }
    } catch {
      setErrorMsg("Failed to take photo.");
    } finally {
      isFinalCaptureInFlightRef.current = false;
    }
  };

  const handleStartRecord = async () => {
    setErrorMsg(null);
    if (!cameraRef.current) return;
    if (!permission?.granted) {
      await requestPermission();
      return;
    }
    if (!micPermission?.granted) {
      const next = await requestMicPermission();
      if (!next.granted) {
        setErrorMsg("Mic permission needed to record video.");
        return;
      }
    }

    try {
      await prepareNativeCameraMode("video");
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: true,
        staysActiveInBackground: false,
      });
      await new Promise((r) => setTimeout(r, 120));
    } catch {}

    const startTimers = () => {
      setIsRecording(true);
      setElapsedMs(0);
      recordStartRef.current = Date.now();
      progress.value = 0;
      progress.value = withTiming(1, {
        duration: MAX_RECORD_MS,
        easing: Easing.linear,
      });
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
      elapsedTimerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - recordStartRef.current);
      }, 100);
      stopTimerRef.current = setTimeout(() => {
        try {
          cameraRef.current?.stopRecording();
        } catch {}
      }, MAX_RECORD_MS);
    };

    const resetTimers = () => {
      cleanupRecording();
      setIsRecording(false);
      setElapsedMs(0);
      setNativeCameraMode("picture");
      progress.value = 0;
    };

    const tryRecord = async (
      attempt: number
    ): Promise<{ uri?: string } | undefined> => {
      const t0 = Date.now();
      startTimers();
      try {
        const result = await cameraRef.current!.recordAsync({
          maxDuration: Math.ceil(MAX_RECORD_MS / 1000),
        });
        return result;
      } catch (e) {
        const elapsed = Date.now() - t0;
        resetTimers();
        if (attempt < 2 && elapsed < 1500) {
          try {
            await Audio.setAudioModeAsync({
              playsInSilentModeIOS: true,
              allowsRecordingIOS: true,
              staysActiveInBackground: false,
            });
          } catch {}
          await new Promise((r) => setTimeout(r, 600));
          return tryRecord(attempt + 1);
        }
        throw e;
      }
    };

    try {
      const video = await tryRecord(1);
      cleanupRecording();
      const finalMs = Math.min(
        MAX_RECORD_MS,
        Date.now() - recordStartRef.current
      );
      setIsRecording(false);
      setElapsedMs(0);
      progress.value = 0;
      if (video?.uri) {
        onCapture({
          uri: video.uri,
          type: "video",
          durationMs: finalMs,
          liveFilter: liveFilter === "none" ? undefined : liveFilter,
        });
      }
    } catch {
      resetTimers();
      setNativeCameraMode("picture");
      setErrorMsg("Recording failed.");
    }
  };

  const handleStopRecord = () => {
    if (!isRecording) return;
    try {
      cameraRef.current?.stopRecording();
    } catch {}
  };

  const handlePrimaryPress = () => {
    if (mode === "picture") {
      handleTakePhoto();
    } else {
      if (isRecording) handleStopRecord();
      else handleStartRecord();
    }
  };

  const ringStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      progress.value,
      [0, 1],
      [1, 1.06],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ scale }],
      opacity: isRecording ? 1 : 0,
    };
  });

  const recordCoreStyle = useAnimatedStyle(() => {
    const innerSize = interpolate(
      isRecording ? 1 : 0,
      [0, 1],
      [RECORD_BTN_SIZE - 24, 36],
      Extrapolation.CLAMP
    );
    const radius = interpolate(
      isRecording ? 1 : 0,
      [0, 1],
      [(RECORD_BTN_SIZE - 24) / 2, 8],
      Extrapolation.CLAMP
    );
    return {
      width: innerSize,
      height: innerSize,
      borderRadius: radius,
    };
  });

  const redDotStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + redDot.value * 0.65,
  }));

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const renderTime = (ms: number) => {
    const total = Math.min(ms, MAX_RECORD_MS);
    const sec = Math.floor(total / 1000);
    const tenths = Math.floor((total % 1000) / 100);
    return `${String(sec).padStart(2, "0")}.${tenths}`;
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="overFullScreen"
      transparent
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <StatusBar hidden />
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {permission?.granted ? (
          <CameraView
            ref={cameraRef}
            style={{ flex: 1 }}
            facing={facing}
            mode={cameraMode}
            videoQuality="720p"
            onCameraReady={() => setCameraReady(true)}
          />
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
          >
            <Ionicons name="camera-outline" size={56} color="#06A7A1" />
            <Text
              style={{
                color: "white",
                marginTop: 12,
                fontWeight: "700",
                textAlign: "center",
              }}
            >
              Camera permission required
            </Text>
            <Pressable
              onPress={() => requestPermission()}
              style={{
                marginTop: 16,
                paddingHorizontal: 18,
                paddingVertical: 10,
                backgroundColor: "#06A7A1",
                borderRadius: 24,
              }}
            >
              <Text style={{ color: "white", fontWeight: "700" }}>
                Grant access
              </Text>
            </Pressable>
          </View>
        )}

        {isShowingSnapshotPreview && previewFrameUri ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <StoryFilterCanvas
              uri={previewFrameUri}
              filter={liveFilter}
              width={SCREEN_W}
              height={SCREEN_H}
              mediaType="image"
              effectMode="live"
              heatwaveAnimated
            />
          </View>
        ) : null}

        {liveFilter !== "none" && !isShowingSnapshotPreview && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <LiveFilterHud
              filter={liveFilter}
              width={SCREEN_W}
              height={SCREEN_H}
              topInset={96}
              bottomInset={250}
              showColorLayer={false}
            />
          </View>
        )}

        {/* Scifi corner brackets HUD */}
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <View
            style={{
              position: "absolute",
              top: 100,
              left: 24,
              width: 22,
              height: 22,
              borderTopWidth: 2,
              borderLeftWidth: 2,
              borderColor: "rgba(6,167,161,0.8)",
            }}
          />
          <View
            style={{
              position: "absolute",
              top: 100,
              right: 24,
              width: 22,
              height: 22,
              borderTopWidth: 2,
              borderRightWidth: 2,
              borderColor: "rgba(6,167,161,0.8)",
            }}
          />
          <View
            style={{
              position: "absolute",
              bottom: 230,
              left: 24,
              width: 22,
              height: 22,
              borderBottomWidth: 2,
              borderLeftWidth: 2,
              borderColor: "rgba(6,167,161,0.8)",
            }}
          />
          <View
            style={{
              position: "absolute",
              bottom: 230,
              right: 24,
              width: 22,
              height: 22,
              borderBottomWidth: 2,
              borderRightWidth: 2,
              borderColor: "rgba(6,167,161,0.8)",
            }}
          />
        </View>

        {/* Top bar */}
        <LinearGradient
          colors={["rgba(0,0,0,0.7)", "transparent"]}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 140,
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
          }}
        >
          <Pressable
            onPress={handleClose}
            hitSlop={10}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(0,0,0,0.5)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="close" size={24} color="white" />
          </Pressable>

          {/* Center HUD */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 56,
              right: 56,
              alignItems: "center",
            }}
          >
            {isRecording ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "rgba(0,0,0,0.55)",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: "rgba(255,60,60,0.6)",
                  gap: 8,
                }}
              >
                <Animated.View
                  style={[
                    {
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: "#ff3b30",
                    },
                    redDotStyle,
                  ]}
                />
                <Text
                  style={{
                    color: "white",
                    fontWeight: "800",
                    letterSpacing: 1,
                    fontFamily: "Courier",
                    fontSize: 14,
                  }}
                >
                  REC  {renderTime(elapsedMs)} / 15.0
                </Text>
              </View>
            ) : (
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: "rgba(6,167,161,0.6)",
                  backgroundColor: "rgba(0,0,0,0.45)",
                }}
              >
                <Text
                  style={{
                    color: "#06A7A1",
                    fontWeight: "800",
                    letterSpacing: 1.4,
                    fontFamily: "Courier",
                    fontSize: 12,
                  }}
                >
                  {mode === "picture" ? "PHOTO • READY" : "VIDEO • 15s MAX"}
                </Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {onPickLibrary && (
              <Pressable
                onPress={() => {
                  if (!isRecording) onPickLibrary?.();
                }}
                hitSlop={10}
                disabled={isRecording}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "rgba(0,0,0,0.5)",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: isRecording ? 0.4 : 1,
                }}
              >
                <Ionicons name="images-outline" size={20} color="white" />
              </Pressable>
            )}
            <Pressable
              onPress={flipCamera}
              hitSlop={10}
              disabled={isRecording}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(0,0,0,0.5)",
                alignItems: "center",
                justifyContent: "center",
                opacity: isRecording ? 0.4 : 1,
              }}
            >
              <Ionicons name="camera-reverse-outline" size={20} color="white" />
            </Pressable>
          </View>
        </View>

        {/* Progress bar near top during recording */}
        {isRecording && (
          <View
            style={{
              position: "absolute",
              top: 108,
              left: 24,
              right: 24,
              height: 4,
              borderRadius: 2,
              backgroundColor: "rgba(255,255,255,0.18)",
              overflow: "hidden",
            }}
            pointerEvents="none"
          >
            <Animated.View
              style={[
                {
                  height: "100%",
                  backgroundColor: "#ff3b30",
                  borderRadius: 2,
                },
                progressBarStyle,
              ]}
            />
          </View>
        )}

        {/* Bottom controls */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.85)"]}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 220,
          }}
          pointerEvents="none"
        />

        {errorMsg && (
          <View
            style={{
              position: "absolute",
              bottom: 232,
              left: 0,
              right: 0,
              alignItems: "center",
            }}
            pointerEvents="none"
          >
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                backgroundColor: "rgba(0,0,0,0.65)",
                borderRadius: 14,
              }}
            >
              <Text style={{ color: "#ff8080", fontSize: 12, fontWeight: "700" }}>
                {errorMsg}
              </Text>
            </View>
          </View>
        )}

        {!isRecording && (
          <View
            style={{
              position: "absolute",
              bottom: 252,
              left: 0,
              right: 0,
              alignItems: "center",
            }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{
                maxWidth: "100%",
              }}
              contentContainerStyle={{
                gap: 10,
                paddingHorizontal: 18,
                alignItems: "center",
              }}
            >
              {LIVE_FILTER_OPTIONS.map((item) => {
                const active = liveFilter === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() =>
                      setLiveFilter((current) =>
                        current === item.id ? "none" : item.id
                      )
                    }
                    style={({ pressed }) => ({
                      width: 82,
                      height: 64,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      paddingHorizontal: 6,
                      paddingVertical: 7,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: active ? item.accent : "rgba(255,255,255,0.22)",
                      backgroundColor: active ? `${item.accent}33` : "rgba(0,0,0,0.52)",
                      opacity: pressed ? 0.72 : 1,
                      shadowColor: active ? item.accent : "#000",
                      shadowOpacity: active ? 0.28 : 0,
                      shadowRadius: active ? 8 : 0,
                    })}
                  >
                    <View
                      style={{
                        width: "100%",
                        height: 22,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons
                        name={active && item.id === "heatwave" ? "flame" : item.icon}
                        size={18}
                        color={active ? item.accent : "#CFEFEC"}
                      />
                    </View>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.72}
                      style={{
                        width: "100%",
                        color: active ? "#F8FFFF" : "#C9D1D9",
                        fontSize: 11,
                        fontWeight: "900",
                        lineHeight: 13,
                        textAlign: "center",
                      }}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Mode toggle */}
        <View
          style={{
            position: "absolute",
            bottom: 182,
            alignSelf: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 4,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.18)",
            backgroundColor: "rgba(0,0,0,0.45)",
            padding: 4,
          }}
        >
          <Pressable
            onPress={() => !isRecording && setMode("picture")}
            disabled={isRecording}
            style={{
              borderRadius: 999,
              paddingHorizontal: 18,
              paddingVertical: 8,
              backgroundColor: mode === "picture" ? "rgba(6,167,161,0.26)" : "transparent",
            }}
          >
            <Text
              style={{
                color: mode === "picture" ? "#06A7A1" : "rgba(255,255,255,0.6)",
                fontWeight: "800",
                letterSpacing: 1.4,
                fontSize: 13,
              }}
            >
              PHOTO
            </Text>
          </Pressable>
          <Pressable
            onPress={() => !isRecording && setMode("video")}
            disabled={isRecording}
            style={{
              borderRadius: 999,
              paddingHorizontal: 18,
              paddingVertical: 8,
              backgroundColor: mode === "video" ? "rgba(6,167,161,0.26)" : "transparent",
            }}
          >
            <Text
              style={{
                color: mode === "video" ? "#06A7A1" : "rgba(255,255,255,0.6)",
                fontWeight: "800",
                letterSpacing: 1.4,
                fontSize: 13,
              }}
            >
              VIDEO
            </Text>
          </Pressable>
        </View>

        {/* Record button */}
        <View
          style={{
            position: "absolute",
            bottom: 56,
            left: 0,
            right: 0,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: RING_SIZE,
              height: RING_SIZE,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Animated.View
              style={[
                {
                  position: "absolute",
                  width: RING_SIZE,
                  height: RING_SIZE,
                  borderRadius: RING_SIZE / 2,
                  borderWidth: 3,
                  borderColor: "#ff3b30",
                },
                ringStyle,
              ]}
            />
            <Pressable
              onPress={handlePrimaryPress}
              style={{
                width: RECORD_BTN_SIZE,
                height: RECORD_BTN_SIZE,
                borderRadius: RECORD_BTN_SIZE / 2,
                borderWidth: 4,
                borderColor: "white",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "transparent",
              }}
            >
              <Animated.View
                style={[
                  {
                    backgroundColor:
                      mode === "video" || isRecording ? "#ff3b30" : "white",
                  },
                  recordCoreStyle,
                ]}
              />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  Dimensions,
  StatusBar,
  Image as RNImage,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { Audio } from "expo-av";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "./Ionicons";
import { useAppStore } from "../state/appStore";
import { useStoryStore, groupStoriesByAuthor } from "../state/storyStore";
import { StoryTextOverlay } from "../types/story";
import StoryFilterCanvas from "./StoryFilterCanvas";
import AnimatedStoryText from "./AnimatedStoryText";
import { getSongById, resolveSongSourceUri } from "../utils/musicLibrary";

interface StoryViewerModalProps {
  visible: boolean;
  initialGroupIndex: number;
  onClose: () => void;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const DEFAULT_IMAGE_DURATION_MS = 5000;
const MAX_VIDEO_DURATION_MS = 15000;

function StaticOverlayText({
  overlay,
  canvasWidth,
  canvasHeight,
}: {
  overlay: StoryTextOverlay;
  canvasWidth: number;
  canvasHeight: number;
}) {
  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        paddingHorizontal: 14,
        paddingVertical: 8,
        maxWidth: canvasWidth * 0.9,
        transform: [
          { translateX: overlay.x * canvasWidth },
          { translateY: overlay.y * canvasHeight },
          { scale: overlay.scale },
          { rotateZ: `${overlay.rotation}rad` },
        ],
      }}
    >
      <AnimatedStoryText overlay={overlay} fontSize={28} />
    </View>
  );
}

export default function StoryViewerModal({
  visible,
  initialGroupIndex,
  onClose,
}: StoryViewerModalProps) {
  const userEmail = useAppStore((s) => s.userEmail);
  const stories = useStoryStore((s) => s.stories);
  const viewedIds = useStoryStore((s) => s.viewedIds);
  const markViewed = useStoryStore((s) => s.markViewed);
  const deleteStory = useStoryStore((s) => s.deleteStory);

  const currentUser = userEmail?.split("@")[0] || "anonymous";

  const groups = useMemo(
    () => groupStoriesByAuthor(stories, viewedIds, currentUser),
    [stories, viewedIds, currentUser]
  );

  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isSavingShot, setIsSavingShot] = useState(false);
  const progress = useSharedValue(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureWrapRef = useRef<View>(null);
  const musicSoundRef = useRef<Audio.Sound | null>(null);
  const musicTokenRef = useRef(0);
  const voSoundRef = useRef<Audio.Sound | null>(null);
  const voTokenRef = useRef(0);

  const safeGroup = groups[groupIndex];
  const safeStory = safeGroup?.stories[storyIndex];
  const isVideo = safeStory?.mediaType === "video";
  const storyMusic = safeStory?.music || null;
  const musicSong = storyMusic ? getSongById(storyMusic.id) : null;
  const storyVoiceover = safeStory?.voiceover || null;

  const storyDurationMs = useMemo(() => {
    if (!safeStory) return DEFAULT_IMAGE_DURATION_MS;
    const musicLenMs =
      safeStory.music
        ? Math.max(0, safeStory.music.endMs - safeStory.music.startMs)
        : 0;
    if (safeStory.mediaType === "video") {
      const d = safeStory.videoDurationMs;
      const baseVideoMs =
        d && d > 0 ? Math.min(d, MAX_VIDEO_DURATION_MS) : MAX_VIDEO_DURATION_MS;
      if (musicLenMs > 0) {
        return Math.min(MAX_VIDEO_DURATION_MS, Math.max(baseVideoMs, musicLenMs));
      }
      return baseVideoMs;
    }
    if (musicLenMs > 0) {
      return Math.min(MAX_VIDEO_DURATION_MS, musicLenMs);
    }
    return DEFAULT_IMAGE_DURATION_MS;
  }, [safeStory]);

  useEffect(() => {
    if (visible) {
      setGroupIndex(initialGroupIndex);
      setStoryIndex(0);
      setSaveStatus(null);
    }
  }, [visible, initialGroupIndex]);

  useEffect(() => {
    if (!visible) {
      cancelAnimation(progress);
      progress.value = 0;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (!safeStory) {
      onClose();
      return;
    }

    markViewed(safeStory.id);
    setSaveStatus(null);

    progress.value = 0;
    progress.value = withTiming(1, {
      duration: storyDurationMs,
      easing: Easing.linear,
    });

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      handleAdvance();
    }, storyDurationMs);

    return () => {
      cancelAnimation(progress);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, groupIndex, storyIndex, safeStory?.id, storyDurationMs]);

  useEffect(() => {
    musicTokenRef.current += 1;
    const myToken = musicTokenRef.current;

    const stopExisting = async () => {
      const cur = musicSoundRef.current;
      musicSoundRef.current = null;
      if (cur) {
        try {
          await cur.stopAsync();
        } catch {}
        try {
          await cur.unloadAsync();
        } catch {}
      }
    };

    if (!visible || !storyMusic || !musicSong) {
      stopExisting();
      return () => {
        stopExisting();
      };
    }

    (async () => {
      await stopExisting();
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const uri = await resolveSongSourceUri(musicSong);
        if (!uri || musicTokenRef.current !== myToken) return;
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          {
            shouldPlay: false,
            volume: 1,
            positionMillis: storyMusic.startMs,
          }
        );
        if (musicTokenRef.current !== myToken) {
          try {
            await sound.unloadAsync();
          } catch {}
          return;
        }
        musicSoundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;
          if (musicTokenRef.current !== myToken) return;
          const pos = status.positionMillis || 0;
          if (pos >= storyMusic.endMs - 40) {
            sound
              .setPositionAsync(storyMusic.startMs)
              .catch(() => {});
          }
        });
        await sound.setPositionAsync(storyMusic.startMs);
        await sound.playAsync();
      } catch {}
    })();

    return () => {
      stopExisting();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, safeStory?.id, storyMusic?.id, storyMusic?.startMs, storyMusic?.endMs]);

  useEffect(() => {
    return () => {
      const cur = musicSoundRef.current;
      musicSoundRef.current = null;
      if (cur) {
        cur.unloadAsync().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    voTokenRef.current += 1;
    const myToken = voTokenRef.current;

    const stopExisting = async () => {
      const cur = voSoundRef.current;
      voSoundRef.current = null;
      if (cur) {
        try {
          await cur.stopAsync();
        } catch {}
        try {
          await cur.unloadAsync();
        } catch {}
      }
    };

    if (!visible || !storyVoiceover) {
      stopExisting();
      return () => {
        stopExisting();
      };
    }

    (async () => {
      await stopExisting();
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        if (voTokenRef.current !== myToken) return;
        const { sound } = await Audio.Sound.createAsync(
          { uri: storyVoiceover.uri },
          { shouldPlay: false, volume: 1, isLooping: true }
        );
        if (voTokenRef.current !== myToken) {
          try {
            await sound.unloadAsync();
          } catch {}
          return;
        }
        voSoundRef.current = sound;
        await sound.playAsync();
      } catch {}
    })();

    return () => {
      stopExisting();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, safeStory?.id, storyVoiceover?.uri]);

  useEffect(() => {
    return () => {
      const cur = voSoundRef.current;
      voSoundRef.current = null;
      if (cur) {
        cur.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const handleAdvance = () => {
    if (!safeGroup) return;
    if (storyIndex < safeGroup.stories.length - 1) {
      setStoryIndex((i) => i + 1);
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((g) => g + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1);
    } else if (groupIndex > 0) {
      const prev = groups[groupIndex - 1];
      setGroupIndex((g) => g - 1);
      setStoryIndex(prev ? prev.stories.length - 1 : 0);
    } else {
      progress.value = 0;
      progress.value = withTiming(1, {
        duration: storyDurationMs,
        easing: Easing.linear,
      });
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        handleAdvance();
      }, storyDurationMs);
    }
  };

  const handleDelete = () => {
    if (!safeStory || !safeGroup) return;
    const wasLastInGroup = safeGroup.stories.length <= 1;
    deleteStory(safeStory.id);
    if (wasLastInGroup) {
      if (groupIndex < groups.length - 1) {
        setStoryIndex(0);
      } else {
        onClose();
      }
    } else if (storyIndex >= safeGroup.stories.length - 1) {
      setStoryIndex((i) => Math.max(0, i - 1));
    }
  };

  const exportMusicTrack = async (): Promise<boolean> => {
    if (!storyMusic || !musicSong) return false;
    try {
      const sourceUri = await resolveSongSourceUri(musicSong);
      if (!sourceUri) return false;
      const safeTitle = (musicSong.title || "music").replace(
        /[^A-Za-z0-9]+/g,
        "_"
      );
      const destDir = `${FileSystem.cacheDirectory}cuevas-story/`;
      try {
        await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
      } catch {}
      const destUri = `${destDir}${safeTitle}.m4a`;
      try {
        await FileSystem.deleteAsync(destUri, { idempotent: true });
      } catch {}
      await FileSystem.copyAsync({ from: sourceUri, to: destUri });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(destUri, {
          mimeType: "audio/m4a",
          UTI: "public.audio",
          dialogTitle: "Save the music track",
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleSaveToDevice = async () => {
    if (!safeStory) return;
    setSaveStatus(null);
    setIsSavingShot(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        setSaveStatus("Photos permission required.");
        setIsSavingShot(false);
        return;
      }
      if (isVideo) {
        await MediaLibrary.saveToLibraryAsync(safeStory.imageUri);
        if (storyMusic) {
          setSaveStatus("Video saved. Saving music track\u2026");
          const ok = await exportMusicTrack();
          setSaveStatus(
            ok
              ? "Video + music track saved. Play them together!"
              : "Video saved (couldn't export music track)."
          );
        } else {
          setSaveStatus("Video saved to your photos.");
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 60));
        const captured = await captureRef(captureWrapRef, {
          format: "jpg",
          quality: 0.95,
          result: "tmpfile",
        });
        await MediaLibrary.saveToLibraryAsync(captured);
        if (storyMusic) {
          setSaveStatus("Photo saved. Saving music track\u2026");
          const ok = await exportMusicTrack();
          setSaveStatus(
            ok
              ? "Photo + music track saved. Play them together!"
              : "Photo saved (couldn't export music track)."
          );
        } else {
          setSaveStatus("Story saved to your photos.");
        }
      }
    } catch {
      setSaveStatus("Failed to save.");
    } finally {
      setIsSavingShot(false);
    }
  };

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  if (!safeGroup || !safeStory) return null;

  const timeAgo = (ts: number) => {
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h`;
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="overFullScreen"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar hidden />
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {/* Capture wrapper — view-shot captures only this subtree */}
        <View
          ref={captureWrapRef}
          collapsable={false}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: SCREEN_W,
            height: SCREEN_H,
            backgroundColor: "#000",
          }}
        >
          <StoryFilterCanvas
            uri={safeStory.imageUri}
            filter={safeStory.filter || "none"}
            width={SCREEN_W}
            height={SCREEN_H}
            contentFit="contain"
            mediaType={safeStory.mediaType || "image"}
            videoShouldPlay={isVideo && visible}
            videoLooping
            videoMuted={!!storyMusic || !!storyVoiceover}
            videoStartMs={safeStory.videoTrimStartMs}
            videoEndMs={safeStory.videoTrimEndMs}
          />

          {(safeStory.textOverlays || []).map((o) => (
            <StaticOverlayText
              key={o.id}
              overlay={o}
              canvasWidth={SCREEN_W}
              canvasHeight={SCREEN_H}
            />
          ))}
        </View>

        {/* Top gradient */}
        <LinearGradient
          colors={["rgba(0,0,0,0.6)", "transparent"]}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 160,
          }}
          pointerEvents="none"
        />

        {/* Progress bars */}
        <View
          style={{
            position: "absolute",
            top: 50,
            left: 8,
            right: 8,
            flexDirection: "row",
            gap: 4,
          }}
          pointerEvents="none"
        >
          {safeGroup.stories.map((_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 3,
                backgroundColor: "rgba(255,255,255,0.3)",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              {i < storyIndex && (
                <View
                  style={{
                    width: "100%",
                    height: "100%",
                    backgroundColor: "white",
                  }}
                />
              )}
              {i === storyIndex && (
                <Animated.View
                  style={[
                    { height: "100%", backgroundColor: "white" },
                    progressStyle,
                  ]}
                />
              )}
            </View>
          ))}
        </View>

        {/* Header */}
        <View
          style={{
            position: "absolute",
            top: 64,
            left: 12,
            right: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: "#06A7A1",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "white", fontWeight: "700" }}>
                {(safeGroup.author[0] || "A").toUpperCase()}
              </Text>
            </View>
            <Text
              style={{
                color: "white",
                marginLeft: 8,
                fontWeight: "600",
                fontSize: 14,
              }}
              numberOfLines={1}
            >
              {safeGroup.author}
            </Text>
            <Text
              style={{
                color: "rgba(255,255,255,0.7)",
                marginLeft: 6,
                fontSize: 12,
              }}
            >
              {timeAgo(safeStory.timestamp)}
            </Text>
            {isVideo && (
              <View
                style={{
                  marginLeft: 8,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 8,
                  backgroundColor: "rgba(255,255,255,0.18)",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <Ionicons name="videocam" size={11} color="white" />
                <Text
                  style={{ color: "white", fontSize: 10, fontWeight: "700" }}
                >
                  VIDEO
                </Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Pressable
              onPress={handleSaveToDevice}
              disabled={isSavingShot}
              hitSlop={10}
            >
              <Ionicons
                name={isSavingShot ? "hourglass-outline" : "download-outline"}
                size={22}
                color="white"
              />
            </Pressable>
            {safeGroup.isOwn && (
              <Pressable onPress={handleDelete} hitSlop={10}>
                <Ionicons name="trash-outline" size={22} color="white" />
              </Pressable>
            )}
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={28} color="white" />
            </Pressable>
          </View>
        </View>

        {saveStatus && (
          <View
            style={{
              position: "absolute",
              top: 110,
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
              <Text style={{ color: "white", fontSize: 12, fontWeight: "600" }}>
                {saveStatus}
              </Text>
            </View>
          </View>
        )}

        {storyVoiceover && !storyMusic && (
          <View
            style={{
              position: "absolute",
              bottom: 36,
              left: 16,
              right: 16,
              alignItems: "center",
            }}
            pointerEvents="none"
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: "rgba(6,167,161,0.85)",
                gap: 6,
              }}
            >
              <Ionicons name="mic" size={14} color="#fff" />
              <Text
                style={{
                  color: "white",
                  fontSize: 12,
                  fontWeight: "800",
                  letterSpacing: 0.4,
                }}
              >
                VOICEOVER
              </Text>
            </View>
          </View>
        )}

        {storyMusic && musicSong && (
          <View
            style={{
              position: "absolute",
              bottom: 36,
              left: 16,
              right: 16,
              alignItems: "center",
            }}
            pointerEvents="none"
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: "rgba(0,0,0,0.55)",
                maxWidth: SCREEN_W - 80,
              }}
            >
              <RNImage
                source={musicSong.cover}
                style={{ width: 26, height: 26, borderRadius: 6 }}
              />
              <Ionicons
                name="musical-note"
                size={12}
                color="#fff"
                style={{ marginLeft: 8 }}
              />
              <Text
                style={{
                  color: "white",
                  marginLeft: 6,
                  fontSize: 12,
                  fontWeight: "700",
                  maxWidth: SCREEN_W - 180,
                }}
                numberOfLines={1}
              >
                {musicSong.title} · {musicSong.artist}
              </Text>
            </View>
          </View>
        )}

        {/* Tap zones — left = back, right = forward */}
        <Pressable
          onPress={handleBack}
          style={{
            position: "absolute",
            top: 100,
            left: 0,
            bottom: 0,
            width: SCREEN_W * 0.3,
          }}
        />
        <Pressable
          onPress={handleAdvance}
          style={{
            position: "absolute",
            top: 100,
            right: 0,
            bottom: 0,
            width: SCREEN_W * 0.7,
          }}
        />
      </View>
    </Modal>
  );
}

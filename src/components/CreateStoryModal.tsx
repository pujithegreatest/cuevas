import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as VideoThumbnails from "expo-video-thumbnails";
import { Audio } from "expo-av";
import { captureRef } from "react-native-view-shot";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "./Ionicons";
import { useAppStore } from "../state/appStore";
import { useStoryStore } from "../state/storyStore";
import {
  StoryFilter,
  StoryMusic,
  StoryVoiceover,
  StoryTextOverlay,
  StorySticker,
  StoryStickerPick,
  StoryStickerOverlay,
  DrawStroke,
} from "../types/story";
import { PrivacyLevel } from "../types/feed";
import { getPrivacyOption, nextPrivacy } from "../utils/privacy";
import StoryFilterCanvas from "./StoryFilterCanvas";
import DraggableStoryText from "./DraggableStoryText";
import StoryCameraModal from "./StoryCameraModal";
import StoryTrimModal from "./StoryTrimModal";
import MusicPickerModal from "./MusicPickerModal";
import DrawingCanvas from "./DrawingCanvas";
import DraggableSticker from "./DraggableSticker";
import StickerPickerModal from "./StickerPickerModal";
import { getObjectionableContentMessage } from "../utils/contentSafety";
import { displayUsername } from "../utils/handles";
import { getSongById, resolveSongSourceUri } from "../utils/musicLibrary";
import {
  ensureLocalVideoUri,
  getRenderedStoryDurationMs,
  renderStoryVideo,
} from "../utils/storyVideoRenderer";
import { Image as RNImage } from "react-native";

const MAX_VIDEO_MS = 15000;
const VIDEO_PREVIEW_STOP_MS = 650;

interface CreateStoryModalProps {
  visible: boolean;
  onClose: () => void;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const makeVideoStoryThumbnail = async (
  uri: string,
  startMs?: number,
  endMs?: number
) => {
  const start = Math.max(0, startMs || 0);
  const latestSafeFrame =
    typeof endMs === "number" && endMs > start + 150 ? endMs - 100 : undefined;
  const requestedFrame = start + 180;
  const time =
    typeof latestSafeFrame === "number"
      ? Math.min(requestedFrame, latestSafeFrame)
      : requestedFrame;

  try {
    const thumbnail = await VideoThumbnails.getThumbnailAsync(uri, {
      time: Math.max(0, Math.floor(time)),
      quality: 0.45,
    });
    return thumbnail.uri;
  } catch {
    return undefined;
  }
};

const FILTERS: { id: StoryFilter; label: string }[] = [
  { id: "none", label: "Original" },
  { id: "neon", label: "Neon" },
  { id: "hologram", label: "Hologram" },
  { id: "vaporwave", label: "Vaporwave" },
  { id: "infrared", label: "Infrared" },
  { id: "matrix", label: "Matrix" },
  { id: "glitch", label: "Glitch" },
  { id: "void", label: "Void" },
  { id: "noir", label: "Noir" },
  { id: "sepia", label: "Sepia" },
  { id: "acid", label: "Acid" },
  { id: "arctic", label: "Arctic" },
  { id: "dream", label: "Dream" },
  { id: "xray", label: "X-Ray" },
  { id: "thermal", label: "Thermal" },
  { id: "predator", label: "Predator" },
  { id: "scanner", label: "Scanner" },
  { id: "chrome", label: "Chrome" },
  { id: "radioactive", label: "Toxic" },
];

const LIVE_FILTER_LABELS: Partial<Record<StoryFilter, string>> = {
  heatwave: "Heatwave",
  hologram: "Holo ID",
  glitch: "Signal",
  matrix: "Code ID",
  scanner: "Sweep",
  xray: "Bone",
  infrared: "IR Lock",
  neon: "Circuit",
  vaporwave: "Synth",
  thermal: "Heatmap",
  predator: "Tracker",
  chrome: "LiDAR",
  radioactive: "Rad",
  void: "Gravity",
};

const TEXT_STYLES: StoryTextOverlay["style"][] = [
  "neon",
  "mono",
  "chrome",
  "blood",
  "ticker",
  "wave",
  "glitch",
];

const TEXT_COLORS = [
  "#ffffff",
  "#06A7A1",
  "#80171F",
  "#ff5e3a",
  "#00ffd5",
  "#ff00aa",
  "#39ff14",
  "#facc15",
];

const DRAW_COLORS = [
  "#ffffff",
  "#06A7A1",
  "#FF3B30",
  "#FACC15",
  "#39FF14",
  "#FF00AA",
  "#00FFD5",
  "#000000",
];

export default function CreateStoryModal({
  visible,
  onClose,
}: CreateStoryModalProps) {
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [videoDurationMs, setVideoDurationMs] = useState<number | undefined>(
    undefined
  );
  const [videoTrimStartMs, setVideoTrimStartMs] = useState<number | undefined>(
    undefined
  );
  const [videoTrimEndMs, setVideoTrimEndMs] = useState<number | undefined>(
    undefined
  );
  const [cameraVisible, setCameraVisible] = useState(false);
  const [trimSourceUri, setTrimSourceUri] = useState<string | null>(null);
  const [trimSourceDurationMs, setTrimSourceDurationMs] = useState<
    number | undefined
  >(undefined);
  const [filter, setFilter] = useState<StoryFilter>("none");
  const [lockedLiveFilter, setLockedLiveFilter] = useState<StoryFilter | null>(
    null
  );
  const [overlays, setOverlays] = useState<StoryTextOverlay[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [videoPreviewEnabled, setVideoPreviewEnabled] = useState(true);
  const [isSavingToCameraRoll, setIsSavingToCameraRoll] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [music, setMusic] = useState<StoryMusic | null>(null);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [stickers, setStickers] = useState<StoryStickerOverlay[]>([]);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(
    null
  );
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const [drawMode, setDrawMode] = useState(false);
  const [drawColor, setDrawColor] = useState("#ffffff");
  const [drawWidth, setDrawWidth] = useState(4);
  const [privacy, setPrivacy] = useState<PrivacyLevel>("public");
  const [privacyFlash, setPrivacyFlash] = useState<string | null>(null);
  const [voiceover, setVoiceover] = useState<StoryVoiceover | null>(null);
  const [isRecordingVO, setIsRecordingVO] = useState(false);
  const [voElapsedMs, setVoElapsedMs] = useState(0);
  const [voPermissionError, setVoPermissionError] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const voElapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voStartTimeRef = useRef<number>(0);
  const voSoundRef = useRef<Audio.Sound | null>(null);
  const voLoadIdRef = useRef(0);
  const trimSourceFilterRef = useRef<StoryFilter>("none");
  const hasAutoOpenedCameraRef = useRef(false);
  const canvasRef = useRef<View>(null);
  const musicSong = music ? getSongById(music.id) : null;
  const musicSoundRef = useRef<Audio.Sound | null>(null);
  const musicLoadIdRef = useRef(0);

  const getActiveVideoFilter = () => {
    if (mediaType !== "video") return null;
    if (lockedLiveFilter && lockedLiveFilter !== "none") return lockedLiveFilter;
    return filter !== "none" ? filter : null;
  };

  const VO_MAX_MS = 15000;

  const isDarkMode = useAppStore((s) => s.isDarkMode);
  const userEmail = useAppStore((s) => s.userEmail);
  const displayName = useAppStore((s) => s.displayName);
  const rewardsBalance = useAppStore((s) => s.rewardsBalance);
  const defaultPostPrivacy = useAppStore((s) => s.defaultPostPrivacy);
  const addStory = useStoryStore((s) => s.addStory);
  const storyAuthor = displayUsername(displayName, userEmail, "anonymous");

  const canvasW = SCREEN_W - 32;
  const canvasH = Math.min(SCREEN_H * 0.6, canvasW * (16 / 9));
  const hasLockedLiveFilter = lockedLiveFilter !== null;

  const applyStaticFilter = (nextFilter: StoryFilter) => {
    if (hasLockedLiveFilter) {
      const label = lockedLiveFilter
        ? LIVE_FILTER_LABELS[lockedLiveFilter] || "live filter"
        : "live filter";
      setStatusMsg(
        `${label} was captured live and stays locked on this story. Remove the media to choose static filters.`
      );
      return;
    }
    setFilter(nextFilter);
  };

  useEffect(() => {
    if (!visible) {
      setMediaUri(null);
      setMediaType("image");
      setVideoDurationMs(undefined);
      setVideoTrimStartMs(undefined);
      setVideoTrimEndMs(undefined);
      setFilter("none");
      setLockedLiveFilter(null);
      setOverlays([]);
      setSelectedId(null);
      setEditingId(null);
      setEditingText("");
      setIsSaving(false);
      setVideoPreviewEnabled(true);
      setIsSavingToCameraRoll(false);
      setStatusMsg(null);
      setErrorMsg(null);
      setCameraVisible(false);
      setTrimSourceUri(null);
      setTrimSourceDurationMs(undefined);
      setMusic(null);
      setShowMusicPicker(false);
      setStickers([]);
      setSelectedStickerId(null);
      setShowStickerPicker(false);
      setStrokes([]);
      setDrawMode(false);
      setPrivacy(defaultPostPrivacy || "public");
      setVoiceover(null);
      setIsRecordingVO(false);
      setVoElapsedMs(0);
      setVoPermissionError(null);
      hasAutoOpenedCameraRef.current = false;
      cleanupVoiceoverRecording();
    } else if (!hasAutoOpenedCameraRef.current) {
      hasAutoOpenedCameraRef.current = true;
      setPrivacy(defaultPostPrivacy || "public");
      setCameraVisible(true);
    }
  }, [visible, defaultPostPrivacy]);

  useEffect(() => {
    if (!visible || mediaType !== "video") return;
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});
  }, [visible, mediaType]);

  useEffect(() => {
    const shouldPlay =
      visible &&
      !!music &&
      !!musicSong &&
      !voiceover &&
      !isRecordingVO &&
      !cameraVisible &&
      !showMusicPicker &&
      !trimSourceUri;

    let cancelled = false;
    const loadId = ++musicLoadIdRef.current;

    const unload = async () => {
      if (musicSoundRef.current) {
        const s = musicSoundRef.current;
        musicSoundRef.current = null;
        try {
          await s.stopAsync();
        } catch {}
        try {
          await s.unloadAsync();
        } catch {}
      }
    };

    const run = async () => {
      if (!shouldPlay || !music || !musicSong) {
        await unload();
        return;
      }
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
        });
      } catch {}
      if (cancelled || loadId !== musicLoadIdRef.current) return;
      await unload();
      if (cancelled || loadId !== musicLoadIdRef.current) return;
      try {
        const startMs = Math.max(0, music.startMs);
        const endMs = Math.max(startMs + 1000, music.endMs);
        const { sound } = await Audio.Sound.createAsync(
          musicSong.source,
          {
            shouldPlay: true,
            positionMillis: startMs,
            progressUpdateIntervalMillis: 80,
            volume: 1,
          }
        );
        if (cancelled || loadId !== musicLoadIdRef.current) {
          try {
            await sound.unloadAsync();
          } catch {}
          return;
        }
        musicSoundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;
          if (status.positionMillis >= endMs - 80) {
            sound.setPositionAsync(startMs).catch(() => {});
          }
        });
      } catch {}
    };

    run();

    return () => {
      cancelled = true;
      const s = musicSoundRef.current;
      musicSoundRef.current = null;
      if (s) {
        s.stopAsync().catch(() => {});
        s.unloadAsync().catch(() => {});
      }
    };
  }, [
    visible,
    music?.id,
    music?.startMs,
    music?.endMs,
    cameraVisible,
    showMusicPicker,
    trimSourceUri,
    musicSong,
    voiceover,
    isRecordingVO,
  ]);

  useEffect(() => {
    const shouldPlay =
      visible &&
      !!voiceover &&
      !isRecordingVO &&
      !cameraVisible &&
      !showMusicPicker &&
      !trimSourceUri;

    let cancelled = false;
    const loadId = ++voLoadIdRef.current;

    const run = async () => {
      if (!shouldPlay || !voiceover) {
        await unloadVoiceoverPreview();
        return;
      }
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
        });
      } catch {}
      if (cancelled || loadId !== voLoadIdRef.current) return;
      await unloadVoiceoverPreview();
      if (cancelled || loadId !== voLoadIdRef.current) return;
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: voiceover.uri },
          { shouldPlay: true, volume: 1, isLooping: true }
        );
        if (cancelled || loadId !== voLoadIdRef.current) {
          try {
            await sound.unloadAsync();
          } catch {}
          return;
        }
        voSoundRef.current = sound;
      } catch {}
    };

    run();

    return () => {
      cancelled = true;
      const s = voSoundRef.current;
      voSoundRef.current = null;
      if (s) {
        s.stopAsync().catch(() => {});
        s.unloadAsync().catch(() => {});
      }
    };
  }, [
    visible,
    voiceover?.uri,
    isRecordingVO,
    cameraVisible,
    showMusicPicker,
    trimSourceUri,
  ]);

  const cleanupVoiceoverRecording = () => {
    if (voElapsedTimerRef.current) {
      clearInterval(voElapsedTimerRef.current);
      voElapsedTimerRef.current = null;
    }
    if (voStopTimeoutRef.current) {
      clearTimeout(voStopTimeoutRef.current);
      voStopTimeoutRef.current = null;
    }
    const rec = recordingRef.current;
    recordingRef.current = null;
    if (rec) {
      (async () => {
        try {
          await rec.stopAndUnloadAsync();
        } catch {}
      })();
    }
  };

  const unloadVoiceoverPreview = async () => {
    const s = voSoundRef.current;
    voSoundRef.current = null;
    if (s) {
      try {
        await s.stopAsync();
      } catch {}
      try {
        await s.unloadAsync();
      } catch {}
    }
  };

  const startVoiceoverRecording = async () => {
    setVoPermissionError(null);
    setErrorMsg(null);
    if (isRecordingVO) return;
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        setVoPermissionError("Mic permission needed for voiceover.");
        return;
      }
      await unloadVoiceoverPreview();
      if (musicSoundRef.current) {
        try {
          await musicSoundRef.current.stopAsync();
        } catch {}
      }
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: true,
        staysActiveInBackground: false,
      });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      await recording.startAsync();
      recordingRef.current = recording;
      voStartTimeRef.current = Date.now();
      setIsRecordingVO(true);
      setVoElapsedMs(0);
      if (voElapsedTimerRef.current)
        clearInterval(voElapsedTimerRef.current);
      voElapsedTimerRef.current = setInterval(() => {
        setVoElapsedMs(Date.now() - voStartTimeRef.current);
      }, 100);
      if (voStopTimeoutRef.current) clearTimeout(voStopTimeoutRef.current);
      voStopTimeoutRef.current = setTimeout(() => {
        stopVoiceoverRecording().catch(() => {});
      }, VO_MAX_MS);
    } catch {
      setVoPermissionError("Could not start recording.");
      setIsRecordingVO(false);
    }
  };

  const stopVoiceoverRecording = async () => {
    const rec = recordingRef.current;
    recordingRef.current = null;
    if (voElapsedTimerRef.current) {
      clearInterval(voElapsedTimerRef.current);
      voElapsedTimerRef.current = null;
    }
    if (voStopTimeoutRef.current) {
      clearTimeout(voStopTimeoutRef.current);
      voStopTimeoutRef.current = null;
    }
    if (!rec) {
      setIsRecordingVO(false);
      return;
    }
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      const durationMs = Math.min(
        VO_MAX_MS,
        Date.now() - voStartTimeRef.current
      );
      if (uri) {
        setVoiceover({ uri, durationMs });
        if (music) setMusic(null);
      }
    } catch {
      setErrorMsg("Voiceover recording failed.");
    } finally {
      setIsRecordingVO(false);
      setVoElapsedMs(0);
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
        });
      } catch {}
    }
  };

  const clearVoiceover = async () => {
    await unloadVoiceoverPreview();
    setVoiceover(null);
  };

  const ingestImage = async (uri: string) => {
    try {
      const c = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1080 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      setMediaUri(c.uri);
    } catch {
      setMediaUri(uri);
    }
    setMediaType("image");
    setVideoDurationMs(undefined);
    setVideoTrimStartMs(undefined);
    setVideoTrimEndMs(undefined);
    setFilter("none");
    setLockedLiveFilter(null);
    setOverlays([]);
    setSelectedId(null);
  };

  const startVideoTrim = (uri: string, durationMs?: number) => {
    setTrimSourceUri(uri);
    setTrimSourceDurationMs(durationMs);
  };

  const ingestAsset = async (asset: {
    uri: string;
    type?: string | null;
    duration?: number | null;
  }) => {
    const isVideo =
      asset.type === "video" || /\.(mp4|mov|m4v|webm|avi)$/i.test(asset.uri);
    trimSourceFilterRef.current = "none";
    setLockedLiveFilter(null);
    if (isVideo) {
      startVideoTrim(asset.uri, asset.duration || undefined);
    } else {
      await ingestImage(asset.uri);
    }
  };

  const pickFromLibrary = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    setDrawMode(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.9,
      allowsMultipleSelection: false,
      videoMaxDuration: 15,
    });
    if (!result.canceled && result.assets?.[0]) {
      await ingestAsset(result.assets[0]);
    }
  };

  const handleCameraPickLibrary = async () => {
    setCameraVisible(false);
    setTimeout(() => {
      pickFromLibrary().catch(() => {});
    }, 250);
  };

  const openCamera = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    setDrawMode(false);
    if (musicSoundRef.current) {
      try {
        await musicSoundRef.current.stopAsync();
      } catch {}
      try {
        await musicSoundRef.current.unloadAsync();
      } catch {}
      musicSoundRef.current = null;
    }
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
      });
      await new Promise((r) => setTimeout(r, 120));
    } catch {}
    setCameraVisible(true);
  };

  const handleCameraCapture = async (asset: {
    uri: string;
    type: "image" | "video";
    durationMs?: number;
    liveFilter?: StoryFilter;
  }) => {
    setCameraVisible(false);
    const capturedLiveFilter = asset.liveFilter || null;
    trimSourceFilterRef.current = capturedLiveFilter || "none";
    if (asset.type === "video") {
      startVideoTrim(asset.uri, asset.durationMs);
    } else {
      await ingestImage(asset.uri);
      setLockedLiveFilter(capturedLiveFilter);
      setFilter(capturedLiveFilter || "none");
    }
  };

  const handleTrimConfirm = (result: {
    startMs: number;
    endMs: number;
    durationMs: number;
  }) => {
    if (!trimSourceUri) return;
    setMediaUri(trimSourceUri);
    setMediaType("video");
    setVideoPreviewEnabled(true);
    setVideoDurationMs(result.durationMs);
    setVideoTrimStartMs(result.startMs);
    setVideoTrimEndMs(result.endMs);
    const capturedLiveFilter = trimSourceFilterRef.current || "none";
    setFilter(capturedLiveFilter);
    setLockedLiveFilter(
      capturedLiveFilter === "none" ? null : capturedLiveFilter
    );
    trimSourceFilterRef.current = "none";
    setOverlays([]);
    setSelectedId(null);
    setTrimSourceUri(null);
    setTrimSourceDurationMs(undefined);
  };

  const handleTrimCancel = () => {
    setTrimSourceUri(null);
    setTrimSourceDurationMs(undefined);
    trimSourceFilterRef.current = "none";
  };

  const addTextOverlay = () => {
    setDrawMode(false);
    setSelectedStickerId(null);
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const next: StoryTextOverlay = {
      id,
      text: "",
      x: 0.5 - 0.2,
      y: 0.45,
      scale: 1,
      rotation: 0,
      color: "#ffffff",
      style: "neon",
    };
    setOverlays((prev) => [...prev, next]);
    setSelectedId(id);
    setEditingId(id);
    setEditingText("");
  };

  const updateOverlay = (next: StoryTextOverlay) => {
    setOverlays((prev) => prev.map((o) => (o.id === next.id ? next : o)));
  };

  const deleteOverlay = (id: string) => {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const commitEdit = () => {
    if (!editingId) return;
    const trimmed = editingText.slice(0, 140);
    const id = editingId;
    if (trimmed.trim().length === 0) {
      setOverlays((prev) => prev.filter((o) => o.id !== id));
      if (selectedId === id) setSelectedId(null);
    } else {
      setOverlays((prev) =>
        prev.map((o) => (o.id === id ? { ...o, text: trimmed } : o))
      );
    }
    setEditingId(null);
    setEditingText("");
  };

  const cycleStyle = () => {
    if (!selectedId) return;
    setOverlays((prev) =>
      prev.map((o) => {
        if (o.id !== selectedId) return o;
        const idx = TEXT_STYLES.indexOf(o.style);
        const nextStyle = TEXT_STYLES[(idx + 1) % TEXT_STYLES.length];
        return { ...o, style: nextStyle };
      })
    );
  };

  const setSelectedColor = (color: string) => {
    if (!selectedId) return;
    setOverlays((prev) =>
      prev.map((o) => (o.id === selectedId ? { ...o, color } : o))
    );
  };

  const addSticker = (sticker: StorySticker | StoryStickerPick) => {
    const stickerPick: StoryStickerPick =
      typeof sticker === "string" ? { kind: sticker } : sticker;
    const kind = stickerPick.kind;
    setDrawMode(false);
    setSelectedId(null);
    const id = `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const next: StoryStickerOverlay = {
      id,
      kind,
      x: 0.4,
      y: 0.4,
      scale: 1,
      rotation: 0,
      label: stickerPick.label,
      imageUri: stickerPick.imageUri,
      ...(kind === "timestamp"
        ? {
            text: (() => {
              const d = new Date();
              const h = d.getHours();
              const m = d.getMinutes().toString().padStart(2, "0");
              const ampm = h >= 12 ? "PM" : "AM";
              const h12 = h % 12 || 12;
              return `${h12}:${m} ${ampm}`;
            })(),
          }
        : stickerPick.text
        ? { text: stickerPick.text }
        : {}),
    };
    setStickers((p) => [...p, next]);
    setSelectedStickerId(id);
    setShowStickerPicker(false);
  };

  const updateSticker = (next: StoryStickerOverlay) => {
    setStickers((p) => p.map((s) => (s.id === next.id ? next : s)));
  };

  const deleteSticker = (id: string) => {
    setStickers((p) => p.filter((s) => s.id !== id));
    if (selectedStickerId === id) setSelectedStickerId(null);
  };

  const undoStroke = () => {
    setStrokes((prev) => prev.slice(0, -1));
  };

  const clearStrokes = () => {
    setStrokes([]);
  };

  const exportMusicTrack = async (): Promise<boolean> => {
    if (!music || !musicSong) return false;
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
    if (!mediaUri) return;
    setSelectedId(null);
    setErrorMsg(null);
    setStatusMsg(null);
    setIsSavingToCameraRoll(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        setErrorMsg("Photos permission is required to save.");
        setIsSavingToCameraRoll(false);
        return;
      }
      if (mediaType === "video") {
        const renderFilter = getActiveVideoFilter();
        let saveUri = mediaUri;
        let renderedWithFilter = false;
        if (renderFilter) {
          setStatusMsg("Baking video filter\u2026");
          const rendered = await renderStoryVideo({
            localVideoUri: mediaUri,
            liveFilter: renderFilter,
            trimStartMs: videoTrimStartMs,
            trimEndMs: videoTrimEndMs,
          });
          saveUri = await ensureLocalVideoUri(
            rendered.url,
            "cuevas-rendered-story"
          );
          renderedWithFilter = true;
        }
        await MediaLibrary.saveToLibraryAsync(saveUri);
        if (music && musicSong) {
          setStatusMsg(
            renderedWithFilter
              ? "Filtered video saved. Saving music track\u2026"
              : "Video saved. Saving music track\u2026"
          );
          const ok = await exportMusicTrack();
          setStatusMsg(
            ok
              ? renderedWithFilter
                ? "Filtered video + music track saved. The music is exported alongside."
                : "Video + music saved. The song is exported alongside."
              : renderedWithFilter
              ? "Filtered video saved (couldn't export music track)."
              : "Video saved (couldn't export music track)."
          );
        } else {
          setStatusMsg(
            renderedWithFilter
              ? "Filtered video saved to your photos."
              : "Video saved to your photos."
          );
        }
      } else {
        setIsCapturing(true);
        await new Promise((resolve) => setTimeout(resolve, 80));
        let captured: string | null = null;
        try {
          captured = await captureRef(canvasRef, {
            format: "jpg",
            quality: 0.95,
            result: "tmpfile",
          });
        } finally {
          setIsCapturing(false);
        }
        if (captured) {
          await MediaLibrary.saveToLibraryAsync(captured);
        }
        if (music && musicSong) {
          setStatusMsg("Photo saved. Saving music track\u2026");
          const ok = await exportMusicTrack();
          setStatusMsg(
            ok
              ? "Photo + music saved. Pics can't be saved as a video with audio without a native encoder, so the song is exported alongside."
              : "Photo saved (couldn't export music track)."
          );
        } else {
          setStatusMsg("Story image saved to your photos.");
        }
      }
    } catch {
      setErrorMsg("Failed to save to photos.");
    } finally {
      setIsSavingToCameraRoll(false);
    }
  };

  const handleShare = async () => {
    if (!mediaUri) return;
    setIsSaving(true);
    setErrorMsg(null);
    const cleanOverlays = overlays.filter((o) => o.text.trim().length > 0);
    const safetyMessage = getObjectionableContentMessage(cleanOverlays.map((o) => o.text));
    if (safetyMessage) {
      setErrorMsg(safetyMessage);
      setIsSaving(false);
      return;
    }
    if (mediaType === "video") {
      setVideoPreviewEnabled(false);
      await wait(VIDEO_PREVIEW_STOP_MS);
    }
    if (musicSoundRef.current) {
      const s = musicSoundRef.current;
      musicSoundRef.current = null;
      try {
        await s.stopAsync();
      } catch {}
      try {
        await s.unloadAsync();
      } catch {}
    }
    await unloadVoiceoverPreview();
    try {
      const renderFilter = getActiveVideoFilter();
      let storyMediaUri = mediaUri;
      let storyFilter: StoryFilter = filter;
      let storyLiveFilter: StoryFilter | undefined =
        lockedLiveFilter || undefined;
      let storyTrimStartMs = videoTrimStartMs;
      let storyTrimEndMs = videoTrimEndMs;
      let storyDurationMs = videoDurationMs;

      if (mediaType === "video" && renderFilter) {
        setStatusMsg("Baking video filter\u2026");
        const rendered = await renderStoryVideo({
          localVideoUri: mediaUri,
          liveFilter: renderFilter,
          trimStartMs: videoTrimStartMs,
          trimEndMs: videoTrimEndMs,
        });
        storyMediaUri = rendered.url;
        storyDurationMs =
          rendered.durationMs ||
          getRenderedStoryDurationMs(
            videoTrimStartMs,
            videoTrimEndMs,
            videoDurationMs
          );
        storyTrimStartMs = undefined;
        storyTrimEndMs = undefined;
        storyFilter = "none";
        storyLiveFilter = undefined;
      }

      const thumbnailUri =
        mediaType === "video"
          ? await makeVideoStoryThumbnail(
              storyMediaUri,
              storyTrimStartMs,
              storyTrimEndMs
            )
          : undefined;
      addStory({
        author: storyAuthor,
        authorRewardPoints: rewardsBalance,
        imageUri: storyMediaUri,
        mediaType,
        videoDurationMs: storyDurationMs,
        videoTrimStartMs: storyTrimStartMs,
        videoTrimEndMs: storyTrimEndMs,
        thumbnailUri,
        filter: storyFilter,
        liveFilter: storyLiveFilter,
        textOverlays: cleanOverlays.length > 0 ? cleanOverlays : undefined,
        music: music ?? undefined,
        voiceover: voiceover ?? undefined,
        privacy,
      });
      onClose();
    } catch {
      setVideoPreviewEnabled(true);
      setErrorMsg("Failed to share story.");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedOverlay = overlays.find((o) => o.id === selectedId) || null;
  const currentPrivacy = getPrivacyOption(privacy);
  const cyclePrivacy = () => {
    const next = nextPrivacy(privacy);
    const option = getPrivacyOption(next);
    setPrivacy(next);
    setPrivacyFlash(option.shortLabel);
    setTimeout(() => setPrivacyFlash(null), 650);
  };
  const editingOverlay = overlays.find((o) => o.id === editingId) || null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
        className="flex-1"
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View
            className={`flex-1 ${isDarkMode ? "bg-dark-bg" : "bg-white"}`}
          >
            {privacyFlash && (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 92,
                  left: 0,
                  right: 0,
                  alignItems: "center",
                  zIndex: 30,
                }}
              >
                <View
                  style={{
                    paddingHorizontal: 18,
                    paddingVertical: 8,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: "#06A7A1",
                    backgroundColor: "rgba(6,167,161,0.18)",
                    shadowColor: "#06A7A1",
                    shadowOpacity: 0.75,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 0 },
                  }}
                >
                  <Text
                    style={{
                      color: "#CFEFEC",
                      fontFamily: "Courier",
                      fontWeight: "900",
                      letterSpacing: 2.2,
                      textShadowColor: "#06A7A1",
                      textShadowRadius: 8,
                    }}
                  >
                    {privacyFlash}
                  </Text>
                </View>
              </View>
            )}
            {/* Header */}
            <View
              className={`flex-row items-center justify-between px-4 py-3 border-b ${
                isDarkMode ? "border-gray-700" : "border-gray-200"
              }`}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Pressable onPress={onClose} hitSlop={10}>
                  <Ionicons
                    name="close"
                    size={28}
                    color={isDarkMode ? "#CFEFEC" : "#80171F"}
                  />
                </Pressable>
                <Pressable
                  onPress={cyclePrivacy}
                  hitSlop={8}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: "rgba(6,167,161,0.45)",
                    backgroundColor: "rgba(6,167,161,0.14)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name={currentPrivacy.icon}
                    size={18}
                    color={isDarkMode ? "#06A7A1" : "#80171F"}
                  />
                </Pressable>
              </View>
              <Text
                className={`text-lg font-bold ${
                  isDarkMode ? "text-dark-text" : "text-pixel-text"
                }`}
              >
                New Story
              </Text>
              <View className="flex-row items-center gap-2">
                {mediaUri && (
                  <Pressable
                    onPress={handleSaveToDevice}
                    disabled={isSavingToCameraRoll}
                    hitSlop={8}
                    className="px-2 py-2"
                  >
                    <Ionicons
                      name={
                        isSavingToCameraRoll
                          ? "hourglass-outline"
                          : "download-outline"
                      }
                      size={22}
                      color={isDarkMode ? "#CFEFEC" : "#80171F"}
                    />
                  </Pressable>
                )}
                <Pressable
                  onPress={handleShare}
                  disabled={!mediaUri || isSaving}
                  className={`px-4 py-2 rounded-full ${
                    !mediaUri || isSaving
                      ? "bg-gray-300"
                      : isDarkMode
                      ? "bg-dark-accent"
                      : "bg-pixel-teal"
                  }`}
                >
                  <Text
                    className="font-bold"
                    style={{
                      color: !mediaUri || isSaving ? "#6B7280" : isDarkMode ? "#FFFFFF" : "#10252B",
                    }}
                  >
                    {isSaving ? "Sharing..." : "Share"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Canvas */}
            <View className="items-center justify-center pt-4">
              {mediaUri ? (
                <View
                  ref={canvasRef}
                  collapsable={false}
                  style={{
                    width: canvasW,
                    height: canvasH,
                    borderRadius: 20,
                    overflow: "hidden",
                  }}
                >
                  {mediaType === "video" && isSaving ? (
                    <View
                      style={{
                        width: canvasW,
                        height: canvasH,
                        backgroundColor: "#061B20",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="videocam" size={32} color="#06A7A1" />
                    </View>
                  ) : (
                    <StoryFilterCanvas
                      uri={mediaUri}
                      filter={filter}
                      width={canvasW}
                      height={canvasH}
                      contentFit="cover"
                      mediaType={mediaType}
                      videoShouldPlay={
                        mediaType === "video" && videoPreviewEnabled && !isSaving
                      }
                      videoLooping={
                        mediaType === "video" && videoPreviewEnabled && !isSaving
                      }
                      videoMuted={!!music || !!voiceover}
                      videoStartMs={videoTrimStartMs}
                      videoEndMs={videoTrimEndMs}
                      effectMode={lockedLiveFilter ? "live" : "static"}
                      onVideoLoad={(d) => {
                        if (!videoDurationMs) setVideoDurationMs(d);
                      }}
                    />
                  )}

                  {/* Drawing layer (under text/stickers) */}
                  <DrawingCanvas
                    width={canvasW}
                    height={canvasH}
                    enabled={drawMode && !isCapturing}
                    color={drawColor}
                    strokeWidth={drawWidth}
                    strokes={strokes}
                    onStrokeComplete={(s) =>
                      setStrokes((prev) => [...prev, s])
                    }
                  />

                  {/* Text overlays */}
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: canvasW,
                      height: canvasH,
                    }}
                    pointerEvents={drawMode ? "none" : "box-none"}
                  >
                    {overlays.map((o) => (
                      <DraggableStoryText
                        key={o.id}
                        overlay={o}
                        canvasWidth={canvasW}
                        canvasHeight={canvasH}
                        selected={selectedId === o.id}
                        onSelect={() => setSelectedId(o.id)}
                        onChange={updateOverlay}
                        onRequestEdit={() => {
                          setEditingId(o.id);
                          setEditingText(o.text);
                        }}
                        onRequestDelete={() => deleteOverlay(o.id)}
                      />
                    ))}
                  </View>

                  {/* Sticker overlays */}
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: canvasW,
                      height: canvasH,
                    }}
                    pointerEvents={drawMode ? "none" : "box-none"}
                  >
                    {stickers.map((s) => (
                      <DraggableSticker
                        key={s.id}
                        overlay={s}
                        canvasWidth={canvasW}
                        canvasHeight={canvasH}
                        selected={selectedStickerId === s.id}
                        onSelect={() => setSelectedStickerId(s.id)}
                        onChange={updateSticker}
                        onRequestDelete={() => deleteSticker(s.id)}
                      />
                    ))}
                  </View>

                  {/* Floating tool buttons inside canvas */}
                  <View
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      gap: 10,
                      opacity: isCapturing ? 0 : 1,
                    }}
                    pointerEvents={isCapturing ? "none" : "auto"}
                  >
                    <Pressable
                      onPress={addTextOverlay}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: "rgba(0,0,0,0.55)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: "white",
                          fontSize: 20,
                          fontWeight: "800",
                        }}
                      >
                        Aa
                      </Text>
                    </Pressable>
                    {selectedOverlay && (
                      <Pressable
                        onPress={cycleStyle}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: "rgba(0,0,0,0.55)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: "white",
                            fontSize: 12,
                            fontWeight: "700",
                          }}
                        >
                          STYL
                        </Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => {
                        setDrawMode(false);
                        setSelectedId(null);
                        setShowStickerPicker(true);
                      }}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: "rgba(0,0,0,0.55)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="happy-outline" size={22} color="#fff" />
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setDrawMode((m) => !m);
                        setSelectedId(null);
                        setSelectedStickerId(null);
                      }}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: drawMode
                          ? "#06A7A1"
                          : "rgba(0,0,0,0.55)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="brush" size={20} color="#fff" />
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        if (isRecordingVO) {
                          stopVoiceoverRecording().catch(() => {});
                        } else if (voiceover) {
                          clearVoiceover();
                        } else {
                          startVoiceoverRecording().catch(() => {});
                        }
                      }}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: isRecordingVO
                          ? "#ff3b30"
                          : voiceover
                          ? "#06A7A1"
                          : "rgba(0,0,0,0.55)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons
                        name={
                          isRecordingVO
                            ? "stop"
                            : voiceover
                            ? "mic"
                            : "mic-outline"
                        }
                        size={20}
                        color="#fff"
                      />
                    </Pressable>
                    {drawMode && strokes.length > 0 && (
                      <Pressable
                        onPress={undoStroke}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: "rgba(0,0,0,0.55)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons name="arrow-undo" size={18} color="#fff" />
                      </Pressable>
                    )}
                    {drawMode && strokes.length > 0 && (
                      <Pressable
                        onPress={clearStrokes}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: "rgba(128,23,31,0.85)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons name="trash" size={18} color="#fff" />
                      </Pressable>
                    )}
                  </View>

                  {mediaType === "video" && !isCapturing && (
                    <View
                      style={{
                        position: "absolute",
                        top: 12,
                        left: 12,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 12,
                        backgroundColor: "rgba(0,0,0,0.55)",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                      }}
                      pointerEvents="none"
                    >
                      <Ionicons name="videocam" size={14} color="white" />
                      <Text
                        style={{
                          color: "white",
                          fontSize: 11,
                          fontWeight: "700",
                        }}
                      >
                        VIDEO
                      </Text>
                    </View>
                  )}

                  {music && musicSong && (
                    <Pressable
                      onPress={() => setShowMusicPicker(true)}
                      style={{
                        position: "absolute",
                        bottom: selectedOverlay ? 48 : 12,
                        left: 12,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 16,
                        backgroundColor: "rgba(0,0,0,0.6)",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        maxWidth: canvasW - 24,
                      }}
                    >
                      <RNImage
                        source={musicSong.cover}
                        style={{ width: 22, height: 22, borderRadius: 4 }}
                      />
                      <Ionicons name="musical-note" size={12} color="#fff" />
                      <Text
                        style={{
                          color: "white",
                          fontSize: 11,
                          fontWeight: "700",
                          maxWidth: canvasW - 100,
                        }}
                        numberOfLines={1}
                      >
                        {musicSong.title} · {musicSong.artist}
                      </Text>
                    </Pressable>
                  )}

                  {voiceover && !music && (
                    <Pressable
                      onPress={clearVoiceover}
                      style={{
                        position: "absolute",
                        bottom: selectedOverlay ? 48 : 12,
                        left: 12,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 16,
                        backgroundColor: "rgba(6,167,161,0.85)",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Ionicons name="mic" size={14} color="#fff" />
                      <Text
                        style={{
                          color: "white",
                          fontSize: 11,
                          fontWeight: "800",
                          letterSpacing: 0.4,
                        }}
                      >
                        VOICEOVER · {Math.round(voiceover.durationMs / 100) / 10}s
                      </Text>
                      <Ionicons name="close" size={12} color="#fff" />
                    </Pressable>
                  )}

                  {isRecordingVO && (
                    <View
                      style={{
                        position: "absolute",
                        top: 12,
                        left: 12,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 14,
                        backgroundColor: "rgba(255,59,48,0.9)",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                      pointerEvents="none"
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: "#fff",
                        }}
                      />
                      <Text
                        style={{
                          color: "white",
                          fontSize: 11,
                          fontWeight: "800",
                          letterSpacing: 0.6,
                          fontFamily: "Courier",
                        }}
                      >
                        REC VO {(voElapsedMs / 1000).toFixed(1)}s / 15.0s
                      </Text>
                    </View>
                  )}

                  {/* Drawing color palette */}
                  {drawMode && !isCapturing && (
                    <View
                      style={{
                        position: "absolute",
                        top: 72,
                        left: 10,
                        borderRadius: 22,
                        paddingHorizontal: 8,
                        paddingVertical: 10,
                        backgroundColor: "rgba(0,0,0,0.58)",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.18)",
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          marginBottom: 10,
                        }}
                      >
                        <View style={{ alignItems: "center", gap: 5 }}>
                          <Ionicons name="brush" size={14} color="#06A7A1" />
                          <Text
                            style={{
                              color: "white",
                              fontSize: 11,
                              fontWeight: "900",
                              letterSpacing: 1.2,
                              fontFamily: "Courier",
                            }}
                          >
                            PAINT
                          </Text>
                        </View>
                        <View
                          style={{
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 7,
                            marginTop: 8,
                          }}
                        >
                          <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 10, fontWeight: "800" }}>
                            SIZE
                          </Text>
                          {[2, 4, 8].map((w) => (
                            <Pressable
                              key={w}
                              onPress={() => setDrawWidth(w)}
                              style={{
                                width: 30,
                                height: 22,
                                borderRadius: 11,
                                backgroundColor:
                                  drawWidth === w
                                    ? "rgba(6,167,161,0.95)"
                                    : "rgba(255,255,255,0.12)",
                                alignItems: "center",
                                justifyContent: "center",
                                borderWidth: 1,
                                borderColor:
                                  drawWidth === w
                                    ? "#CFEFEC"
                                    : "rgba(255,255,255,0.22)",
                              }}
                            >
                              <View
                                style={{
                                  width: 14,
                                  height: w,
                                  backgroundColor: "#fff",
                                  borderRadius: w,
                                }}
                              />
                            </Pressable>
                          ))}
                        </View>
                      </View>

                      <View
                        style={{
                          flexDirection: "column",
                          justifyContent: "center",
                          alignItems: "center",
                          gap: 9,
                        }}
                      >
                        {DRAW_COLORS.map((c) => {
                          const selected = drawColor === c;
                          return (
                            <Pressable
                              key={c}
                              onPress={() => setDrawColor(c)}
                              style={{
                                width: selected ? 30 : 25,
                                height: selected ? 30 : 25,
                                borderRadius: selected ? 15 : 12.5,
                                backgroundColor: c,
                                borderWidth: selected ? 3 : 1,
                                borderColor: selected
                                  ? "#ffffff"
                                  : "rgba(255,255,255,0.45)",
                                alignItems: "center",
                                justifyContent: "center",
                                shadowColor: c,
                                shadowOpacity: selected ? 0.9 : 0,
                                shadowRadius: 8,
                                shadowOffset: { width: 0, height: 0 },
                              }}
                            >
                              {selected && (
                                <Ionicons
                                  name="checkmark-circle"
                                  size={17}
                                  color={c === "#ffffff" ? "#111827" : "#ffffff"}
                                />
                              )}
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* Color row when something selected */}
                  {selectedOverlay && !drawMode && !isCapturing && (
                    <View
                      style={{
                        position: "absolute",
                        bottom: 12,
                        left: 12,
                        right: 12,
                        borderRadius: 18,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        backgroundColor: "rgba(0,0,0,0.58)",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.18)",
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        {TEXT_COLORS.map((c) => {
                          const selected = selectedOverlay.color === c;
                          return (
                            <Pressable
                              key={c}
                              onPress={() => setSelectedColor(c)}
                              style={{
                                width: selected ? 30 : 25,
                                height: selected ? 30 : 25,
                                borderRadius: selected ? 15 : 12.5,
                                backgroundColor: c,
                                borderWidth: selected ? 3 : 1,
                                borderColor: selected
                                  ? "#ffffff"
                                  : "rgba(255,255,255,0.45)",
                                alignItems: "center",
                                justifyContent: "center",
                                shadowColor: c,
                                shadowOpacity: selected ? 0.85 : 0,
                                shadowRadius: 8,
                                shadowOffset: { width: 0, height: 0 },
                              }}
                            >
                              {selected && (
                                <Ionicons
                                  name="checkmark-circle"
                                  size={17}
                                  color={c === "#ffffff" ? "#111827" : "#ffffff"}
                                />
                              )}
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              ) : (
                <LinearGradient
                  colors={
                    isDarkMode
                      ? ["#0b1c1c", "#1f2937"]
                      : ["#CFEFEC", "#70A780"]
                  }
                  style={{
                    width: canvasW,
                    height: canvasH,
                    borderRadius: 20,
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 24,
                  }}
                >
                  {!cameraVisible && (
                    <>
                      <Ionicons
                        name="image-outline"
                        size={56}
                        color={isDarkMode ? "#06A7A1" : "#80171F"}
                      />
                      <Text
                        className={`mt-4 text-center font-semibold ${
                          isDarkMode ? "text-dark-text" : "text-pixel-text"
                        }`}
                      >
                        Pick a photo or video to start your story
                      </Text>
                      <Text
                        className={`mt-1 text-center text-xs ${
                          isDarkMode ? "text-gray-400" : "text-gray-700"
                        }`}
                      >
                        Add filters, scifi effects, draggable text
                      </Text>
                    </>
                  )}
                </LinearGradient>
              )}
            </View>

            {/* Filter strip */}
            {mediaUri && mediaType === "image" && (
              <View className="mt-3">
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    gap: 8,
                  }}
                >
                  {FILTERS.map((f) => (
                    <Pressable
                      key={f.id}
                      onPress={() => applyStaticFilter(f.id)}
                      className="items-center"
                    >
                      <View
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                          overflow: "hidden",
                          borderWidth:
                            !hasLockedLiveFilter && filter === f.id ? 2 : 1,
                          borderColor:
                            !hasLockedLiveFilter && filter === f.id
                              ? "#06A7A1"
                              : isDarkMode
                              ? "#333"
                              : "#d1d5db",
                        }}
                      >
                        <StoryFilterCanvas
                          uri={mediaUri}
                          filter={f.id}
                          width={56}
                          height={56}
                          contentFit="cover"
                        />
                      </View>
                      <Text
                        className={`text-xs mt-1 ${
                          !hasLockedLiveFilter && filter === f.id
                            ? isDarkMode
                              ? "text-dark-accent"
                              : "text-pixel-teal"
                            : isDarkMode
                            ? "text-gray-400"
                            : "text-gray-600"
                        }`}
                      >
                        {f.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {mediaUri && mediaType === "video" && (
              <View className="mt-3">
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    gap: 8,
                  }}
                >
                  {FILTERS.map((f) => (
                    <Pressable
                      key={f.id}
                      onPress={() => applyStaticFilter(f.id)}
                      className="items-center"
                    >
                      <View
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                          overflow: "hidden",
                          borderWidth:
                            !hasLockedLiveFilter && filter === f.id ? 2 : 1,
                          borderColor:
                            !hasLockedLiveFilter && filter === f.id
                              ? "#06A7A1"
                              : isDarkMode
                              ? "#333"
                              : "#d1d5db",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "#000",
                        }}
                      >
                        <View
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor:
                              f.id === "heatwave"
                                ? "rgba(126,0,210,0.45)"
                                : f.id === "hologram"
                                ? "rgba(0,200,255,0.35)"
                                : f.id === "vaporwave"
                                ? "rgba(255,0,200,0.3)"
                                : f.id === "infrared"
                                ? "rgba(200,0,80,0.35)"
                                : f.id === "matrix"
                                ? "rgba(0,200,0,0.35)"
                                : f.id === "void"
                                ? "rgba(0,0,0,0.55)"
                                : f.id === "glitch"
                                ? "rgba(0,220,255,0.3)"
                                : f.id === "noir"
                                ? "rgba(0,0,0,0.5)"
                                : f.id === "sepia"
                                ? "rgba(112,66,20,0.45)"
                                : f.id === "acid"
                                ? "rgba(150,255,0,0.35)"
                                : f.id === "arctic"
                                ? "rgba(60,160,255,0.4)"
                                : f.id === "dream"
                                ? "rgba(255,180,230,0.35)"
                                : f.id === "neon"
                                ? "rgba(255,0,180,0.35)"
                                : f.id === "xray"
                                ? "rgba(255,255,255,0.55)"
                                : f.id === "thermal"
                                ? "rgba(255,80,0,0.5)"
                                : f.id === "predator"
                                ? "rgba(180,0,30,0.5)"
                                : f.id === "scanner"
                                ? "rgba(0,220,180,0.45)"
                                : f.id === "chrome"
                                ? "rgba(180,200,220,0.45)"
                                : f.id === "radioactive"
                                ? "rgba(120,255,0,0.45)"
                                : "transparent",
                          }}
                        />
                        <Ionicons name="videocam" size={20} color="white" />
                      </View>
                      <Text
                        className={`text-xs mt-1 ${
                          !hasLockedLiveFilter && filter === f.id
                            ? isDarkMode
                              ? "text-dark-accent"
                              : "text-pixel-teal"
                            : isDarkMode
                            ? "text-gray-400"
                            : "text-gray-600"
                        }`}
                      >
                        {f.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {errorMsg && (
              <Text className="text-red-500 text-sm mt-2 text-center px-4">
                {errorMsg}
              </Text>
            )}
            {voPermissionError && (
              <Text className="text-red-500 text-sm mt-2 text-center px-4">
                {voPermissionError}
              </Text>
            )}
            {statusMsg && (
              <Text
                className={`text-sm mt-2 text-center px-4 ${
                  isDarkMode ? "text-dark-accent" : "text-pixel-teal"
                }`}
              >
                {statusMsg}
              </Text>
            )}

            {/* Bottom actions */}
            <View
              className={`flex-row items-center justify-between px-2 py-3 mt-auto border-t ${
                isDarkMode ? "border-gray-700" : "border-gray-200"
              }`}
            >
              <Pressable
                onPress={pickFromLibrary}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "rgba(6,167,161,0.32)",
                  backgroundColor: isDarkMode ? "rgba(6,167,161,0.10)" : "#E8FFFC",
                  paddingHorizontal: 4,
                  paddingVertical: 9,
                }}
              >
                <Ionicons name="image-outline" size={18} color="#06A7A1" />
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.76}
                  className={`font-semibold text-xs ${
                    isDarkMode ? "text-dark-text" : "text-pixel-text"
                  }`}
                >
                  Library
                </Text>
              </Pressable>

              <Pressable
                onPress={openCamera}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "rgba(6,167,161,0.32)",
                  backgroundColor: isDarkMode ? "rgba(6,167,161,0.10)" : "#E8FFFC",
                  paddingHorizontal: 4,
                  paddingVertical: 9,
                }}
              >
                <Ionicons name="camera-outline" size={18} color="#06A7A1" />
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.76}
                  className={`font-semibold text-xs ${
                    isDarkMode ? "text-dark-text" : "text-pixel-text"
                  }`}
                >
                  Camera
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setDrawMode(false);
                  setSelectedId(null);
                  setSelectedStickerId(null);
                  setShowMusicPicker(true);
                }}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "rgba(6,167,161,0.32)",
                  backgroundColor: isDarkMode ? "rgba(6,167,161,0.10)" : "#E8FFFC",
                  paddingHorizontal: 4,
                  paddingVertical: 9,
                }}
              >
                <Ionicons name="musical-note" size={18} color="#06A7A1" />
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.76}
                  className={`font-semibold text-xs ${
                    isDarkMode ? "text-dark-text" : "text-pixel-text"
                  }`}
                >
                  {music ? "Music \u2713" : "Music"}
                </Text>
              </Pressable>

              {mediaUri && (
                <Pressable
                  onPress={() => {
                    setDrawMode(false);
                    setSelectedId(null);
                    setSelectedStickerId(null);
                    if (isRecordingVO) {
                      stopVoiceoverRecording().catch(() => {});
                    } else if (voiceover) {
                      clearVoiceover();
                    } else {
                      startVoiceoverRecording().catch(() => {});
                    }
                  }}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: isRecordingVO ? "rgba(255,59,48,0.55)" : "rgba(6,167,161,0.32)",
                    backgroundColor: isRecordingVO
                      ? "rgba(255,59,48,0.14)"
                      : isDarkMode
                      ? "rgba(6,167,161,0.10)"
                      : "#E8FFFC",
                    paddingHorizontal: 4,
                    paddingVertical: 9,
                  }}
                >
                  <Ionicons
                    name={
                      isRecordingVO
                        ? "stop-circle"
                        : voiceover
                        ? "mic"
                        : "mic-outline"
                    }
                    size={18}
                    color={isRecordingVO ? "#ff3b30" : "#06A7A1"}
                  />
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.74}
                    className={`font-semibold text-xs ${
                      isDarkMode ? "text-dark-text" : "text-pixel-text"
                    }`}
                  >
                    {isRecordingVO
                      ? "Stop"
                      : voiceover
                      ? "VoiceOver ✓"
                      : "VoiceOver"}
                  </Text>
                </Pressable>
              )}
            </View>

            <MusicPickerModal
              visible={showMusicPicker}
              onClose={() => setShowMusicPicker(false)}
              onSelect={(m) => {
                setMusic(m);
                if (voiceover) clearVoiceover();
                setShowMusicPicker(false);
              }}
              initialMusic={music}
            />

            <StickerPickerModal
              visible={showStickerPicker}
              isDarkMode={isDarkMode}
              onClose={() => setShowStickerPicker(false)}
              onPick={addSticker}
            />

            {/* Inline IG-style text editor */}
            {editingId !== null && (
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(0,0,0,0.82)",
                  zIndex: 1000,
                }}
              >
                <Pressable
                  onPress={commitEdit}
                  style={{ flex: 1 }}
                >
                  <View style={{ flex: 1, paddingTop: 60 }} pointerEvents="box-none">
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "flex-end",
                        paddingHorizontal: 20,
                      }}
                    >
                      <Pressable
                        onPress={commitEdit}
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 22,
                          borderRadius: 999,
                          backgroundColor: "#06A7A1",
                        }}
                      >
                        <Text style={{ color: "white", fontWeight: "800", fontSize: 15 }}>
                          Done
                        </Text>
                      </Pressable>
                    </View>
                    <View
                      style={{
                        flex: 1,
                        justifyContent: "center",
                        paddingHorizontal: 28,
                      }}
                      pointerEvents="box-none"
                    >
                      <TextInput
                        value={editingText}
                        onChangeText={setEditingText}
                        placeholder="Type something..."
                        placeholderTextColor="rgba(255,255,255,0.45)"
                        multiline
                        autoFocus
                        maxLength={140}
                        style={{
                          color: editingOverlay?.color || "#ffffff",
                          fontSize: 32,
                          fontWeight: "800",
                          textAlign: "center",
                          minHeight: 60,
                          textShadowColor: "rgba(0,0,0,0.5)",
                          textShadowOffset: { width: 0, height: 1 },
                          textShadowRadius: 4,
                        }}
                      />
                      <Text
                        style={{
                          color: "rgba(255,255,255,0.5)",
                          fontSize: 11,
                          textAlign: "center",
                          marginTop: 14,
                        }}
                      >
                        Tap anywhere or Done when finished
                      </Text>
                    </View>
                  </View>
                </Pressable>
              </KeyboardAvoidingView>
            )}

            <StoryCameraModal
              visible={cameraVisible}
              onClose={() => setCameraVisible(false)}
              onCapture={handleCameraCapture}
              onPickLibrary={handleCameraPickLibrary}
            />

            {trimSourceUri && (
              <StoryTrimModal
                visible={!!trimSourceUri}
                videoUri={trimSourceUri}
                liveFilter={
                  trimSourceFilterRef.current === "none"
                    ? null
                    : trimSourceFilterRef.current
                }
                initialDurationMs={trimSourceDurationMs}
                maxClipMs={MAX_VIDEO_MS}
                onCancel={handleTrimCancel}
                onConfirm={handleTrimConfirm}
              />
            )}
          </View>
        </GestureHandlerRootView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "./Ionicons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as MediaLibrary from "expo-media-library";
import * as ImageManipulator from "expo-image-manipulator";
import { Video, ResizeMode } from "expo-av";
import { Image } from "expo-image";
import { useAppStore } from "../state/appStore";
import { useFeedStore } from "../state/feedStore";
import { detectLinkPreview, enrichLinkPreview, extractUrlsFromText } from "../utils/linkPreview";
import { LinkPreview, MissionShare, PostAudio, PrivacyLevel } from "../types/feed";
import { getPrivacyOption, nextPrivacy } from "../utils/privacy";
import PostPhotoEditorModal from "./PostPhotoEditorModal";
import MissionShareCard from "./MissionShareCard";

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  initialMissionShare?: MissionShare | null;
}

export default function CreatePostModal({
  visible,
  onClose,
  initialMissionShare,
}: CreatePostModalProps) {
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<string[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<PostAudio | null>(null);
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editorImageUri, setEditorImageUri] = useState<string | null>(null);
  const [editorIndex, setEditorIndex] = useState<number | null>(null);
  const [privacy, setPrivacy] = useState<PrivacyLevel>("public");
  const [privacyFlash, setPrivacyFlash] = useState<string | null>(null);
  const POST_VIDEO_MAX_SECONDS = 15;
  const PICKER_VIDEO_QUALITY = 0.78;
  const PICKER_IMAGE_QUALITY = 0.82;
  const COMPRESSED_IMAGE_WIDTH = 1080;

  const encodeMediaUri = (
    uri: string,
    fileName: string,
    mimeType: string,
    kind: "image" | "video" | "audio",
    destination?: "post-image" | "post-video" | "post-audio"
  ) => {
    // Keep original uri for FileSystem upload, but attach metadata for correct MIME + preview.
    // Format: <uri>#name=<..>&mime=<..>&kind=<..>
    const sep = uri.includes("#") ? "&" : "#";
    const destinationPart = destination ? `&destination=${encodeURIComponent(destination)}` : "";
    return (
      uri +
      sep +
      `name=${encodeURIComponent(fileName)}&mime=${encodeURIComponent(mimeType)}&kind=${encodeURIComponent(kind)}${destinationPart}`
    );
  };

  const parseMediaUri = (maybeEncoded: string) => {
    const [uri, hash] = maybeEncoded.split("#", 2);
    const out: { uri: string; name?: string; mime?: string; kind?: "image" | "video" | "audio" } = { uri };
    if (!hash) return out;

    for (const part of hash.split("&")) {
      const [k, v] = part.split("=", 2);
      if (!k) continue;
      const val = v ? decodeURIComponent(v) : "";
      if (k === "name") out.name = val;
      else if (k === "mime") out.mime = val;
      else if (k === "kind" && (val === "image" || val === "video" || val === "audio")) out.kind = val;
    }
    return out;
  };

  const userEmail = useAppStore((s) => s.userEmail);
  const displayName = useAppStore((s) => s.displayName);
  const rewardsBalance = useAppStore((s) => s.rewardsBalance);
  const userAvatar = useAppStore((s) => s.userAvatar);
  const isDarkMode = useAppStore((s) => s.isDarkMode);
  const defaultPostPrivacy = useAppStore((s) => s.defaultPostPrivacy);
  const createPostRemote = useFeedStore((s) => s.createPostRemote);
  const authorHandle = displayName || userEmail?.split("@")[0] || "anonymous";
  const hasPostBody =
    Boolean(content.trim()) ||
    media.length > 0 ||
    Boolean(selectedAudio) ||
    Boolean(initialMissionShare);

  useEffect(() => {
    if (visible) {
      setPrivacy(defaultPostPrivacy || "public");
      setErrorMsg(null);
      if (initialMissionShare) {
        setContent("");
        setMedia([]);
        setSelectedAudio(null);
        setLinkPreview(null);
      }
    }
  }, [visible, defaultPostPrivacy, initialMissionShare?.id]);

  useEffect(() => {
    let canceled = false;
    if (!linkPreview?.url) return;

    enrichLinkPreview(linkPreview).then((preview) => {
      if (!canceled && preview) {
        setLinkPreview((current) =>
          current?.url === preview.url
            ? {
                ...current,
                title: preview.title || current.title,
                thumbnail: preview.thumbnail || current.thumbnail,
                description: preview.description || current.description,
              }
            : current
        );
      }
    });

    return () => {
      canceled = true;
    };
  }, [linkPreview?.url]);

  const compressImage = async (
    uri: string
  ): Promise<{ uri: string; name: string; mime: string }> => {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: COMPRESSED_IMAGE_WIDTH } }],
        { compress: PICKER_IMAGE_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
      );
      return {
        uri: result.uri,
        name: `image-${Date.now()}.jpg`,
        mime: "image/jpeg",
      };
    } catch (e) {
      console.log("[PICKER] compress failed, using original", String(e));
      return { uri, name: `image-${Date.now()}.jpg`, mime: "image/jpeg" };
    }
  };

  const acceptPickedAssets = async (assets: ImagePicker.ImagePickerAsset[]) => {
    // Needed for iOS "ph://" video URIs to get a real file:// localUri
    const mediaPerm = await MediaLibrary.requestPermissionsAsync();
    if (!mediaPerm.granted) {
      // We can still accept images, but videos often won't upload without localUri.
      console.log("[PICKER] MediaLibrary permission not granted");
    }

    const accepted: string[] = [];
    let tooLong = false;

    for (const asset of assets) {
      let uri = asset.uri || "";
      const byExt = /\.(mp4|mov|m4v|avi|webm)$/i.test(uri);
      const isVideo = asset.type?.startsWith("video") || byExt;
      // iOS can preserve the original duration metadata after the picker trim UI.
      // If ImagePicker returns an asset, accept that returned file instead of
      // rejecting it from stale duration data.

      if (!uri) continue;

      // iOS videos are frequently returned as ph://... which can't be previewed/uploaded directly.
      // Resolve to a file:// localUri via MediaLibrary using assetId.
      if (
        isVideo &&
        (uri.startsWith("ph://") || uri.startsWith("assets-library://")) &&
        (asset as any).assetId &&
        mediaPerm.granted
      ) {
        try {
          const info = await MediaLibrary.getAssetInfoAsync((asset as any).assetId);
          if (info?.localUri) {
            console.log("[PICKER] Resolved video localUri", { from: uri, to: info.localUri });
            uri = info.localUri;
          } else {
            console.log("[PICKER] No localUri for video asset", { uri, assetId: (asset as any).assetId });
          }
        } catch (e) {
          console.log("[PICKER] getAssetInfoAsync failed", String(e));
        }
      }

      // Prefer picker-provided metadata when available (critical for iOS video URIs without extensions).
      const pickerMime = (asset as any).mimeType as string | undefined;
      const pickerName = (asset as any).fileName as string | undefined;
      const pickerAssetId = (asset as any).assetId as string | undefined;

      const lowerName = (pickerName || "").toLowerCase();
      const inferredVideoMime =
        lowerName.endsWith(".mov")
          ? "video/quicktime"
          : lowerName.endsWith(".m4v")
          ? "video/x-m4v"
          : "video/mp4";

      const inferredMime =
        pickerMime ||
        (isVideo
          ? inferredVideoMime
          : pickerName?.toLowerCase().endsWith(".png")
          ? "image/png"
          : "image/jpeg");

      const inferredName =
        pickerName ||
        (isVideo
          ? `video-${Date.now()}.${inferredMime === "video/quicktime" ? "mov" : "mp4"}`
          : inferredMime === "image/png"
          ? `image-${Date.now()}.png`
          : `image-${Date.now()}.jpg`);

      console.log("[PICKER] media", {
        uri,
        type: asset.type,
        duration: asset.duration,
        assetId: pickerAssetId,
        pickerName,
        pickerMime,
        inferredName,
        inferredMime,
        kind: isVideo ? "video" : "image",
      });

      let finalUri = uri;
      let finalName = inferredName;
      let finalMime = inferredMime;

      if (!isVideo) {
        const compressed = await compressImage(uri);
        finalUri = compressed.uri;
        finalName = compressed.name;
        finalMime = compressed.mime;
        console.log("[PICKER] compressed", { from: uri, to: finalUri });
      }

      accepted.push(
        encodeMediaUri(
          finalUri,
          finalName,
          finalMime,
          isVideo ? "video" : "image",
          isVideo ? "post-video" : "post-image"
        )
      );
    }

    return { accepted, tooLong };
  };

  const handleContentChange = (text: string) => {
    setContent(text);

    // Auto-detect links for preview
    const urls = extractUrlsFromText(text);
    if (urls.length > 0 && !linkPreview) {
      const preview = detectLinkPreview(urls[0]);
      if (preview) {
        setLinkPreview(preview);
      }
    }
  };

  const handlePickMedia = async () => {
    setErrorMsg(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      // Using MediaTypeOptions for widest compatibility; warnings are cosmetic
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: false,
      allowsEditing: true,
      quality: PICKER_VIDEO_QUALITY,
      selectionLimit: 1,
      videoMaxDuration: POST_VIDEO_MAX_SECONDS,
    });

    if (!result.canceled) {
      const { accepted, tooLong } = await acceptPickedAssets(result.assets || []);
      if (tooLong) setErrorMsg(`Videos must be ${POST_VIDEO_MAX_SECONDS} seconds or less. Trim and try again.`);
      if (accepted.length > 0) {
        // Single-media composer: replace any existing selection.
        setMedia([accepted[0]]);
        setSelectedAudio(null);
      }
    }
  };

  const handlePickAudio = async () => {
    setErrorMsg(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const uri = asset.uri;
      const name = asset.name || `cuevas-audio-${Date.now()}.m4a`;
      const mime = asset.mimeType || (name.toLowerCase().endsWith(".mp3") ? "audio/mpeg" : "audio/m4a");
      const title = name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ").trim() || "Cuevas Audio Transmission";

      setSelectedAudio({
        uri: encodeMediaUri(uri, name, mime, "audio", "post-audio"),
        title,
        artist: authorHandle,
        durationMs: typeof asset.size === "number" ? undefined : undefined,
      });
      setMedia([]);
      setLinkPreview(null);
    } catch (e) {
      console.log("[AUDIO_PICKER] failed", String(e));
      setErrorMsg("Could not attach that audio file.");
    }
  };

  const handleOpenCamera = async () => {
    setErrorMsg(null);

    const camPerm = await ImagePicker.requestCameraPermissionsAsync();
    if (!camPerm.granted) {
      setErrorMsg("Camera permission is required.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: PICKER_VIDEO_QUALITY,
      videoMaxDuration: POST_VIDEO_MAX_SECONDS,
    });

    if (!result.canceled) {
      const { accepted, tooLong } = await acceptPickedAssets(result.assets || []);
      if (tooLong) setErrorMsg(`Videos must be ${POST_VIDEO_MAX_SECONDS} seconds or less. Trim and try again.`);
      if (accepted.length > 0) {
        setMedia([accepted[0]]);
        setSelectedAudio(null);
      }
    }
  };

  const handleRemoveMedia = (index: number) => {
    setMedia(media.filter((_, i) => i !== index));
  };

  const handleRemoveLinkPreview = () => {
    setLinkPreview(null);
  };

  const handlePost = async () => {
    if (!hasPostBody) {
      return;
    }

    try {
      setIsSubmitting(true);
      await createPostRemote({
        author: authorHandle,
        authorEmail: userEmail || undefined,
        authorRewardPoints: rewardsBalance,
        authorAvatar: userAvatar || undefined,
        content: content.trim(),
        images: media.length > 0 ? media : undefined,
        audio: selectedAudio || undefined,
        linkPreview: linkPreview || undefined,
        missionShare: initialMissionShare || undefined,
        privacy,
      });

      setContent("");
      setMedia([]);
      setSelectedAudio(null);
      setLinkPreview(null);
      setPrivacy(defaultPostPrivacy || "public");
      onClose();
    } catch (e) {
      console.error("Create post error", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentPrivacy = getPrivacyOption(privacy);
  const cyclePrivacy = () => {
    const next = nextPrivacy(privacy);
    const option = getPrivacyOption(next);
    setPrivacy(next);
    setPrivacyFlash(option.shortLabel);
    setTimeout(() => setPrivacyFlash(null), 650);
  };

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
        <View
          className={`flex-1 ${isDarkMode ? "bg-dark-bg" : "bg-white"}`}
        >
          {privacyFlash && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 88,
                left: 0,
                right: 0,
                alignItems: "center",
                zIndex: 20,
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
            <Pressable onPress={onClose}>
              <Ionicons
                name="close"
                size={28}
                color={isDarkMode ? "#CFEFEC" : "#80171F"}
              />
            </Pressable>
            <Text
              className={`text-lg font-bold ${
                isDarkMode ? "text-dark-text" : "text-pixel-text"
              }`}
            >
              Create Post
            </Text>
            <Pressable
              onPress={handlePost}
              disabled={isSubmitting || !hasPostBody}
              className={`px-4 py-2 rounded-full ${
                isSubmitting || !hasPostBody
                  ? "bg-gray-300"
                  : isDarkMode
                  ? "bg-dark-accent"
                  : "bg-pixel-teal"
              }`}
            >
              <Text
                className="font-bold"
                style={{
                  color: isSubmitting || !hasPostBody
                    ? "#6B7280"
                    : isDarkMode
                    ? "#FFFFFF"
                    : "#10252B",
                }}
              >
                {isSubmitting ? "Posting..." : "Post"}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            className="flex-1 px-4 py-4"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {/* Author */}
            <View className="flex-row items-center mb-3">
              <Pressable
                onPress={cyclePrivacy}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: "rgba(6,167,161,0.45)",
                  backgroundColor: isDarkMode ? "rgba(6,167,161,0.14)" : "rgba(6,167,161,0.10)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 10,
                }}
              >
                <Ionicons
                  name={currentPrivacy.icon}
                  size={19}
                  color={isDarkMode ? "#06A7A1" : "#80171F"}
                />
              </Pressable>
              <View
                className={`w-10 h-10 rounded-full items-center justify-center ${
                  isDarkMode ? "bg-dark-accent" : "bg-pixel-teal"
                }`}
              >
                <Text
                  className="font-bold text-lg"
                  style={{ color: isDarkMode ? "#FFFFFF" : "#10252B" }}
                >
                  {(userEmail?.[0] || "A").toUpperCase()}
                </Text>
              </View>
              <Text
                className={`ml-3 font-bold ${
                  isDarkMode ? "text-dark-text" : "text-pixel-text"
                }`}
              >
                {authorHandle}
              </Text>
              <Text
                style={{
                  marginLeft: 8,
                  color: isDarkMode ? "#9CA3AF" : "#6B7280",
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                {currentPrivacy.label}
              </Text>
            </View>

            {/* Content Input */}
            <TextInput
              value={content}
              onChangeText={handleContentChange}
              placeholder="What's happening?"
              placeholderTextColor={isDarkMode ? "#666" : "#999"}
              multiline
              className={`text-base min-h-32 ${
                isDarkMode ? "text-dark-text" : "text-pixel-text"
              }`}
              autoFocus
            />

            {initialMissionShare ? (
              <View style={{ marginTop: 8, marginBottom: 10 }}>
                <Text
                  style={{
                    color: isDarkMode ? "#9CA3AF" : "#6B7280",
                    fontSize: 11,
                    fontWeight: "900",
                    letterSpacing: 1.4,
                    marginBottom: 4,
                  }}
                >
                  RESHARED MISSION
                </Text>
                <MissionShareCard mission={initialMissionShare} isDarkMode={isDarkMode} compact />
              </View>
            ) : null}

            {/* Link Preview */}
            {linkPreview && (
              <View
                className={`mt-3 rounded-xl border overflow-hidden ${
                  isDarkMode
                    ? "border-gray-700 bg-dark-surface"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <Pressable
                  onPress={handleRemoveLinkPreview}
                  className="absolute top-2 right-2 z-10 bg-black/50 rounded-full p-1"
                >
                  <Ionicons name="close" size={16} color="white" />
                </Pressable>

                {linkPreview.thumbnail && (
                  <Image
                    source={{ uri: linkPreview.thumbnail }}
                    style={{ width: "100%", height: 190 }}
                    contentFit="cover"
                  />
                )}

                <View className="p-3">
                  <Text
                    className={`text-xs mb-1 ${
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    {linkPreview.domain}
                  </Text>
                  <Text
                    className={`font-bold mb-1 ${
                      isDarkMode ? "text-dark-text" : "text-pixel-text"
                    }`}
                  >
                    {linkPreview.title}
                  </Text>
                  {linkPreview.description && (
                    <Text
                      className={`text-sm ${
                        isDarkMode ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      {linkPreview.description}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* Audio Preview */}
            {selectedAudio && (
              <View
                style={{
                  marginTop: 12,
                  borderWidth: 1,
                  borderColor: "rgba(6,167,161,0.45)",
                  borderRadius: 16,
                  padding: 12,
                  backgroundColor: isDarkMode ? "rgba(6,167,161,0.10)" : "rgba(6,167,161,0.08)",
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Image
                  source={{ uri: "https://static.wixstatic.com/media/2d1963_8669792e43224b528732c48c4472f5e9~mv2.png" }}
                  style={{ width: 42, height: 42, borderRadius: 8, marginRight: 10 }}
                  contentFit="contain"
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: isDarkMode ? "#CFEFEC" : "#111827",
                      fontWeight: "900",
                      fontSize: 14,
                    }}
                    numberOfLines={1}
                  >
                    {selectedAudio.title}
                  </Text>
                  <Text
                    style={{
                      color: isDarkMode ? "#06A7A1" : "#057D78",
                      fontWeight: "800",
                      fontSize: 11,
                      letterSpacing: 1.2,
                      marginTop: 3,
                    }}
                  >
                    AUDIO TRANSMISSION
                  </Text>
                </View>
                <Pressable
                  onPress={() => setSelectedAudio(null)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: "rgba(0,0,0,0.45)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="close" size={16} color="white" />
                </Pressable>
              </View>
            )}

            {/* Error */}
            {errorMsg && (
              <Text className="text-red-500 text-sm mt-2">{errorMsg}</Text>
            )}

            {/* Media Previews */}
            {media.filter(Boolean).length > 0 && (
              <View className="mt-3 flex-row flex-wrap gap-2">
                {media.filter(Boolean).map((encoded, index) => {
                  const m = parseMediaUri(encoded);
                  const isVideo =
                    m.kind === "video" ||
                    (m.mime ? m.mime.startsWith("video/") : false) ||
                    /\.(mp4|mov|m4v|avi|webm)$/i.test(m.uri);
                  return (
                  <View key={index} className="relative">
                      {isVideo ? (
                        <Video
                          source={{ uri: m.uri }}
                          style={{ width: 96, height: 96, borderRadius: 8 }}
                          resizeMode={ResizeMode.COVER}
                          isMuted
                          shouldPlay={false}
                        />
                      ) : (
                    <Image
                          source={{ uri: m.uri }}
                          style={{ width: 96, height: 96, borderRadius: 8 }}
                          contentFit="cover"
                    />
                      )}
                    <Pressable
                        onPress={() => handleRemoveMedia(index)}
                      className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1"
                    >
                      <Ionicons name="close" size={16} color="white" />
                    </Pressable>
                    {!isVideo && (
                      <Pressable
                        onPress={() => {
                          setEditorImageUri(m.uri);
                          setEditorIndex(index);
                        }}
                        style={{
                          position: "absolute",
                          bottom: 4,
                          left: 4,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 999,
                          backgroundColor: "rgba(0,0,0,0.65)",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Ionicons
                          name="color-wand-outline"
                          size={12}
                          color="white"
                        />
                        <Text
                          style={{
                            color: "white",
                            fontSize: 10,
                            fontWeight: "800",
                          }}
                        >
                          Edit
                        </Text>
                      </Pressable>
                    )}
                  </View>
                  );
                })}
              </View>
            )}
          </ScrollView>

          {/* Composer media rail: visible by default and lifted above keyboard */}
          {(
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderTopWidth: 1,
                borderTopColor: isDarkMode ? "rgba(6,167,161,0.18)" : "rgba(8,25,32,0.08)",
                backgroundColor: isDarkMode ? "#181818" : "#FFFFFF",
              }}
            >
              <View className="flex-row items-center">
                <Pressable onPress={handlePickMedia} className="mr-5">
                  <Ionicons
                    name="image-outline"
                    size={24}
                    color={isDarkMode ? "#06A7A1" : "#06A7A1"}
                  />
                </Pressable>
                <Pressable onPress={handleOpenCamera}>
                  <Ionicons
                    name="camera-outline"
                    size={24}
                    color={isDarkMode ? "#06A7A1" : "#06A7A1"}
                  />
                </Pressable>
                <Pressable onPress={handlePickAudio} className="ml-5">
                  <Ionicons
                    name="musical-notes"
                    size={24}
                    color={isDarkMode ? "#06A7A1" : "#06A7A1"}
                  />
                </Pressable>
              </View>
              <Text className={`${isDarkMode ? "text-gray-400" : "text-gray-500"} text-xs`}>
                {selectedAudio ? "Audio attached" : media.length > 0 ? `Change media (videos ≤${POST_VIDEO_MAX_SECONDS}s)` : "Add media/audio"}
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      <PostPhotoEditorModal
        visible={!!editorImageUri && editorIndex !== null}
        imageUri={editorImageUri}
        onCancel={() => {
          setEditorImageUri(null);
          setEditorIndex(null);
        }}
        onConfirm={(captured) => {
          if (editorIndex !== null) {
            const encoded = encodeMediaUri(
              captured,
              `image-${Date.now()}.jpg`,
              "image/jpeg",
              "image",
              "post-image"
            );
            setMedia((prev) =>
              prev.map((m, i) => (i === editorIndex ? encoded : m))
            );
          }
          setEditorImageUri(null);
          setEditorIndex(null);
        }}
      />
    </Modal>
  );
}

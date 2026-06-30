import React, { useEffect, useState, useRef } from "react";
import { View, Text, Pressable, Image as RNImage, Linking, Modal, Share } from "react-native";
import { Ionicons } from "./Ionicons";
import { Post } from "../types/feed";
import { completeLinkPreview, enrichLinkPreview, extractUrlsFromText, formatRelativeTime } from "../utils/linkPreview";
import { useAppStore } from "../state/appStore";
import { useFeedStore } from "../state/feedStore";
import { getPrivacyOption, nextPrivacy } from "../utils/privacy";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { Image } from "expo-image";
import { Video, ResizeMode } from "expo-av";
import { sharePngUriToInstagramStory } from "../utils/instagramStories";
import ImageViewerModal from "./ImageViewerModal";
import PostShareableCard from "./PostShareableCard";
import PostAudioPlayer from "./PostAudioPlayer";

interface PostCardProps {
  post: Post;
  onLike: (postId: string) => void;
  onComment: (postId: string) => void;
  onDelete: (postId: string) => void;
  onAuthorPress?: (handle: string) => void;
}

function PostCardImpl({ post, onLike, onComment, onDelete, onAuthorPress }: PostCardProps) {
  const isDarkMode = useAppStore((s) => s.isDarkMode);
  const userEmail = useAppStore((s) => s.userEmail);
  const displayName = useAppStore((s) => s.displayName);
  const handleAliases = useAppStore((s) => s.handleAliases);
  const rewardsBalance = useAppStore((s) => s.rewardsBalance);
  const updatePostPrivacy = useFeedStore((s) => s.updatePostPrivacy);
  const viewShotRef = useRef<ViewShot>(null);
  const [showComments, setShowComments] = useState(false);
  const [privacyFlash, setPrivacyFlash] = useState<string | null>(null);

  const isOwnPost =
    (!!displayName && displayName === post.author) ||
    (!!userEmail && userEmail.split("@")[0] === post.author) ||
    (handleAliases || []).includes(post.author);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const mediaList = (post.images || []).filter(Boolean);
  const getRenderableMediaUri = (uri: string) => uri.split("#", 1)[0];
  const isVideoUri = (uri?: string) =>
    !!uri &&
    (/\.(mp4|mov|m4v|avi|webm)$/i.test(uri) ||
      uri.includes("video.wixstatic.com/video/") ||
      uri.includes("kind=video") ||
      uri.includes("mime=video%2F") ||
      uri.includes("mime=video/") ||
      (uri.startsWith("file://") && (uri.includes(".mp4") || uri.includes(".mov") || uri.includes(".m4v"))));

  const urlsInContent = extractUrlsFromText(post.content || "");
  const displayLinkPreview = completeLinkPreview(post.linkPreview, post.content);

  const handleLinkPress = () => {
    if (displayLinkPreview?.url) {
      Linking.openURL(displayLinkPreview.url);
    }
  };

  const contentWithoutPreviewUrl =
    displayLinkPreview?.url && urlsInContent.length === 1
      ? (post.content || "").replace(urlsInContent[0], "").trim()
      : post.content;

  const renderContent = () => {
    const textColor = isDarkMode ? "text-dark-text" : "text-pixel-text";
    if (!contentWithoutPreviewUrl) return null;

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = contentWithoutPreviewUrl.split(urlRegex);
    return (
      <Text className={`text-base mb-3 leading-5 ${textColor}`}>
        {parts.map((part, index) => {
          const cleanUrl = extractUrlsFromText(part)[0];
          if (!cleanUrl) return <Text key={`${post.id}-text-${index}`}>{part}</Text>;
          return (
            <Text
              key={`${post.id}-url-${index}`}
              style={{ color: "#06A7A1", fontWeight: "700" }}
              onPress={(e) => {
                e.stopPropagation?.();
                Linking.openURL(cleanUrl);
              }}
            >
              {part}
            </Text>
          );
        })}
      </Text>
    );
  };

  const handleDelete = () => {
    setConfirmDeleteOpen(true);
  };

  const confirmDelete = () => {
    setConfirmDeleteOpen(false);
    onDelete(post.id);
  };

  const [isCapturing, setIsCapturing] = useState(false);
  const [exportMounted, setExportMounted] = useState(false);
  const [exportVariant, setExportVariant] = useState<"default" | "instagramVideoOverlay">("default");
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [exportImgAspect, setExportImgAspect] = useState<number | null>(null);
  const [feedImgAspect, setFeedImgAspect] = useState<number | null>(null);
  const [enrichedLinkPreview, setEnrichedLinkPreview] = useState(displayLinkPreview);
  const privacy = getPrivacyOption(post.privacy);

  const cyclePostPrivacy = () => {
    const next = nextPrivacy(post.privacy);
    const option = getPrivacyOption(next);
    updatePostPrivacy(post.id, next);
    setPrivacyFlash(option.shortLabel);
    setTimeout(() => setPrivacyFlash(null), 650);
  };

  useEffect(() => {
    let canceled = false;
    setEnrichedLinkPreview(displayLinkPreview);
    enrichLinkPreview(displayLinkPreview).then((preview) => {
      if (!canceled) setEnrichedLinkPreview(preview);
    });
    return () => {
      canceled = true;
    };
  }, [displayLinkPreview?.url, displayLinkPreview?.thumbnail, displayLinkPreview?.title]);

  const waitForRef = async (timeoutMs = 800) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (viewShotRef.current && viewShotRef.current.capture) return true;
      await new Promise((r) => setTimeout(r, 30));
    }
    return false;
  };

  const handleShare = async () => {
    try {
      setIsCapturing(true);
      setExportVariant("default");
      setExportMounted(true);
      await waitForRef();
      await new Promise((resolve) => setTimeout(resolve, 400));

      if (viewShotRef.current && viewShotRef.current.capture) {
        const uri = await viewShotRef.current.capture();

        setIsCapturing(false);
        setExportMounted(false);

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: "image/png",
            dialogTitle: "Share Post",
          });
        }
      } else {
        setIsCapturing(false);
        setExportMounted(false);
      }
    } catch (error) {
      setIsCapturing(false);
      setExportMounted(false);
      Share.share({
        message: post.content,
      });
    }
  };

  const handleShareToInstagramStory = async () => {
    try {
      const hasSingleVideo = mediaList.length === 1 && isVideoUri(mediaList[0]);
      setIsCapturing(true);
      setExportVariant(hasSingleVideo ? "instagramVideoOverlay" : "default");
      setExportMounted(true);
      await waitForRef();
      await new Promise((resolve) => setTimeout(resolve, 400));
      if (viewShotRef.current && viewShotRef.current.capture) {
        const uri = await viewShotRef.current.capture();
        setIsCapturing(false);
        setExportMounted(false);
        setExportVariant("default");

        const ok = await sharePngUriToInstagramStory(uri, {
          debugTag: "POST",
          attributionURL: "https://www.ecothot.com/",
          backgroundVideoUri: hasSingleVideo ? getRenderableMediaUri(mediaList[0]) : undefined,
        });

        if (!ok && (await Sharing.isAvailableAsync())) {
          await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share Post" });
        }
      } else {
        setIsCapturing(false);
        setExportMounted(false);
        setExportVariant("default");
      }
    } catch (e) {
      setIsCapturing(false);
      setExportMounted(false);
      setExportVariant("default");
    }
  };

  const formatPoints = (points: number | undefined): string => {
    if (!points && points !== 0) {
      return "0";
    }
    if (points >= 1000) {
      return `${(points / 1000).toFixed(1)}k`;
    }
    return points.toString();
  };

  return (
    <>
      {/* Shareable View for Export (hidden, only mounted while capturing to keep feed scrolling smooth) */}
      {exportMounted && <PostShareableCard ref={viewShotRef} post={post} variant={exportVariant} />}

      {/* Image Viewer Modal */}
      <ImageViewerModal
        visible={viewerUri !== null}
        imageUri={viewerUri}
        onClose={() => setViewerUri(null)}
      />

      {/* Delete Confirm Modal */}
      <Modal
        visible={confirmDeleteOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDeleteOpen(false)}
      >
        <Pressable
          onPress={() => setConfirmDeleteOpen(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.55)",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              width: "100%",
              maxWidth: 360,
              backgroundColor: isDarkMode ? "#1F2937" : "#fff",
              borderRadius: 16,
              padding: 20,
            }}
          >
            <View style={{ alignItems: "center", marginBottom: 12 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: "rgba(255,0,0,0.12)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 8,
                }}
              >
                <Ionicons name="trash" size={22} color="#FF3B30" />
              </View>
              <Text
                style={{
                  color: isDarkMode ? "#CFEFEC" : "#1F2937",
                  fontWeight: "800",
                  fontSize: 17,
                }}
              >
                Delete Post?
              </Text>
              <Text
                style={{
                  color: isDarkMode ? "#9CA3AF" : "#6B7280",
                  fontSize: 13,
                  textAlign: "center",
                  marginTop: 6,
                }}
              >
                This will permanently remove your post.
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <Pressable
                onPress={() => setConfirmDeleteOpen(false)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: isDarkMode ? "#374151" : "#F3F4F6",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: isDarkMode ? "#CFEFEC" : "#1F2937",
                    fontWeight: "700",
                  }}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={confirmDelete}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: "#FF3B30",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "800" }}>Delete</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Regular Post View */}
      <Pressable
        onPress={() => onComment(post.id)}
        className={`border-b ${isDarkMode ? "border-gray-800" : "border-gray-200"}`}
      >
        <View className="px-4 py-3">
          {privacyFlash && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 52,
                left: 0,
                right: 0,
                alignItems: "center",
                zIndex: 5,
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
          <View className="flex-row items-center mb-2">
            {/* Avatar */}
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                onAuthorPress?.(post.author);
              }}
              hitSlop={6}
              className={`w-10 h-10 rounded-full items-center justify-center overflow-hidden ${
                isDarkMode ? "bg-dark-accent" : "bg-pixel-teal"
              }`}
            >
              {post.authorAvatar ? (
                <RNImage
                  source={{ uri: post.authorAvatar }}
                  style={{ width: 40, height: 40 }}
                />
              ) : (
                <Text
                  className="font-bold text-lg"
                  style={{ color: isDarkMode ? "#FFFFFF" : "#10252B" }}
                >
                  {post.author[0].toUpperCase()}
                </Text>
              )}
            </Pressable>

            {/* Author & Time */}
            <View className="ml-3 flex-1">
              <View className="flex-row items-center">
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation?.();
                    onAuthorPress?.(post.author);
                  }}
                  hitSlop={6}
                >
                  <Text
                    className={`font-bold ${
                      isDarkMode ? "text-dark-text" : "text-pixel-text"
                    }`}
                  >
                    {post.author}
                  </Text>
                </Pressable>
                <View
                  className={`ml-2 px-2 py-0.5 rounded-full ${
                    isDarkMode ? "bg-dark-accent/20" : "bg-pixel-teal/20"
                  }`}
                >
                  <Text
                  className={`text-xs font-bold ${
                    isDarkMode ? "text-dark-accent" : "text-pixel-teal"
                  }`}
                >
                  {formatPoints(post.authorRewardPoints)} ₡
                </Text>
              </View>
            </View>
            <Text
              className={`text-xs ${
                isDarkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              {formatRelativeTime(post.timestamp)}
            </Text>
          </View>
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              cyclePostPrivacy();
            }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: "rgba(6,167,161,0.45)",
              backgroundColor: isDarkMode ? "rgba(6,167,161,0.14)" : "rgba(6,167,161,0.10)",
              alignItems: "center",
              justifyContent: "center",
            }}
            hitSlop={8}
          >
            <Ionicons
              name={privacy.icon}
              size={18}
              color={isDarkMode ? "#06A7A1" : "#80171F"}
            />
          </Pressable>
        </View>

        {/* Content */}
        {renderContent()}

        {/* Media (images or videos) */}
        {mediaList.length > 0 && (
          <View className="mb-3">
            {mediaList.length === 1 ? (
              isVideoUri(mediaList[0]) ? (
                <Video
                  source={{ uri: getRenderableMediaUri(mediaList[0]) }}
                  style={{ width: "100%", aspectRatio: 1, borderRadius: 12 }}
                  resizeMode={ResizeMode.COVER}
                  useNativeControls
                  isMuted={false}
                />
              ) : (
                <Pressable onPress={() => setViewerUri(getRenderableMediaUri(mediaList[0]))}>
                  <Image
                    source={{ uri: getRenderableMediaUri(mediaList[0]) }}
                    className="w-full rounded-xl"
                    style={{ aspectRatio: Math.max(feedImgAspect || 1, 1) }}
                    contentFit="cover"
                    onLoad={(e: any) => {
                      const w = e?.source?.width;
                      const h = e?.source?.height;
                      if (w && h) setFeedImgAspect(w / h);
                    }}
                  />
                </Pressable>
              )
            ) : (
              <View className="flex-row flex-wrap gap-1">
                {mediaList.slice(0, 4).map((uri, index) => {
                  const renderUri = getRenderableMediaUri(uri);
                  return isVideoUri(uri) ? (
                    <Video
                      key={index}
                      source={{ uri: renderUri }}
                      style={{ width: "49%", aspectRatio: 1, borderRadius: 8 }}
                      resizeMode={ResizeMode.COVER}
                      useNativeControls
                      isMuted={false}
                    />
                  ) : (
                    <Pressable
                      key={index}
                      onPress={() => setViewerUri(renderUri)}
                      style={{ width: "49%" }}
                    >
                      <Image
                        source={{ uri: renderUri }}
                        className="rounded-lg"
                        style={{ width: "100%", aspectRatio: 1 }}
                        contentFit="cover"
                      />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Audio */}
        {post.audio && <PostAudioPlayer audio={post.audio} isDarkMode={isDarkMode} />}

        {/* Link Preview */}
        {enrichedLinkPreview && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              handleLinkPress();
            }}
            className={`mb-3 rounded-xl border overflow-hidden ${
              isDarkMode
                ? "border-gray-700 bg-dark-surface"
                : "border-gray-200 bg-gray-50"
            }`}
          >
            {enrichedLinkPreview.thumbnail && (
              <Image
                source={{ uri: enrichedLinkPreview.thumbnail }}
                style={{ width: "100%", height: 190, backgroundColor: isDarkMode ? "#111827" : "#E5E7EB" }}
                contentFit="cover"
              />
            )}

            <View className="p-3">
              <View className="flex-row items-center mb-1">
                {enrichedLinkPreview.type === "youtube" && (
                  <Ionicons
                    name="logo-youtube"
                    size={16}
                    color="#FF0000"
                    style={{ marginRight: 6 }}
                  />
                )}
                {enrichedLinkPreview.type === "spotify" && (
                  <Ionicons
                    name="musical-notes"
                    size={16}
                    color="#1DB954"
                    style={{ marginRight: 6 }}
                  />
                )}
                <Text
                  className={`text-xs ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  {enrichedLinkPreview.domain}
                </Text>
              </View>

              <Text
                className={`font-bold mb-1 ${
                  isDarkMode ? "text-dark-text" : "text-pixel-text"
                }`}
              >
                {enrichedLinkPreview.title}
              </Text>

              {enrichedLinkPreview.description && (
                <Text
                  className={`text-sm ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                  numberOfLines={2}
                >
                  {enrichedLinkPreview.description}
                </Text>
              )}
            </View>
          </Pressable>
        )}

        {/* Actions */}
        <View className="flex-row items-center pt-2">
          <Pressable
            onPress={() => onLike(post.id)}
            className="flex-row items-center mr-6"
          >
            <Ionicons
              name={post.isLiked ? "flash" : "flash-outline"}
              size={20}
              color={post.isLiked ? "#06A7A1" : isDarkMode ? "#888" : "#666"}
            />
            <Text
              className={`ml-1 text-sm ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}
            >
              {post.likes}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => onComment(post.id)}
            className="flex-row items-center mr-6"
          >
            <Ionicons
              name="chatbubble-outline"
              size={20}
              color={isDarkMode ? "#888" : "#666"}
            />
            <Text
              className={`ml-1 text-sm ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}
            >
              {post.commentsList?.length || 0}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleShare}
            className="flex-row items-center mr-6"
          >
            <Ionicons
              name="share-outline"
              size={20}
              color={isDarkMode ? "#888" : "#666"}
            />
          </Pressable>

          <Pressable
            onPress={handleShareToInstagramStory}
            className="flex-row items-center mr-6"
          >
            <Ionicons
              name="logo-instagram"
              size={20}
              color={isDarkMode ? "#888" : "#666"}
            />
          </Pressable>

          {/* Delete Button (only for own posts) */}
          {isOwnPost && (
            <Pressable onPress={handleDelete}>
              <Ionicons
                name="trash-outline"
                size={20}
                color="#FF0000"
              />
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
    </>
  );
}

const PostCard = React.memo(PostCardImpl, (prev, next) => {
  if (prev.post === next.post) return true;
  if (prev.post.id !== next.post.id) return false;
  if (prev.post.likes !== next.post.likes) return false;
  if (prev.post.isLiked !== next.post.isLiked) return false;
  if ((prev.post.commentsList?.length || 0) !== (next.post.commentsList?.length || 0)) return false;
  if (prev.post.content !== next.post.content) return false;
  if ((prev.post.images?.length || 0) !== (next.post.images?.length || 0)) return false;
  if (prev.post.audio?.uri !== next.post.audio?.uri) return false;
  if (prev.post.authorAvatar !== next.post.authorAvatar) return false;
  if (prev.post.authorRewardPoints !== next.post.authorRewardPoints) return false;
  if (prev.post.privacy !== next.post.privacy) return false;
  if (prev.onLike !== next.onLike) return false;
  if (prev.onComment !== next.onComment) return false;
  if (prev.onDelete !== next.onDelete) return false;
  if (prev.onAuthorPress !== next.onAuthorPress) return false;
  return true;
});

export default PostCard;

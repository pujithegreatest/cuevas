import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Video, ResizeMode } from "expo-av";
import { Ionicons } from "./Ionicons";
import { useAppStore } from "../state/appStore";
import { useFeedStore } from "../state/feedStore";
import { Comment, CommentPrivacyLevel } from "../types/feed";
import {
  completeLinkPreview,
  enrichLinkPreview,
  formatRelativeTime,
} from "../utils/linkPreview";
import {
  canViewComment,
  getCommentPrivacyOption,
  getUserHandles,
  nextCommentPrivacy,
} from "../utils/privacy";
import { normalizeHandle } from "../utils/handles";

interface CommentsModalProps {
  visible: boolean;
  postId: string | null;
  onClose: () => void;
}

export default function CommentsModal({
  visible,
  postId,
  onClose,
}: CommentsModalProps) {
  const [commentText, setCommentText] = useState("");
  const [commentPrivacy, setCommentPrivacy] =
    useState<CommentPrivacyLevel>("public");
  const [privacyFlash, setPrivacyFlash] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const insets = useSafeAreaInsets();

  const userEmail = useAppStore((s) => s.userEmail);
  const displayName = useAppStore((s) => s.displayName);
  const handleAliases = useAppStore((s) => s.handleAliases);
  const friends = useAppStore((s) => s.friends);
  const blockedHandles = useAppStore((s) => s.blockedHandles);
  const rewardsBalance = useAppStore((s) => s.rewardsBalance);
  const isDarkMode = useAppStore((s) => s.isDarkMode);

  const posts = useFeedStore((s) => s.posts);
  const addComment = useFeedStore((s) => s.addComment);
  const updateCommentPrivacy = useFeedStore((s) => s.updateCommentPrivacy);

  const post = posts.find((p) => p.id === postId);
  const userHandles = useMemo(
    () => getUserHandles(userEmail, displayName, handleAliases),
    [userEmail, displayName, handleAliases]
  );
  const visibleComments = useMemo(
    () => {
      if (!post) return [];
      const blocked = new Set((blockedHandles || []).map((item) => normalizeHandle(item, "")));
      return (post.commentsList || []).filter(
        (comment) =>
          !blocked.has(normalizeHandle(comment.author, "")) &&
          canViewComment(comment, post, userHandles, friends || [])
      );
    },
    [post, userHandles, friends, blockedHandles]
  );
  const displayPreview = completeLinkPreview(post?.linkPreview, post?.content);
  const [enrichedPreview, setEnrichedPreview] = useState(displayPreview);

  useEffect(() => {
    let canceled = false;
    setEnrichedPreview(displayPreview);
    enrichLinkPreview(displayPreview).then((preview) => {
      if (!canceled) setEnrichedPreview(preview);
    });
    return () => {
      canceled = true;
    };
  }, [displayPreview?.url, displayPreview?.thumbnail, displayPreview?.title]);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const colors = {
    bg: isDarkMode ? "#0b1115" : "#ffffff",
    surface: isDarkMode ? "#151f26" : "#F8FAFC",
    text: isDarkMode ? "#CFEFEC" : "#1F2937",
    sub: isDarkMode ? "#9CA3AF" : "#6B7280",
    border: isDarkMode ? "#26313b" : "#E5E7EB",
    accent: "#06A7A1",
  };

  const formatPoints = (points: number | undefined): string => {
    if (!points && points !== 0) return "0";
    if (points >= 1000) return `${(points / 1000).toFixed(1)}k`;
    return points.toString();
  };

  const currentPrivacy = getCommentPrivacyOption(commentPrivacy);
  const composerBottom =
    keyboardHeight > 0
      ? Math.max(keyboardHeight - insets.bottom + 34, 16)
      : Math.max(insets.bottom + 12, 18);
  const listBottomPadding = keyboardHeight > 0 ? 148 : 112;

  const flashPrivacy = (value: CommentPrivacyLevel) => {
    const option = getCommentPrivacyOption(value);
    setPrivacyFlash(option.shortLabel);
    setTimeout(() => setPrivacyFlash(null), 650);
  };

  const cycleComposerPrivacy = () => {
    const next = nextCommentPrivacy(commentPrivacy);
    setCommentPrivacy(next);
    flashPrivacy(next);
  };

  const handleAddComment = () => {
    if (!commentText.trim() || !postId) return;

    addComment(postId, {
      author: userEmail?.split("@")[0] || "anonymous",
      authorRewardPoints: rewardsBalance,
      content: commentText.trim(),
      privacy: commentPrivacy,
    });

    setCommentText("");
  };

  const isVideoUri = (uri?: string) =>
    !!uri &&
    (/\.(mp4|mov|m4v|avi|webm)$/i.test(uri) ||
      uri.includes("video.wixstatic.com/video/") ||
      uri.includes("kind=video") ||
      uri.includes("mime=video%2F") ||
      uri.includes("mime=video/"));

  const header = useMemo(() => {
    if (!post) return null;
    const mediaUri = post.images?.[0];
    return (
      <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 18 }}>
              {post.author[0].toUpperCase()}
            </Text>
          </View>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ color: colors.text, fontWeight: "900" }}>{post.author}</Text>
              <View
                style={{
                  marginLeft: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 999,
                  backgroundColor: "rgba(6,167,161,0.18)",
                }}
              >
                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "900" }}>
                  {formatPoints(post.authorRewardPoints)} ₡
                </Text>
              </View>
            </View>
            <Text style={{ color: colors.sub, fontSize: 12 }}>
              {formatRelativeTime(post.timestamp)}
            </Text>
          </View>
        </View>

        {mediaUri ? (
          isVideoUri(mediaUri) ? (
            <Video
              source={{ uri: mediaUri }}
              style={{ width: "100%", aspectRatio: 1, borderRadius: 14, backgroundColor: "#000" }}
              resizeMode={ResizeMode.COVER}
              useNativeControls
            />
          ) : (
            <Image
              source={{ uri: mediaUri }}
              style={{ width: "100%", aspectRatio: 1, borderRadius: 14, backgroundColor: colors.surface }}
              contentFit="cover"
            />
          )
        ) : enrichedPreview ? (
          <Pressable
            onPress={() => enrichedPreview.url && Linking.openURL(enrichedPreview.url)}
            style={{
              borderRadius: 14,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            {enrichedPreview.thumbnail && (
              <Image
                source={{ uri: enrichedPreview.thumbnail }}
                style={{ width: "100%", height: 148, backgroundColor: colors.surface }}
                contentFit="cover"
              />
            )}
            <View style={{ padding: 12 }}>
              <Text style={{ color: colors.sub, fontSize: 12, fontWeight: "800" }}>
                {enrichedPreview.domain}
              </Text>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900", marginTop: 3 }}>
                {enrichedPreview.title}
              </Text>
              {enrichedPreview.description && (
                <Text style={{ color: colors.sub, fontSize: 13, marginTop: 3 }} numberOfLines={2}>
                  {enrichedPreview.description}
                </Text>
              )}
            </View>
          </Pressable>
        ) : null}

        {!!post.content && !enrichedPreview && (
          <Text style={{ color: colors.text, fontSize: 14, marginTop: 10 }} numberOfLines={4}>
            {post.content}
          </Text>
        )}
      </View>
    );
  }, [post, colors.accent, colors.border, colors.sub, colors.surface, colors.text, enrichedPreview]);

  const renderComment = ({ item }: { item: Comment }) => {
    const option = getCommentPrivacyOption(item.privacy);
    return (
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900" }}>
              {item.author[0].toUpperCase()}
            </Text>
          </View>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7 }}>
              <Text style={{ color: colors.text, fontWeight: "900" }}>{item.author}</Text>
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "900" }}>
                {formatPoints(item.authorRewardPoints)} ₡
              </Text>
              <Text style={{ color: colors.sub, fontSize: 12 }}>
                {formatRelativeTime(item.timestamp)}
              </Text>
              <Pressable
                onPress={() => {
                  if (!postId) return;
                  const next = nextCommentPrivacy(item.privacy);
                  updateCommentPrivacy(postId, item.id, next);
                  flashPrivacy(next);
                }}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(6,167,161,0.13)",
                }}
              >
                <Ionicons name={option.icon} size={13} color={colors.accent} />
              </Pressable>
            </View>
            <Text style={{ color: colors.text, fontSize: 15, marginTop: 5, lineHeight: 20 }}>
              {item.content}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (!post) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={undefined}
        keyboardVerticalOffset={0}
        style={{ flex: 1, backgroundColor: colors.bg }}
      >
        {privacyFlash && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 90,
              left: 0,
              right: 0,
              alignItems: "center",
              zIndex: 10,
            }}
          >
            <View
              style={{
                paddingHorizontal: 18,
                paddingVertical: 8,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: colors.accent,
                backgroundColor: "rgba(6,167,161,0.18)",
                shadowColor: colors.accent,
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
                  textShadowColor: colors.accent,
                  textShadowRadius: 8,
                }}
              >
                {privacyFlash}
              </Text>
            </View>
          </View>
        )}

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={28} color={colors.text} />
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}>
            Comments
          </Text>
          <View style={{ width: 28 }} />
        </View>

        <FlatList
          data={visibleComments}
          keyExtractor={(item) => item.id}
          renderItem={renderComment}
          ListHeaderComponent={header}
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: listBottomPadding }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 36 }}>
              <Ionicons name="chatbubble-outline" size={54} color={isDarkMode ? "#374151" : "#CBD5E1"} />
              <Text style={{ color: colors.sub, marginTop: 10, fontWeight: "700" }}>
                No comments yet. Start the thread.
              </Text>
            </View>
          }
        />

        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: composerBottom,
            paddingHorizontal: 14,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 10,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: "rgba(6,167,161,0.35)",
              backgroundColor: colors.surface,
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 4 },
            }}
          >
            <Pressable
              onPress={cycleComposerPrivacy}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: "rgba(6,167,161,0.16)",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 8,
              }}
            >
              <Ionicons name={currentPrivacy.icon} size={18} color={colors.accent} />
            </Pressable>
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder={currentPrivacy.value === "poster" ? "Private note to poster..." : "Add a comment..."}
              placeholderTextColor={isDarkMode ? "#6B7280" : "#94A3B8"}
              style={{
                flex: 1,
                color: colors.text,
                backgroundColor: isDarkMode ? "#0b1115" : "#ffffff",
                borderRadius: 18,
                paddingHorizontal: 14,
                paddingVertical: 9,
                fontWeight: "700",
              }}
            />
            <Pressable
              onPress={handleAddComment}
              disabled={!commentText.trim()}
              style={{ marginLeft: 10, opacity: commentText.trim() ? 1 : 0.35 }}
            >
              <Ionicons name="send" size={24} color={colors.accent} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

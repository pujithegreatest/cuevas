import React, { useCallback, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  FlatList,
  Image as RNImage,
  ScrollView,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "./Ionicons";
import { useAppStore } from "../state/appStore";
import { useFeedStore } from "../state/feedStore";
import { useStoryStore } from "../state/storyStore";
import PostCard from "./PostCard";
import { formatRelativeTime } from "../utils/linkPreview";
import { canViewPost, getUserHandles } from "../utils/privacy";
import { displayUsername, normalizeHandle } from "../utils/handles";
import ReportReasonModal from "./ReportReasonModal";
import { ReportReason, submitModerationReport } from "../api/moderation-reports";

interface Props {
  visible: boolean;
  handle: string | null;
  onClose: () => void;
  onComment: (postId: string) => void;
  onAvatarPress?: (handle: string) => void;
}

export default function UserProfileModal({
  visible,
  handle,
  onClose,
  onComment,
  onAvatarPress,
}: Props) {
  const insets = useSafeAreaInsets();
  const isDarkMode = useAppStore((s) => s.isDarkMode);
  const userEmail = useAppStore((s) => s.userEmail);
  const displayName = useAppStore((s) => s.displayName);
  const handleAliases = useAppStore((s) => s.handleAliases);
  const friends = useAppStore((s) => s.friends);
  const addFriend = useAppStore((s) => s.addFriend);
  const blockHandle = useAppStore((s) => s.blockHandle);
  const reportContent = useAppStore((s) => s.reportContent);
  const posts = useFeedStore((s) => s.posts);
  const toggleLike = useFeedStore((s) => s.toggleLike);
  const deletePost = useFeedStore((s) => s.deletePost);
  const stories = useStoryStore((s) => s.stories);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const userHandles = useMemo(
    () => getUserHandles(userEmail, displayName, handleAliases),
    [userEmail, displayName, handleAliases]
  );

  const userPosts = useMemo(
    () => {
      const clean = normalizeHandle(handle || "", "");
      if (!clean) return [];
      return posts.filter(
        (p) => normalizeHandle(p.author, "") === clean && canViewPost(p, userHandles, friends || [])
      );
    },
    [posts, handle, userHandles, friends]
  );

  const userStories = useMemo(
    () => {
      const clean = normalizeHandle(handle || "", "");
      return clean ? stories.filter((s) => normalizeHandle(s.author, "") === clean) : [];
    },
    [stories, handle]
  );

  const latestAvatar = useMemo(() => {
    const p = userPosts.find((p) => p.authorAvatar);
    return p?.authorAvatar || null;
  }, [userPosts]);

  const totalLikes = useMemo(
    () => userPosts.reduce((acc, p) => acc + (p.likes || 0), 0),
    [userPosts]
  );
  const totalComments = useMemo(
    () => userPosts.reduce((acc, p) => acc + (p.commentsList?.length || 0), 0),
    [userPosts]
  );

  const latestActivity =
    userPosts[0]?.timestamp ||
    userStories[0]?.timestamp ||
    null;

  const renderPost = useCallback(
    ({ item }: { item: (typeof userPosts)[number] }) => (
      <PostCard
        post={item}
        onLike={toggleLike}
        onComment={onComment}
        onDelete={deletePost}
        onAuthorPress={onAvatarPress}
      />
    ),
    [toggleLike, onComment, deletePost, onAvatarPress],
  );

  const keyExtractor = useCallback(
    (item: (typeof userPosts)[number]) => item.id,
    [],
  );

  const bg = isDarkMode ? "#0b1115" : "#CFEFEC";
  const text = isDarkMode ? "#CFEFEC" : "#1F2937";
  const sub = isDarkMode ? "#9CA3AF" : "#6B7280";
  const surface = isDarkMode ? "#1F2937" : "#fff";
  const border = isDarkMode ? "#374151" : "#e5e7eb";
  const username = displayUsername(handle, null, "User");
  const cleanHandle = normalizeHandle(handle || username);
  const isOwnProfile = userHandles.has(handle || "") || userHandles.has(cleanHandle);
  const inNetwork = (friends || []).some(
    (friend) => normalizeHandle(friend.handle) === cleanHandle
  );

  const handleReportProfile = () => {
    setMenuOpen(false);
    setReportOpen(true);
  };

  const submitProfileReport = async (reason: ReportReason) => {
    if (!cleanHandle) return;
    setReportSubmitting(true);
    const report = {
      targetHandle: cleanHandle,
      contentType: "profile" as const,
      contentId: cleanHandle,
      reason,
    };
    reportContent(report);
    try {
      await submitModerationReport({
        ...report,
        reporterEmail: userEmail,
        contentPreview: `${username} @${cleanHandle}`,
      });
      setReportOpen(false);
      Alert.alert("Report sent", `@${cleanHandle} was sent for review.`);
    } catch (error) {
      console.log("[REPORT] profile report failed", String((error as any)?.message || error));
      Alert.alert(
        "Report saved locally",
        "The report was saved on this device, but the server did not receive it yet. Try again after refreshing."
      );
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleBlockProfile = () => {
    setMenuOpen(false);
    Alert.alert(
      "Block user?",
      `Block @${cleanHandle}? Their posts and stories will be hidden on this device.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () => {
            blockHandle(cleanHandle);
            onClose();
          },
        },
      ]
    );
  };

  const handleAddToNetwork = () => {
    setMenuOpen(false);
    addFriend({
      id: `lab-${cleanHandle}`,
      handle: cleanHandle,
      title: username || "Research Contact",
    });
    Alert.alert("Research network", `@${cleanHandle} was added.`);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: bg }}>
        <ReportReasonModal
          visible={reportOpen}
          title="Report profile"
          targetLabel={`Report @${cleanHandle || "user"} for review`}
          isDarkMode={isDarkMode}
          submitting={reportSubmitting}
          onCancel={() => {
            if (!reportSubmitting) setReportOpen(false);
          }}
          onSubmit={submitProfileReport}
        />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 10,
            borderBottomWidth: 1,
            borderBottomColor: border,
          }}
        >
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={26} color={text} />
          </Pressable>
          <Text style={{ color: text, fontWeight: "800", fontSize: 16 }}>
            {username}
          </Text>
          {isOwnProfile ? (
            <View style={{ width: 26 }} />
          ) : (
            <Pressable onPress={() => setMenuOpen((open) => !open)} hitSlop={10}>
              <Ionicons name="ellipsis-horizontal" size={26} color={text} />
            </Pressable>
          )}
        </View>

        {menuOpen && !isOwnProfile && (
          <View
            style={{
              position: "absolute",
              top: insets.top + 56,
              right: 16,
              zIndex: 20,
              width: 304,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: "rgba(6,167,161,0.35)",
              backgroundColor: isDarkMode ? "#111827" : "#FFFFFF",
              shadowColor: "#000",
              shadowOpacity: 0.22,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 8,
              overflow: "visible",
              paddingVertical: 8,
              paddingHorizontal: 8,
            }}
          >
            {[
              {
                label: "Report",
                icon: "warning-outline",
                color: "#FACC15",
                onPress: handleReportProfile,
              },
              {
                label: "Block",
                icon: "ban-outline",
                color: "#FF3B30",
                onPress: handleBlockProfile,
              },
              {
                label: inNetwork ? "In Research Network" : "Add to Research Network",
                icon: "person-add-outline",
                color: "#06A7A1",
                onPress: inNetwork ? () => setMenuOpen(false) : handleAddToNetwork,
              },
            ].map((item) => (
              <Pressable
                key={item.label}
                onPress={item.onPress}
                style={({ pressed }) => ({
                  minHeight: 52,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: pressed ? "rgba(6,167,161,0.12)" : "transparent",
                  opacity: pressed ? 0.72 : 1,
                })}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(6,167,161,0.10)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>
                <Text
                  numberOfLines={2}
                  style={{
                    marginLeft: 14,
                    color: text,
                    fontWeight: "900",
                    fontSize: 15,
                    flex: 1,
                    lineHeight: 18,
                    paddingRight: 4,
                    includeFontPadding: false,
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <FlatList
          data={userPosts}
          keyExtractor={keyExtractor}
          initialNumToRender={3}
          windowSize={5}
          maxToRenderPerBatch={3}
          updateCellsBatchingPeriod={100}
          removeClippedSubviews
          scrollEventThrottle={16}
          renderItem={renderPost}
          ListHeaderComponent={
            <View>
              <LinearGradient
                colors={
                  isDarkMode
                    ? ["#06A7A1", "#0891B2", "#1F2937"]
                    : ["#06A7A1", "#70A780", "#CFEFEC"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ margin: 16, borderRadius: 24, padding: 20 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 36,
                      backgroundColor: "rgba(255,255,255,0.25)",
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 2,
                      borderColor: "rgba(255,255,255,0.7)",
                      overflow: "hidden",
                    }}
                  >
                    {latestAvatar ? (
                      <RNImage
                        source={{ uri: latestAvatar }}
                        style={{ width: 72, height: 72 }}
                      />
                    ) : (
                      <Text
                        style={{
                          color: "white",
                          fontWeight: "800",
                          fontSize: 30,
                        }}
                      >
                        {(handle?.[0] || "?").toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text
                      style={{
                        color: "white",
                        fontWeight: "800",
                        fontSize: 22,
                      }}
                      >
                        {username}
                      </Text>
                      <Text
                        style={{
                          color: "rgba(255,255,255,0.85)",
                          fontSize: 12,
                          marginTop: 2,
                        }}
                      >
                        @{cleanHandle}
                      </Text>
                    {latestActivity && (
                      <Text
                        style={{
                          color: "rgba(255,255,255,0.85)",
                          fontSize: 12,
                          marginTop: 2,
                        }}
                      >
                        Last seen {formatRelativeTime(latestActivity)}
                      </Text>
                    )}
                  </View>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginTop: 18,
                  }}
                >
                  {[
                    { label: "Posts", value: userPosts.length },
                    { label: "Zaps", value: totalLikes },
                    { label: "Comments", value: totalComments },
                    { label: "Stories", value: userStories.length },
                  ].map((s) => (
                    <View key={s.label} style={{ alignItems: "center" }}>
                      <Text
                        style={{
                          color: "white",
                          fontWeight: "800",
                          fontSize: 20,
                        }}
                      >
                        {s.value}
                      </Text>
                      <Text
                        style={{
                          color: "rgba(255,255,255,0.85)",
                          fontSize: 10,
                          letterSpacing: 1,
                        }}
                      >
                        {s.label.toUpperCase()}
                      </Text>
                    </View>
                  ))}
                </View>

                <Pressable
                  onPress={() => setCompletedOpen(true)}
                  style={({ pressed }) => ({
                    marginTop: 16,
                    minHeight: 56,
                    borderRadius: 18,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    backgroundColor: "#06A7A1",
                    borderWidth: 2,
                    borderColor: "#B7FFFA",
                    shadowColor: "#001B1F",
                    shadowOpacity: 0.22,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 7 },
                    elevation: 4,
                    opacity: pressed ? 0.78 : 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  })}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons name="shield-check" size={18} color="#FFFFFF" />
                    <Text style={{ color: "white", fontWeight: "900", marginLeft: 8 }}>
                      Completed Missions
                    </Text>
                  </View>
                  <View
                    style={{
                      borderRadius: 999,
                      backgroundColor: "#FFFFFF",
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ color: "#057D78", fontSize: 12, fontWeight: "900" }}>Open</Text>
                  </View>
                </Pressable>
              </LinearGradient>

              <View
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderTopWidth: 1,
                  borderBottomWidth: 1,
                  borderColor: border,
                  backgroundColor: surface,
                }}
              >
                <Text
                  style={{
                    color: sub,
                    fontSize: 11,
                    fontWeight: "700",
                    letterSpacing: 2,
                  }}
                >
                  TRANSMISSIONS · {userPosts.length}
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 60,
              }}
            >
              <Ionicons
                name="cloud-offline-outline"
                size={48}
                color={isDarkMode ? "#444" : "#888"}
              />
              <Text style={{ color: sub, marginTop: 12 }}>
                No posts from {username} yet.
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        />

        <Modal
          visible={completedOpen}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setCompletedOpen(false)}
        >
          <View style={{ flex: 1, backgroundColor: bg }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 16,
                paddingTop: insets.top + 10,
                paddingBottom: 12,
                borderBottomWidth: 1,
                borderBottomColor: border,
              }}
            >
              <Pressable onPress={() => setCompletedOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={26} color={text} />
              </Pressable>
              <Text style={{ color: text, fontWeight: "900", fontSize: 16 }}>
                {username} Missions
              </Text>
              <View style={{ width: 26 }} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 28 }}>
              <View
                style={{
                  borderRadius: 24,
                  padding: 18,
                  backgroundColor: surface,
                  borderWidth: 2,
                  borderColor: isDarkMode ? "rgba(6,167,161,0.50)" : "#057D78",
                }}
              >
                <View style={{ alignItems: "center" }}>
                  <View
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: 20,
                      backgroundColor: "#06A7A1",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 12,
                    }}
                  >
                    <Ionicons name="shield-check" size={27} color="#FFFFFF" />
                  </View>
                  <Text style={{ color: text, fontWeight: "900", fontSize: 17, textAlign: "center" }}>
                    No Completed Missions Yet
                  </Text>
                  <Text style={{ color: sub, lineHeight: 20, marginTop: 8, textAlign: "center" }}>
                    Verified service tasks will appear here after a real mission check-in is recorded.
                  </Text>
                  <Pressable
                    onPress={() => setCompletedOpen(false)}
                    style={({ pressed }) => ({
                      marginTop: 22,
                      borderRadius: 16,
                      paddingVertical: 12,
                      paddingHorizontal: 18,
                      backgroundColor: "#06A7A1",
                      borderWidth: 2,
                      borderColor: isDarkMode ? "#39D8D0" : "#057D78",
                      opacity: pressed ? 0.78 : 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      alignSelf: "center",
                      minWidth: 188,
                      transform: [{ translateX: -10 }],
                    })}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="arrow-back-outline" size={17} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text numberOfLines={1} style={{ color: "#FFFFFF", fontWeight: "900" }}>
                        Back to Profile
                      </Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

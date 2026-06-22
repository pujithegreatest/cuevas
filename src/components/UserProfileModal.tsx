import React, { useCallback, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  FlatList,
  Image as RNImage,
  ScrollView,
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
  const posts = useFeedStore((s) => s.posts);
  const toggleLike = useFeedStore((s) => s.toggleLike);
  const deletePost = useFeedStore((s) => s.deletePost);
  const stories = useStoryStore((s) => s.stories);
  const [completedOpen, setCompletedOpen] = useState(false);

  const userHandles = useMemo(
    () => getUserHandles(userEmail, displayName, handleAliases),
    [userEmail, displayName, handleAliases]
  );

  const userPosts = useMemo(
    () =>
      handle
        ? posts.filter((p) => p.author === handle && canViewPost(p, userHandles, friends || []))
        : [],
    [posts, handle, userHandles, friends]
  );

  const userStories = useMemo(
    () => (handle ? stories.filter((s) => s.author === handle) : []),
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: bg }}>
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
            @{handle || "user"}
          </Text>
          <View style={{ width: 26 }} />
        </View>

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
                      @{handle}
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
                    { label: "Likes", value: totalLikes },
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
                No posts from @{handle} yet.
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
                @{handle || "user"} Missions
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
                      marginTop: 16,
                      borderRadius: 16,
                      paddingVertical: 12,
                      paddingHorizontal: 18,
                      backgroundColor: "#06A7A1",
                      borderWidth: 2,
                      borderColor: isDarkMode ? "#39D8D0" : "#057D78",
                      opacity: pressed ? 0.78 : 1,
                      flexDirection: "row",
                      alignItems: "center",
                    })}
                  >
                    <Ionicons name="arrow-back-outline" size={17} color="#FFFFFF" />
                    <Text style={{ color: "#FFFFFF", fontWeight: "900", marginLeft: 8 }}>
                      Back to Profile
                    </Text>
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

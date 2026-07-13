import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { MainTabParamList } from "../types/navigation";
import { useAppStore } from "../state/appStore";
import { useFeedStore } from "../state/feedStore";
import { Ionicons } from "../components/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PostCard from "../components/PostCard";
import CreatePostModal from "../components/CreatePostModal";
import CommentsModal from "../components/CommentsModal";
import StoriesRow from "../components/StoriesRow";
import CreateStoryModal from "../components/CreateStoryModal";
import StoryViewerModal from "../components/StoryViewerModal";
import UserProfileModal from "../components/UserProfileModal";
import { useStoryStore } from "../state/storyStore";
import { canViewPost, getUserHandles } from "../utils/privacy";
import { normalizeHandle } from "../utils/handles";

type Props = BottomTabScreenProps<MainTabParamList, "Feed">;

export default function FeedScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isCreateStoryVisible, setIsCreateStoryVisible] = useState(false);
  const [viewerGroupIndex, setViewerGroupIndex] = useState<number | null>(null);
  const [selectedProfileHandle, setSelectedProfileHandle] = useState<
    string | null
  >(null);

  const isDarkMode = useAppStore((s) => s.isDarkMode);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);
  const logout = useAppStore((s) => s.logout);
  const userEmail = useAppStore((s) => s.userEmail);
  const displayName = useAppStore((s) => s.displayName);
  const userHandle = useAppStore((s) => s.userHandle);
  const handleAliases = useAppStore((s) => s.handleAliases);
  const friends = useAppStore((s) => s.friends);
  const blockedHandles = useAppStore((s) => s.blockedHandles);

  const posts = useFeedStore((s) => s.posts);
  const toggleLike = useFeedStore((s) => s.toggleLike);
  const deletePost = useFeedStore((s) => s.deletePost);
  const fetchPosts = useFeedStore((s) => s.fetchPosts);
  const pruneExpiredStories = useStoryStore((s) => s.pruneExpired);
  const feedViewer = useMemo(
    () => ({ userEmail, displayName, userHandle, handleAliases, friends }),
    [userEmail, displayName, userHandle, handleAliases, friends]
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPosts(feedViewer);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchPosts(feedViewer);
    pruneExpiredStories();
  }, [feedViewer, fetchPosts, pruneExpiredStories]);

  const handleComment = useCallback((postId: string) => {
    setSelectedPostId(postId);
  }, []);

  const handleDelete = useCallback(
    (postId: string) => {
      deletePost(postId);
    },
    [deletePost],
  );

  const handleAuthorPress = useCallback((handle: string) => {
    setSelectedProfileHandle(handle);
  }, []);

  const visiblePosts = useMemo(() => {
    const handles = getUserHandles(userEmail, displayName, [userHandle || "", ...(handleAliases || [])]);
    const blocked = new Set((blockedHandles || []).map((item) => normalizeHandle(item, "")));
    return posts.filter(
      (post) =>
        !blocked.has(normalizeHandle(post.author, "")) &&
        canViewPost(post, handles, friends || [])
    );
  }, [posts, userEmail, displayName, userHandle, handleAliases, friends, blockedHandles]);

  const renderPost = useCallback(
    ({ item }: { item: (typeof visiblePosts)[number] }) => (
      <PostCard
        post={item}
        onLike={toggleLike}
        onComment={handleComment}
        onDelete={handleDelete}
        onAuthorPress={handleAuthorPress}
      />
    ),
    [toggleLike, handleComment, handleDelete, handleAuthorPress],
  );

  const keyExtractor = useCallback((item: (typeof visiblePosts)[number]) => item.id, []);

  return (
    <View
      className={`flex-1 ${isDarkMode ? "bg-dark-bg" : "bg-white"}`}
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View
        className={`flex-row items-center justify-between px-4 py-3 border-b ${
          isDarkMode ? "border-gray-800" : "border-gray-200"
        }`}
      >
        <Text
          className={`text-2xl font-bold ${
            isDarkMode ? "text-dark-text" : "text-pixel-text"
          }`}
        >
          Feed
        </Text>

        <View className="flex-row items-center gap-3">
          {/* Dark Mode Toggle */}
          <Pressable onPress={toggleDarkMode}>
            <Ionicons
              name={isDarkMode ? "sunny" : "moon"}
              size={24}
              color={isDarkMode ? "#06A7A1" : "#80171F"}
            />
          </Pressable>

          {/* Logout */}
          <Pressable
            onPress={logout}
            accessibilityRole="button"
            accessibilityLabel="Log out of Cuevas"
          >
            <Ionicons
              name="log-out-outline"
              size={24}
              color={isDarkMode ? "#06A7A1" : "#80171F"}
            />
          </Pressable>
        </View>
      </View>

      {/* Posts Feed */}
      <FlatList
        data={visiblePosts}
        keyExtractor={keyExtractor}
        renderItem={renderPost}
        ListHeaderComponent={
          <StoriesRow
            onOpenGroup={(idx) => setViewerGroupIndex(idx)}
            onCreate={() => setIsCreateStoryVisible(true)}
          />
        }
        initialNumToRender={4}
        windowSize={5}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={100}
        removeClippedSubviews
        disableVirtualization={false}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={isDarkMode ? "#06A7A1" : "#80171F"}
          />
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Ionicons
              name="chatbubbles-outline"
              size={64}
              color={isDarkMode ? "#444" : "#ccc"}
            />
            <Text
              className={`text-lg mt-4 ${
                isDarkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              No posts yet
            </Text>
            <Text
              className={`text-sm mt-2 ${
                isDarkMode ? "text-gray-500" : "text-gray-400"
              }`}
            >
              Be the first to share something!
            </Text>
          </View>
        }
        contentContainerStyle={visiblePosts.length === 0 ? { flex: 1 } : undefined}
      />

      {/* Floating Create Post Button */}
      <Pressable
        onPress={() => setIsCreateModalVisible(true)}
        className={`absolute bottom-6 right-6 w-14 h-14 rounded-full items-center justify-center shadow-lg ${
          isDarkMode ? "bg-dark-accent" : "bg-pixel-teal"
        }`}
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
        }}
      >
        <Ionicons name="add" size={32} color="white" />
      </Pressable>

      {/* Create Post Modal */}
      <CreatePostModal
        visible={isCreateModalVisible}
        onClose={() => setIsCreateModalVisible(false)}
      />

      {/* Comments Modal */}
      <CommentsModal
        visible={selectedPostId !== null}
        postId={selectedPostId}
        onClose={() => setSelectedPostId(null)}
      />

      {/* Create Story Modal */}
      <CreateStoryModal
        visible={isCreateStoryVisible}
        onClose={() => setIsCreateStoryVisible(false)}
      />

      {/* Story Viewer */}
      <StoryViewerModal
        visible={viewerGroupIndex !== null}
        initialGroupIndex={viewerGroupIndex ?? 0}
        onClose={() => setViewerGroupIndex(null)}
      />

      {/* Other User Profile */}
      <UserProfileModal
        visible={selectedProfileHandle !== null}
        handle={selectedProfileHandle}
        onClose={() => setSelectedProfileHandle(null)}
        onComment={(postId) => {
          setSelectedProfileHandle(null);
          setSelectedPostId(postId);
        }}
        onAvatarPress={(h) => setSelectedProfileHandle(h)}
      />
    </View>
  );
}

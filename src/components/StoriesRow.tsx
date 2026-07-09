import React, { useMemo } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "./Ionicons";
import { useAppStore } from "../state/appStore";
import { useStoryStore, groupStoriesByAuthor } from "../state/storyStore";
import { Story, StoryGroup } from "../types/story";
import StoryFilterCanvas from "./StoryFilterCanvas";
import { displayUsername, normalizeHandle } from "../utils/handles";

interface StoriesRowProps {
  onOpenGroup: (groupIndex: number) => void;
  onCreate: () => void;
}

function StoryThumb({
  story,
  size,
}: {
  story: Story;
  size: number;
}) {
  const isVideo = story.mediaType === "video";
  const thumbUri =
    isVideo && story.thumbnailUri ? story.thumbnailUri : story.imageUri;
  const thumbType: "image" | "video" =
    isVideo && story.thumbnailUri ? "image" : story.mediaType || "image";

  return (
    <View
      style={{
        width: size,
        height: size,
        overflow: "hidden",
        borderRadius: size / 2,
      }}
    >
      <StoryFilterCanvas
        uri={thumbUri}
        filter={story.filter || "none"}
        width={size}
        height={size}
        contentFit="cover"
        mediaType={thumbType}
        videoShouldPlay={false}
        videoMuted
        effectMode={story.liveFilter ? "live" : "static"}
      />
      {isVideo && (
        <View
          style={{
            position: "absolute",
            bottom: 2,
            right: 2,
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: "rgba(0,0,0,0.6)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="videocam" size={9} color="white" />
        </View>
      )}
    </View>
  );
}

export default function StoriesRow({ onOpenGroup, onCreate }: StoriesRowProps) {
  const isDarkMode = useAppStore((s) => s.isDarkMode);
  const userEmail = useAppStore((s) => s.userEmail);
  const displayName = useAppStore((s) => s.displayName);
  const blockedHandles = useAppStore((s) => s.blockedHandles);
  const stories = useStoryStore((s) => s.stories);
  const viewedIds = useStoryStore((s) => s.viewedIds);

  const currentUser = displayUsername(displayName, userEmail, "anonymous");

  const visibleStories = useMemo(() => {
    const blocked = new Set((blockedHandles || []).map((item) => normalizeHandle(item, "")));
    return stories.filter((story) => !blocked.has(normalizeHandle(story.author, "")));
  }, [stories, blockedHandles]);

  const groups: StoryGroup[] = useMemo(
    () => groupStoriesByAuthor(visibleStories, viewedIds, currentUser),
    [visibleStories, viewedIds, currentUser]
  );

  const ownGroupIndex = groups.findIndex((g) => g.isOwn);
  const hasOwnStory = ownGroupIndex !== -1;
  const latestOwnStory =
    hasOwnStory
      ? groups[ownGroupIndex].stories[
          groups[ownGroupIndex].stories.length - 1
        ]
      : null;

  return (
    <View
      className={`border-b ${
        isDarkMode ? "border-gray-800" : "border-gray-200"
      }`}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12 }}
      >
        {/* Your story — tap thumb to view existing, tap + badge to add another */}
        <View className="items-center mr-3 w-20">
          <View className="relative">
            <Pressable
              onPress={() => {
                if (hasOwnStory) onOpenGroup(ownGroupIndex);
                else onCreate();
              }}
            >
              <View
                className={`w-16 h-16 rounded-full items-center justify-center ${
                  isDarkMode ? "bg-dark-surface" : "bg-gray-100"
                }`}
                style={{
                  borderWidth: 2,
                  borderColor: isDarkMode ? "#333" : "#e5e7eb",
                }}
              >
                {hasOwnStory && latestOwnStory ? (
                  <StoryThumb story={latestOwnStory} size={60} />
                ) : (
                  <Text
                    className={`text-xl font-bold ${
                      isDarkMode ? "text-dark-text" : "text-pixel-text"
                    }`}
                  >
                    {(currentUser[0] || "A").toUpperCase()}
                  </Text>
                )}
              </View>
            </Pressable>
            <Pressable
              onPress={onCreate}
              hitSlop={6}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full items-center justify-center"
              style={{
                backgroundColor: "#06A7A1",
                borderWidth: 2,
                borderColor: isDarkMode ? "#1a1a1a" : "#ffffff",
              }}
            >
              <Ionicons name="add" size={14} color="white" />
            </Pressable>
          </View>
          <Text
            className={`text-xs mt-1 ${
              isDarkMode ? "text-dark-text" : "text-pixel-text"
            }`}
            numberOfLines={1}
          >
            Your Story
          </Text>
        </View>

        {/* Other authors' stories */}
        {groups
          .map((group, idx) => ({ group, idx }))
          .filter(({ group }) => !group.isOwn)
          .map(({ group, idx }) => (
            <Pressable
              key={group.author}
              onPress={() => onOpenGroup(idx)}
              className="items-center mr-3 w-20"
            >
              {group.hasUnviewed ? (
                <LinearGradient
                  colors={["#06A7A1", "#80171F", "#70A780"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <View
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 30,
                      backgroundColor: isDarkMode ? "#1a1a1a" : "#ffffff",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    <StoryThumb story={group.stories[0]} size={56} />
                  </View>
                </LinearGradient>
              ) : (
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 2,
                    borderColor: isDarkMode ? "#333" : "#d1d5db",
                    overflow: "hidden",
                  }}
                >
                  <StoryThumb story={group.stories[0]} size={56} />
                </View>
              )}
              <Text
                className={`text-xs mt-1 ${
                  isDarkMode ? "text-dark-text" : "text-pixel-text"
                }`}
                numberOfLines={1}
              >
                {group.author}
              </Text>
            </Pressable>
          ))}
      </ScrollView>
    </View>
  );
}

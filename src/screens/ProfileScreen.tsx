import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList,
  Image as RNImage,
  Modal,
  TextInput,
  RefreshControl,
} from "react-native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { MainTabParamList } from "../types/navigation";
import { useAppStore } from "../state/appStore";
import { useFeedStore } from "../state/feedStore";
import { useStoryStore } from "../state/storyStore";
import { Ionicons } from "../components/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PostCard from "../components/PostCard";
import CommentsModal from "../components/CommentsModal";
import EditUsernameModal from "../components/EditUsernameModal";
import BusinessProfileModal from "../components/BusinessProfileModal";
import { LinearGradient } from "expo-linear-gradient";
import { formatRelativeTime } from "../utils/linkPreview";
import { POST_PRIVACY_OPTIONS, getPrivacyOption } from "../utils/privacy";

type Props = BottomTabScreenProps<MainTabParamList, "Profile">;

type Badge = {
  id: string;
  label: string;
  icon: string;
  color: string;
  unlocked: boolean;
  hint: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function TickerHeadline({ items, isDark }: { items: string[]; isDark: boolean }) {
  const x = useSharedValue(0);
  const [trackWidth, setTrackWidth] = useState(600);

  useEffect(() => {
    x.value = 0;
    x.value = withRepeat(
      withTiming(-trackWidth, {
        duration: Math.max(8000, trackWidth * 22),
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, [trackWidth]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  const sequence = items.join("   ★   ");

  return (
    <View
      style={{
        height: 28,
        backgroundColor: isDark ? "#0b1c1c" : "#80171F",
        overflow: "hidden",
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <Animated.View style={[{ flexDirection: "row" }, style]}>
        <Text
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          style={{
            color: isDark ? "#06A7A1" : "#CFEFEC",
            fontWeight: "700",
            fontSize: 12,
            paddingHorizontal: 16,
            letterSpacing: 2,
          }}
        >
          {sequence}
        </Text>
        <Text
          style={{
            color: isDark ? "#06A7A1" : "#CFEFEC",
            fontWeight: "700",
            fontSize: 12,
            paddingHorizontal: 16,
            letterSpacing: 2,
          }}
        >
          {sequence}
        </Text>
      </Animated.View>
    </View>
  );
}

function PulsingAvatar({
  letter,
  tier,
  avatarUri,
}: {
  letter: string;
  tier: number;
  avatarUri?: string | null;
}) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 200 })
      ),
      -1,
      false
    );
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.7, 0]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.5]) }],
  }));

  const ring2Style = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.45, 0]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1.1, 1.8]) }],
  }));

  const ringColor =
    tier >= 4 ? "#A065FF" : tier >= 3 ? "#06A7A1" : tier >= 2 ? "#70A780" : "#ffffff";

  return (
    <View style={{ width: 88, height: 88, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={[
          {
            position: "absolute",
            width: 72,
            height: 72,
            borderRadius: 36,
            borderWidth: 2,
            borderColor: ringColor,
          },
          ringStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            position: "absolute",
            width: 72,
            height: 72,
            borderRadius: 36,
            borderWidth: 1.5,
            borderColor: ringColor,
          },
          ring2Style,
        ]}
      />
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
        {avatarUri ? (
          <RNImage
            source={{ uri: avatarUri }}
            style={{ width: 72, height: 72 }}
          />
        ) : (
          <Text style={{ color: "white", fontWeight: "800", fontSize: 30 }}>
            {letter}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function ProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const isDarkMode = useAppStore((s) => s.isDarkMode);
  const userEmail = useAppStore((s) => s.userEmail);
  const displayName = useAppStore((s) => s.displayName);
  const handleAliases = useAppStore((s) => s.handleAliases);
  const rewardsBalance = useAppStore((s) => s.rewardsBalance);
  const userAvatar = useAppStore((s) => s.userAvatar);
  const userBio = useAppStore((s) => s.userBio);
  const defaultPostPrivacy = useAppStore((s) => s.defaultPostPrivacy);
  const setDefaultPostPrivacy = useAppStore((s) => s.setDefaultPostPrivacy);
  const friends = useAppStore((s) => s.friends);
  const addFriend = useAppStore((s) => s.addFriend);
  const removeFriend = useAppStore((s) => s.removeFriend);
  const businessProfileUnlocked = useAppStore((s) => s.businessProfileUnlocked);
  const unlockBusinessProfile = useAppStore((s) => s.unlockBusinessProfile);

  const posts = useFeedStore((s) => s.posts);
  const toggleLike = useFeedStore((s) => s.toggleLike);
  const deletePost = useFeedStore((s) => s.deletePost);
  const stories = useStoryStore((s) => s.stories);

  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [editUsernameOpen, setEditUsernameOpen] = useState(false);
  const [completedMissionsOpen, setCompletedMissionsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [networkOpen, setNetworkOpen] = useState(false);
  const [businessProfileOpen, setBusinessProfileOpen] = useState(false);
  const [businessPasswordOpen, setBusinessPasswordOpen] = useState(false);
  const [businessPassword, setBusinessPassword] = useState("");
  const [businessPasswordError, setBusinessPasswordError] = useState<string | null>(null);
  const [networkHandleDraft, setNetworkHandleDraft] = useState("");
  const [networkTagDraft, setNetworkTagDraft] = useState("");
  const [profileRefreshing, setProfileRefreshing] = useState(false);

  const openBusinessProfile = () => {
    if (!businessProfileUnlocked) {
      setBusinessPassword("");
      setBusinessPasswordError(null);
      setSettingsOpen(false);
      setTimeout(() => setBusinessPasswordOpen(true), 250);
      return;
    }
    setSettingsOpen(false);
    setTimeout(() => setBusinessProfileOpen(true), 250);
  };

  const submitBusinessPassword = () => {
    if (businessPassword.trim().toLowerCase() !== "peace") {
      setBusinessPasswordError("Incorrect access phrase.");
      return;
    }
    unlockBusinessProfile();
    setBusinessPasswordOpen(false);
    setSettingsOpen(false);
    setTimeout(() => setBusinessProfileOpen(true), 250);
  };

  const handle = useMemo(
    () => displayName || (userEmail ? userEmail.split("@")[0] : "guest"),
    [displayName, userEmail]
  );

  const ownedHandles = useMemo(() => {
    const set = new Set<string>();
    if (displayName) set.add(displayName);
    if (userEmail) set.add(userEmail.split("@")[0]);
    (handleAliases || []).forEach((a) => a && set.add(a));
    return set;
  }, [displayName, userEmail, handleAliases]);

  const myPosts = useMemo(
    () => posts.filter((p) => ownedHandles.has(p.author)),
    [posts, ownedHandles]
  );

  const myStories = useMemo(
    () => stories.filter((s) => ownedHandles.has(s.author)),
    [stories, ownedHandles]
  );

  const likesReceived = useMemo(
    () => myPosts.reduce((acc, p) => acc + (p.likes || 0), 0),
    [myPosts]
  );
  const commentsReceived = useMemo(
    () => myPosts.reduce((acc, p) => acc + (p.commentsList?.length || 0), 0),
    [myPosts]
  );

  const topPost = useMemo(() => {
    if (!myPosts.length) return null;
    return myPosts.reduce((best, p) =>
      (p.likes || 0) + (p.commentsList?.length || 0) >
      (best.likes || 0) + (best.commentsList?.length || 0)
        ? p
        : best
    );
  }, [myPosts]);

  const vibeScore = useMemo(() => {
    return (
      myPosts.length * 10 +
      likesReceived * 3 +
      commentsReceived * 5 +
      myStories.length * 8
    );
  }, [myPosts.length, likesReceived, commentsReceived, myStories.length]);

  const vibeLevel = useMemo(() => {
    if (vibeScore >= 1000) return { name: "TRANSCENDED", tier: 5 };
    if (vibeScore >= 600) return { name: "ASCENDING", tier: 4 };
    if (vibeScore >= 300) return { name: "PULSING", tier: 3 };
    if (vibeScore >= 100) return { name: "AWAKENED", tier: 2 };
    if (vibeScore > 0) return { name: "BOOTING", tier: 1 };
    return { name: "OFFLINE", tier: 0 };
  }, [vibeScore]);

  const nextThreshold = useMemo(() => {
    const thresholds = [100, 300, 600, 1000];
    return thresholds.find((t) => t > vibeScore) ?? 1000;
  }, [vibeScore]);

  const progressPct = Math.min(100, Math.round((vibeScore / nextThreshold) * 100));
  const defaultPrivacyOption = getPrivacyOption(defaultPostPrivacy);

  // 7-day post streak strip
  const streak = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const days: { date: number; active: boolean; label: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const start = todayMs - i * DAY_MS;
      const end = start + DAY_MS;
      const active = myPosts.some((p) => p.timestamp >= start && p.timestamp < end);
      const d = new Date(start);
      const label = ["S", "M", "T", "W", "T", "F", "S"][d.getDay()];
      days.push({ date: start, active, label });
    }
    return days;
  }, [myPosts]);

  const streakCount = useMemo(() => {
    let count = 0;
    for (let i = streak.length - 1; i >= 0; i--) {
      if (streak[i].active) count++;
      else break;
    }
    return count;
  }, [streak]);

  const badges: Badge[] = useMemo(
    () => [
      {
        id: "first-post",
        label: "First Signal",
        icon: "flash",
        color: "#06A7A1",
        unlocked: myPosts.length >= 1,
        hint: "Post once",
      },
      {
        id: "five-posts",
        label: "Broadcaster",
        icon: "pulse",
        color: "#06A7A1",
        unlocked: myPosts.length >= 5,
        hint: "5 posts",
      },
      {
        id: "first-like",
        label: "Resonant",
        icon: "flash",
        color: "#06A7A1",
        unlocked: likesReceived >= 1,
        hint: "Get a zap",
      },
      {
        id: "ten-likes",
        label: "Magnetic",
        icon: "flame",
        color: "#FF8A00",
        unlocked: likesReceived >= 10,
        hint: "10 zaps",
      },
      {
        id: "story-master",
        label: "Story Master",
        icon: "sparkles",
        color: "#A065FF",
        unlocked: myStories.length >= 3,
        hint: "3 stories",
      },
      {
        id: "streak-3",
        label: "On Fire",
        icon: "flame",
        color: "#FF5E3A",
        unlocked: streakCount >= 3,
        hint: "3 day streak",
      },
      {
        id: "whale",
        label: "Coin Whale",
        icon: "wallet",
        color: "#FFD700",
        unlocked: rewardsBalance >= 1000,
        hint: "1k ₡",
      },
      {
        id: "ascending",
        label: "Ascending",
        icon: "star",
        color: "#06A7A1",
        unlocked: vibeScore >= 600,
        hint: "DNA 600",
      },
    ],
    [
      myPosts.length,
      likesReceived,
      myStories.length,
      rewardsBalance,
      vibeScore,
      streakCount,
    ]
  );

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  const tickerItems = [
    `@${handle}`,
    `${vibeLevel.name}`,
    `DNA ${vibeScore}`,
    `${rewardsBalance.toLocaleString()} ₡`,
    `${myPosts.length} POSTS`,
    `${likesReceived} ZAPS`,
    `STREAK ${streakCount}`,
    `${unlockedCount}/${badges.length} BADGES`,
  ];

  const statBg = isDarkMode ? "bg-dark-surface" : "bg-white";
  const statBorder = isDarkMode ? "border-gray-800" : "border-gray-200";
  const textColor = isDarkMode ? "text-dark-text" : "text-pixel-text";
  const subText = isDarkMode ? "text-gray-400" : "text-gray-500";

  return (
    <View
      className={`flex-1 ${isDarkMode ? "bg-dark-bg" : "bg-pixel-bg"}`}
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View
        className={`flex-row items-center justify-between px-4 py-3 border-b ${statBorder}`}
      >
        <Text className={`text-2xl font-bold ${textColor}`}>Profile</Text>
        <View className="flex-row items-center">
          <Ionicons name="flash" size={18} color="#06A7A1" />
          <Text className={`ml-1 text-xs font-bold ${textColor}`}>
            {vibeScore} DNA
          </Text>
        </View>
      </View>

      {/* Animated ticker */}
      <TickerHeadline items={tickerItems} isDark={isDarkMode} />

      <FlatList
        data={myPosts}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={profileRefreshing}
            onRefresh={() => {
              setProfileRefreshing(true);
              setTimeout(() => setProfileRefreshing(false), 350);
            }}
            tintColor="#06A7A1"
          />
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onLike={toggleLike}
            onComment={(id: string) => setSelectedPostId(id)}
            onDelete={deletePost}
          />
        )}
        ListHeaderComponent={
          <ScrollView scrollEnabled={false}>
            {/* Profile Card */}
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
              <View className="flex-row items-center">
                <Pressable onPress={() => setEditUsernameOpen(true)}>
                  <PulsingAvatar
                    letter={handle[0]?.toUpperCase() || "?"}
                    tier={vibeLevel.tier}
                    avatarUri={userAvatar}
                  />
                </Pressable>
                <View className="ml-3 flex-1">
                  <Pressable
                    onPress={() => setEditUsernameOpen(true)}
                    className="flex-row items-center"
                  >
                    <Text className="text-white text-2xl font-bold">
                      @{handle}
                    </Text>
                    <View
                      style={{
                        marginLeft: 8,
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: "rgba(255,255,255,0.25)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="pencil" size={12} color="#fff" />
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => setSettingsOpen(true)}
                    style={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: "rgba(0,0,0,0.22)",
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.35)",
                    }}
                    hitSlop={8}
                  >
                    <Ionicons name="settings-outline" size={17} color="#fff" />
                  </Pressable>
                  <Text className="text-white/80 text-sm mt-1">
                    {userEmail || "—"}
                  </Text>
                  <View className="flex-row items-center mt-2 flex-wrap">
                    <View className="bg-white/25 px-2.5 py-1 rounded-full flex-row items-center mr-2">
                      <Ionicons name="wallet" size={12} color="#fff" />
                      <Text className="text-white text-xs font-bold ml-1">
                        {rewardsBalance.toLocaleString()} ₡
                      </Text>
                    </View>
                    {streakCount > 0 && (
                      <View className="bg-white/25 px-2.5 py-1 rounded-full flex-row items-center">
                        <Ionicons name="flame" size={12} color="#fff" />
                        <Text className="text-white text-xs font-bold ml-1">
                          {streakCount}d streak
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Bio */}
              <Pressable
                onPress={() => setEditUsernameOpen(true)}
                style={{ marginTop: 14 }}
              >
                <Text
                  style={{
                    color: "white",
                    fontSize: 14,
                    lineHeight: 20,
                    opacity: userBio ? 1 : 0.65,
                    fontStyle: userBio ? "normal" : "italic",
                  }}
                >
                  {userBio || "Tap to add a bio…"}
                </Text>
              </Pressable>

              {/* DNA Meter */}
              <View className="mt-5">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center">
                    <Ionicons name="pulse" size={14} color="#fff" />
                    <Text className="text-white text-xs font-bold ml-1 tracking-widest">
                      {vibeLevel.name}
                    </Text>
                  </View>
                  <Text className="text-white/90 text-xs font-bold">
                    {vibeScore} DNA
                  </Text>
                </View>
                <View className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <View
                    style={{
                      width: `${progressPct}%`,
                      height: "100%",
                      backgroundColor: "#fff",
                      borderRadius: 999,
                    }}
                  />
                </View>
                <Text className="text-white/70 text-[10px] mt-1">
                  Next tier at {nextThreshold} DNA
                </Text>
              </View>
            </LinearGradient>

            {/* 7-Day Streak Strip */}
            <View className="px-4 mb-3">
              <View
                className={`rounded-2xl p-3 border ${statBg} ${statBorder}`}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center">
                    <Ionicons name="flame" size={14} color="#FF5E3A" />
                    <Text className={`ml-2 text-xs font-bold ${textColor}`}>
                      7-DAY ACTIVITY
                    </Text>
                  </View>
                  <Text className={`text-xs ${subText}`}>
                    {streak.filter((d) => d.active).length}/7 days
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  {streak.map((d, i) => (
                    <View key={i} className="items-center" style={{ width: 32 }}>
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 8,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: d.active
                            ? "#06A7A1"
                            : isDarkMode
                            ? "#2a2a2a"
                            : "#f3f4f6",
                          borderWidth: 1,
                          borderColor: d.active
                            ? "#06A7A1"
                            : isDarkMode
                            ? "#333"
                            : "#e5e7eb",
                        }}
                      >
                        {d.active && (
                          <Ionicons name="flash" size={12} color="#fff" />
                        )}
                      </View>
                      <Text className={`text-[10px] mt-1 ${subText}`}>
                        {d.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Stats Grid */}
            <View className="flex-row flex-wrap px-4 -mx-1">
              {[
                { label: "Posts", value: myPosts.length, icon: "chatbubbles-outline" },
                { label: "Zaps", value: likesReceived, icon: "flash" },
                { label: "Comments", value: commentsReceived, icon: "chatbubble-outline" },
                { label: "Stories", value: myStories.length, icon: "sparkles" },
              ].map((s) => (
                <View key={s.label} className="w-1/2 px-1 mb-2">
                  <View
                    className={`rounded-2xl p-3 border ${statBg} ${statBorder}`}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className={`text-xs ${subText}`}>{s.label}</Text>
                      <Ionicons name={s.icon} size={14} color="#06A7A1" />
                    </View>
                    <Text className={`text-2xl font-bold mt-1 ${textColor}`}>
                      {s.value}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Completed Missions */}
            <View className="px-4 mt-2">
              <Pressable
                onPress={() => setCompletedMissionsOpen(true)}
                className={`rounded-2xl border p-4 ${statBg} ${statBorder}`}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.82 : 1,
                  shadowColor: "#000",
                  shadowOpacity: isDarkMode ? 0.18 : 0.08,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 2,
                })}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 16,
                        backgroundColor: isDarkMode ? "rgba(6,167,161,0.16)" : "#E8FFFC",
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: "rgba(6,167,161,0.35)",
                      }}
                    >
                      <Ionicons name="shield-check" size={20} color="#06A7A1" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className={`font-bold ${textColor}`}>
                        Completed Missions
                      </Text>
                      <Text className={`text-xs mt-1 ${subText}`}>
                        Public proof of community service tasks.
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center">
                    <Text className={`text-lg font-bold ${textColor}`}>0</Text>
                    <Ionicons name="chevron-forward" size={18} color="#06A7A1" />
                  </View>
                </View>
                <View
                  style={{
                    marginTop: 14,
                    borderRadius: 16,
                    paddingVertical: 11,
                    paddingHorizontal: 14,
                    backgroundColor: "#06A7A1",
                    borderWidth: 2,
                    borderColor: isDarkMode ? "#39D8D0" : "#057D78",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="shield-check" size={17} color={isDarkMode ? "#FFFFFF" : "#10252B"} />
                  <Text style={{ color: isDarkMode ? "#FFFFFF" : "#10252B", fontWeight: "900", marginLeft: 8 }}>
                    View Completed Missions
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* Private Research Network */}
            <View className="px-4 mt-2">
              <Pressable
                onPress={() => setNetworkOpen(true)}
                className={`rounded-2xl border p-4 ${statBg} ${statBorder}`}
                style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 16,
                        backgroundColor: isDarkMode ? "rgba(6,167,161,0.16)" : "#E8FFFC",
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: "rgba(6,167,161,0.35)",
                      }}
                    >
                      <Ionicons name="people-outline" size={20} color="#06A7A1" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className={`font-bold ${textColor}`}>
                        Research Network
                      </Text>
                      <Text className={`text-xs mt-1 ${subText}`}>
                        Private friend list only you can open.
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center">
                    <Text className={`text-lg font-bold ${textColor}`}>
                      {(friends || []).length}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color="#06A7A1" />
                  </View>
                </View>
              </Pressable>
            </View>

            {/* Top Hit */}
            {topPost && (
              <View className="px-4 mt-2">
                <View
                  className={`rounded-2xl border p-4 ${statBg} ${statBorder}`}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center">
                      <Ionicons name="star" size={14} color="#FFD700" />
                      <Text className={`ml-2 font-bold ${textColor}`}>
                        Top Transmission
                      </Text>
                    </View>
                    <Text className={`text-[10px] ${subText}`}>
                      {formatRelativeTime(topPost.timestamp)}
                    </Text>
                  </View>
                  <Text
                    className={`text-sm ${textColor}`}
                    numberOfLines={3}
                  >
                    {topPost.content || "(media post)"}
                  </Text>
                  <View className="flex-row mt-2 gap-3">
                    <View className="flex-row items-center">
                      <Ionicons name="flash" size={12} color="#06A7A1" />
                      <Text className={`text-xs ml-1 ${subText}`}>
                        {topPost.likes}
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Ionicons name="chatbubble-outline" size={12} color="#06A7A1" />
                      <Text className={`text-xs ml-1 ${subText}`}>
                        {topPost.commentsList?.length || 0}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Badges */}
            <View className="px-4 mt-4">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center">
                  <Ionicons name="trophy" size={16} color="#FFD700" />
                  <Text className={`ml-2 font-bold ${textColor}`}>
                    Achievements
                  </Text>
                </View>
                <Text className={`text-xs ${subText}`}>
                  {unlockedCount}/{badges.length}
                </Text>
              </View>

              <View className="flex-row flex-wrap -mx-1">
                {badges.map((b) => (
                  <View key={b.id} className="w-1/4 px-1 mb-2">
                    <View
                      className={`rounded-2xl p-2 items-center border ${statBg} ${statBorder}`}
                      style={{ opacity: b.unlocked ? 1 : 0.4 }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: b.unlocked ? `${b.color}22` : "#88888822",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons
                          name={b.unlocked ? b.icon : "lock-closed"}
                          size={20}
                          color={b.unlocked ? b.color : "#888"}
                        />
                      </View>
                      <Text
                        className={`text-[10px] mt-1 text-center font-bold ${textColor}`}
                        numberOfLines={1}
                      >
                        {b.label}
                      </Text>
                      <Text
                        className={`text-[9px] ${subText} text-center`}
                        numberOfLines={1}
                      >
                        {b.hint}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* My Posts header */}
            <View
              className={`mt-4 px-4 py-2 border-t border-b ${statBorder} ${
                isDarkMode ? "bg-dark-surface/50" : "bg-pixel-bg/60"
              }`}
            >
              <View className="flex-row items-center">
                <Ionicons name="eye" size={14} color="#06A7A1" />
                <Text className={`ml-2 text-xs font-bold tracking-widest ${subText}`}>
                  YOUR TRANSMISSIONS · {myPosts.length}
                </Text>
              </View>
            </View>
          </ScrollView>
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-16 px-6">
            <Ionicons
              name="chatbubbles-outline"
              size={56}
              color={isDarkMode ? "#444" : "#ccc"}
            />
            <Text className={`text-base mt-3 ${subText}`}>
              No posts yet
            </Text>
            <Text className={`text-xs mt-1 ${subText} text-center`}>
              Head to the Feed and broadcast your first signal.
            </Text>
          </View>
        }
      />

      <CommentsModal
        visible={selectedPostId !== null}
        postId={selectedPostId}
        onClose={() => setSelectedPostId(null)}
      />

      <EditUsernameModal
        visible={editUsernameOpen}
        currentHandle={handle}
        onClose={() => setEditUsernameOpen(false)}
      />

      <Modal
        visible={settingsOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <View className={`flex-1 ${isDarkMode ? "bg-dark-bg" : "bg-pixel-bg"}`}>
          <View
            className={`flex-row items-center justify-between px-4 py-4 border-b ${statBorder}`}
            style={{ paddingTop: insets.top + 10 }}
          >
            <Pressable onPress={() => setSettingsOpen(false)} hitSlop={10}>
              <Ionicons name="close" size={26} color={isDarkMode ? "#CFEFEC" : "#1F2937"} />
            </Pressable>
            <Text className={`font-bold text-lg ${textColor}`}>Settings</Text>
            <View style={{ width: 26 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
            <Pressable
              onPress={openBusinessProfile}
              style={{
                borderRadius: 20,
                borderWidth: 1,
                borderColor: "rgba(6,167,161,0.35)",
                backgroundColor: isDarkMode ? "rgba(6,167,161,0.12)" : "#E8FFFC",
                padding: 16,
                marginBottom: 12,
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 16,
                      backgroundColor: "#06A7A1",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <Ionicons name="business-outline" size={22} color="#FFFFFF" />
                  </View>
                  <View className="flex-1">
                    <Text className={`font-bold ${textColor}`}>Business Profile</Text>
                    <Text className={`text-xs mt-1 ${subText}`}>
                      Create missions, scan QR check-ins, and view live signups.
                    </Text>
                  </View>
                </View>
                <Ionicons name="log-out-outline" size={22} color="#06A7A1" />
              </View>
            </Pressable>

            <View className={`rounded-2xl border p-4 ${statBg} ${statBorder}`}>
              <View className="flex-row items-center justify-between mb-3">
                <View>
                  <Text className={`font-bold ${textColor}`}>Default post privacy</Text>
                  <Text className={`text-xs mt-1 ${subText}`}>
                    New posts and stories start as {defaultPrivacyOption.label}.
                  </Text>
                </View>
                <Ionicons name={defaultPrivacyOption.icon} size={22} color="#06A7A1" />
              </View>
              {POST_PRIVACY_OPTIONS.map((option) => {
                const active = defaultPostPrivacy === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setDefaultPostPrivacy(option.value)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 12,
                      borderTopWidth: 1,
                      borderTopColor: isDarkMode ? "#26313b" : "#E5E7EB",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name={option.icon} size={18} color={active ? "#06A7A1" : isDarkMode ? "#9CA3AF" : "#6B7280"} />
                      <Text className={`ml-3 font-bold ${textColor}`}>{option.label}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={18} color="#06A7A1" />}
                  </Pressable>
                );
              })}
            </View>

            <View className={`rounded-2xl border p-4 mt-3 ${statBg} ${statBorder}`}>
              <Text className={`font-bold ${textColor}`}>Useful defaults</Text>
              <Text className={`text-xs mt-2 ${subText}`}>
                Public remains the app default. Friend lists are private. Comment privacy can still be changed per thread.
              </Text>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={networkOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setNetworkOpen(false)}
      >
        <View className={`flex-1 ${isDarkMode ? "bg-dark-bg" : "bg-pixel-bg"}`}>
          <View
            className={`flex-row items-center justify-between px-4 py-4 border-b ${statBorder}`}
            style={{ paddingTop: insets.top + 10 }}
          >
            <Pressable onPress={() => setNetworkOpen(false)} hitSlop={10}>
              <Ionicons name="close" size={26} color={isDarkMode ? "#CFEFEC" : "#1F2937"} />
            </Pressable>
            <Text className={`font-bold text-lg ${textColor}`}>Research Network</Text>
            <View style={{ width: 26 }} />
          </View>

          <FlatList
            data={friends || []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16 }}
            ListHeaderComponent={(
              <View className={`rounded-2xl border p-4 mb-4 ${statBg} ${statBorder}`}>
                <Text className={`font-black text-base mb-3 ${textColor}`}>Add Research Contact</Text>
                <TextInput
                  value={networkHandleDraft}
                  onChangeText={setNetworkHandleDraft}
                  placeholder="Search or enter @handle"
                  placeholderTextColor={isDarkMode ? "#6B7280" : "#9CA3AF"}
                  autoCapitalize="none"
                  style={{
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: "rgba(6,167,161,0.35)",
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: isDarkMode ? "#CFEFEC" : "#1F2937",
                    fontWeight: "800",
                    marginBottom: 10,
                  }}
                />
                <TextInput
                  value={networkTagDraft}
                  onChangeText={setNetworkTagDraft}
                  placeholder="Custom call tag, e.g. Cleanup Lead"
                  placeholderTextColor={isDarkMode ? "#6B7280" : "#9CA3AF"}
                  style={{
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: "rgba(6,167,161,0.35)",
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: isDarkMode ? "#CFEFEC" : "#1F2937",
                    fontWeight: "800",
                    marginBottom: 12,
                  }}
                />
                <Pressable
                  onPress={() => {
                    const handle = networkHandleDraft.trim().replace(/^@+/, "");
                    if (!handle) return;
                    addFriend({
                      id: `lab-${handle.toLowerCase()}`,
                      handle,
                      title: networkTagDraft.trim() || "Research Contact",
                    });
                    setNetworkHandleDraft("");
                    setNetworkTagDraft("");
                  }}
                  style={{
                    borderRadius: 18,
                    backgroundColor: "#06A7A1",
                    paddingVertical: 13,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <Ionicons name="person-add-outline" size={18} color={isDarkMode ? "#FFFFFF" : "#10252B"} />
                  <Text style={{ color: isDarkMode ? "#FFFFFF" : "#10252B", fontWeight: "900" }}>Add to Network</Text>
                </Pressable>
              </View>
            )}
            ListEmptyComponent={(
              <Text className={`text-sm text-center mt-4 ${subText}`}>
                Your private research network is empty. Add a handle and custom call tag to start.
              </Text>
            )}
            renderItem={({ item }) => (
              <View className={`rounded-2xl border p-4 mb-3 ${statBg} ${statBorder}`}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        backgroundColor: "#06A7A1",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "900" }}>
                        {item.handle[0]?.toUpperCase() || "N"}
                      </Text>
                    </View>
                    <View className="ml-3">
                      <Text className={`font-bold ${textColor}`}>@{item.handle}</Text>
                      <Text className={`text-xs mt-1 ${subText}`}>{item.title}</Text>
                    </View>
                  </View>
                  <Pressable onPress={() => removeFriend(item.id)} hitSlop={10}>
                    <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                  </Pressable>
                </View>
              </View>
            )}
          />
        </View>
      </Modal>

      <BusinessProfileModal
        visible={businessProfileOpen}
        onClose={() => setBusinessProfileOpen(false)}
      />

      <Modal
        visible={businessPasswordOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setBusinessPasswordOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.72)",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              width: "100%",
              borderRadius: 24,
              borderWidth: 1,
              borderColor: "rgba(6,167,161,0.45)",
              backgroundColor: isDarkMode ? "#081920" : "#FFFFFF",
              padding: 18,
            }}
          >
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 16,
                    backgroundColor: "rgba(6,167,161,0.18)",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 10,
                  }}
                >
                  <Ionicons name="lock-closed-outline" size={22} color="#06A7A1" />
                </View>
                <View>
                  <Text className={`font-bold text-lg ${textColor}`}>Business Access</Text>
                  <Text className={`text-xs ${subText}`}>Enter the partner phrase once.</Text>
                </View>
              </View>
              <Pressable onPress={() => setBusinessPasswordOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color={isDarkMode ? "#CFEFEC" : "#1F2937"} />
              </Pressable>
            </View>

            <TextInput
              value={businessPassword}
              onChangeText={(value) => {
                setBusinessPassword(value);
                if (businessPasswordError) setBusinessPasswordError(null);
              }}
              placeholder="Access phrase"
              placeholderTextColor="#6B7280"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={submitBusinessPassword}
              style={{
                borderRadius: 18,
                borderWidth: 1,
                borderColor: businessPasswordError ? "#FF3B30" : "rgba(6,167,161,0.45)",
                backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "#F3F4F6",
                color: isDarkMode ? "#CFEFEC" : "#111827",
                fontWeight: "800",
                paddingHorizontal: 14,
                paddingVertical: 12,
                marginTop: 8,
              }}
            />
            {businessPasswordError ? (
              <Text style={{ color: "#FF3B30", fontSize: 12, fontWeight: "800", marginTop: 8 }}>
                {businessPasswordError}
              </Text>
            ) : null}

            <Pressable
              onPress={submitBusinessPassword}
              style={({ pressed }) => ({
                marginTop: 14,
                borderRadius: 18,
                minHeight: 52,
                paddingVertical: 13,
                paddingHorizontal: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#06A7A1",
                borderWidth: 2,
                borderColor: isDarkMode ? "#39D8D0" : "#057D78",
                shadowColor: "#06A7A1",
                shadowOpacity: isDarkMode ? 0.16 : 0.22,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 3,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="business-outline" size={18} color={isDarkMode ? "#FFFFFF" : "#10252B"} />
                <Text style={{ color: isDarkMode ? "#FFFFFF" : "#10252B", fontWeight: "900", marginLeft: 8 }}>Unlock Business Profile</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={completedMissionsOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCompletedMissionsOpen(false)}
      >
        <View className={`flex-1 ${isDarkMode ? "bg-dark-bg" : "bg-pixel-bg"}`}>
          <View
            className={`flex-row items-center justify-between px-4 py-4 border-b ${statBorder}`}
            style={{ paddingTop: insets.top + 10 }}
          >
            <Pressable onPress={() => setCompletedMissionsOpen(false)} hitSlop={10}>
              <Ionicons name="close" size={26} color={isDarkMode ? "#CFEFEC" : "#1F2937"} />
            </Pressable>
            <Text className={`font-bold text-lg ${textColor}`}>
              Completed Missions
            </Text>
            <View style={{ width: 26 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 30 }}>
            <LinearGradient
              colors={isDarkMode ? ["#062B31", "#081920"] : ["#FFFFFF", "#E8FFFC"]}
              style={{
                borderRadius: 24,
                padding: 18,
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
                <Text className={`text-lg font-black text-center ${textColor}`}>
                  No Completed Missions Yet
                </Text>
                <Text className={`text-sm leading-5 mt-2 text-center ${subText}`}>
                  Completed service tasks will appear here after a real mission check-in is recorded.
                </Text>
                <Pressable
                  onPress={() => setCompletedMissionsOpen(false)}
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
                  <Ionicons name="arrow-back-outline" size={17} color={isDarkMode ? "#FFFFFF" : "#10252B"} />
                  <Text style={{ color: isDarkMode ? "#FFFFFF" : "#10252B", fontWeight: "900", marginLeft: 8 }}>
                    Back to Profile
                  </Text>
                </Pressable>
              </View>
            </LinearGradient>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

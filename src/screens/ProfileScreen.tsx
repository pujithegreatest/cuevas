import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList,
  Image as RNImage,
  Modal,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Linking,
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
import UserProfileModal from "../components/UserProfileModal";
import EditUsernameModal from "../components/EditUsernameModal";
import BusinessProfileModal from "../components/BusinessProfileModal";
import { LinearGradient } from "expo-linear-gradient";
import { formatRelativeTime } from "../utils/linkPreview";
import { POST_PRIVACY_OPTIONS, getPrivacyOption } from "../utils/privacy";
import { deriveHandle, displayUsername, emailLocalPart, normalizeHandle } from "../utils/handles";
import { deleteCuevasAccount } from "../api/ecothot-auth";

type Props = BottomTabScreenProps<MainTabParamList, "Profile">;

type Badge = {
  id: string;
  label: string;
  icon: string;
  color: string;
  unlocked: boolean;
  hint: string;
};

type ResearchSuggestion = {
  handle: string;
  name: string;
  avatar?: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const LEGAL_SAFETY_LINKS = [
  {
    label: "Terms of Use",
    detail: "Zero-tolerance community rules and EULA terms.",
    url: "https://www.ecothot.com/cuevas-terms-of-use",
    icon: "shield-checkmark-outline",
  },
  {
    label: "Privacy Policy",
    detail: "Data collection, account deletion, and retention details.",
    url: "https://www.ecothot.com/cuevas-privacy",
    icon: "lock-closed-outline",
  },
  {
    label: "Child Safety Standards",
    detail: "CSAE, CSAM, report handling, and child safety contact.",
    url: "https://www.ecothot.com/child-safety",
    icon: "warning-outline",
  },
  {
    label: "Account Deletion",
    detail: "Permanent in-app account deletion information.",
    url: "https://www.ecothot.com/cuevas-delete-account",
    icon: "trash-outline",
  },
];

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
  const userHandle = useAppStore((s) => s.userHandle);
  const handleAliases = useAppStore((s) => s.handleAliases);
  const rewardsBalance = useAppStore((s) => s.rewardsBalance);
  const userAvatar = useAppStore((s) => s.userAvatar);
  const userBio = useAppStore((s) => s.userBio);
  const defaultPostPrivacy = useAppStore((s) => s.defaultPostPrivacy);
  const setDefaultPostPrivacy = useAppStore((s) => s.setDefaultPostPrivacy);
  const friends = useAppStore((s) => s.friends);
  const addFriend = useAppStore((s) => s.addFriend);
  const removeFriend = useAppStore((s) => s.removeFriend);
  const updateFriendTitle = useAppStore((s) => s.updateFriendTitle);
  const blockedHandles = useAppStore((s) => s.blockedHandles);
  const businessProfileUnlocked = useAppStore((s) => s.businessProfileUnlocked);
  const unlockBusinessProfile = useAppStore((s) => s.unlockBusinessProfile);
  const logout = useAppStore((s) => s.logout);

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
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [editingFriendId, setEditingFriendId] = useState<string | null>(null);
  const [editingFriendTag, setEditingFriendTag] = useState("");
  const [selectedNetworkProfileHandle, setSelectedNetworkProfileHandle] = useState<string | null>(null);
  const [profileRefreshing, setProfileRefreshing] = useState(false);
  const [accountDeleting, setAccountDeleting] = useState(false);

  const openLegalSafetyLink = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert("Could not open link", "Please try again in a moment.");
    });
  };

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

  const confirmDeleteAccount = () => {
    if (accountDeleting) return;
    if (!userEmail) {
      Alert.alert("Delete account", "You must be signed in to delete this account.");
      return;
    }

    Alert.alert(
      "Delete account",
      "This will permanently delete your Cuevas account and remove your Cuevas profile data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: async () => {
            setAccountDeleting(true);
            const result = await deleteCuevasAccount(userEmail);
            setAccountDeleting(false);

            if (!result.success) {
              Alert.alert("Could not delete account", result.error || "Please try again.");
              return;
            }

            setSettingsOpen(false);
            logout();
            Alert.alert("Account deleted", "Your Cuevas account has been deleted.");
          },
        },
      ]
    );
  };

  const confirmLogout = () => {
    Alert.alert("Log out", "Log out of your Cuevas account on this device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: () => {
          setSettingsOpen(false);
          logout();
        },
      },
    ]);
  };

  const username = useMemo(
    () => displayUsername(displayName, userEmail),
    [displayName, userEmail]
  );

  const handle = useMemo(
    () => deriveHandle(userHandle, displayName, userEmail),
    [userHandle, displayName, userEmail]
  );

  const ownedHandles = useMemo(() => {
    const set = new Set<string>();
    set.add(username);
    set.add(normalizeHandle(username, ""));
    set.add(handle);
    set.add(normalizeHandle(handle, ""));
    if (displayName) set.add(displayName);
    if (displayName) set.add(normalizeHandle(displayName, ""));
    if (userEmail) {
      set.add(userEmail);
      set.add(userEmail.toLowerCase());
      set.add(emailLocalPart(userEmail));
      set.add(normalizeHandle(emailLocalPart(userEmail)));
    }
    (handleAliases || []).forEach((a) => {
      if (!a) return;
      set.add(a);
      set.add(normalizeHandle(a, ""));
    });
    return set;
  }, [username, handle, displayName, userEmail, handleAliases]);

  const knownResearchUsers = useMemo<ResearchSuggestion[]>(() => {
    const map = new Map<string, ResearchSuggestion>();
    const blocked = new Set((blockedHandles || []).map((item) => normalizeHandle(item, "")));
    const addKnown = (rawHandle?: string | null, avatar?: string | null) => {
      const raw = String(rawHandle || "").trim();
      const normalized = normalizeHandle(raw, "");
      if (!normalized || blocked.has(normalized)) return;
      if (ownedHandles.has(raw) || ownedHandles.has(normalized)) return;
      if (!map.has(normalized)) {
        map.set(normalized, {
          handle: normalized,
          name: displayUsername(raw, null, normalized),
          avatar,
        });
      }
    };

    posts.forEach((post) => addKnown(post.author, post.authorAvatar || null));
    stories.forEach((story) => addKnown(story.author, null));
    (friends || []).forEach((friend) => addKnown(friend.handle, null));

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [posts, stories, friends, ownedHandles, blockedHandles]);

  const normalizedNetworkDraft = normalizeHandle(networkHandleDraft, "");
  const networkSuggestions = useMemo(() => {
    const query = normalizedNetworkDraft;
    if (!query) return [];
    return knownResearchUsers
      .filter((user) => {
        return (
          user.handle.includes(query) ||
          user.name.toLowerCase().includes(query)
        );
      })
      .slice(0, 6);
  }, [knownResearchUsers, normalizedNetworkDraft]);

  const selectedNetworkUser = useMemo(
    () => knownResearchUsers.find((user) => user.handle === normalizedNetworkDraft) || null,
    [knownResearchUsers, normalizedNetworkDraft]
  );

  const openNetworkProfile = (rawHandle: string) => {
    const clean = normalizeHandle(rawHandle, "");
    if (!clean) return;
    setNetworkOpen(false);
    setEditingFriendId(null);
    setEditingFriendTag("");
    setTimeout(() => setSelectedNetworkProfileHandle(clean), 240);
  };

  const friendHandleSet = useMemo(
    () => new Set((friends || []).map((friend) => normalizeHandle(friend.handle, ""))),
    [friends]
  );

  const myPosts = useMemo(
    () =>
      posts.filter((p) => {
        if (p.authorEmail && userEmail && p.authorEmail.toLowerCase() === userEmail.toLowerCase()) return true;
        return ownedHandles.has(p.author) || ownedHandles.has(normalizeHandle(p.author, ""));
      }),
    [posts, ownedHandles, userEmail]
  );

  const myStories = useMemo(
    () =>
      stories.filter((s) => ownedHandles.has(s.author) || ownedHandles.has(normalizeHandle(s.author, ""))),
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
    username,
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
                    letter={username[0]?.toUpperCase() || "?"}
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
                      {username}
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
                    @{handle}
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
        currentUsername={username}
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
                <Ionicons name="chevron-forward" size={20} color="#06A7A1" />
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

            <View className={`rounded-2xl border p-4 mt-3 ${statBg} ${statBorder}`}>
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-1">
                  <Text className={`font-bold ${textColor}`}>Legal & Safety</Text>
                  <Text className={`text-xs mt-1 ${subText}`}>
                    Cuevas filters objectionable material from being posted and reviews reports to keep the community safe.
                  </Text>
                </View>
                <Ionicons name="shield-checkmark-outline" size={22} color="#06A7A1" />
              </View>
              {LEGAL_SAFETY_LINKS.map((item) => (
                <Pressable
                  key={item.url}
                  onPress={() => openLegalSafetyLink(item.url)}
                  accessibilityRole="link"
                  accessibilityLabel={`Open ${item.label}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 11,
                    borderTopWidth: 1,
                    borderTopColor: isDarkMode ? "#26313b" : "#E5E7EB",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 }}>
                    <Ionicons name={item.icon} size={18} color="#06A7A1" />
                    <View style={{ marginLeft: 12, flex: 1, minWidth: 0 }}>
                      <Text className={`font-bold ${textColor}`} numberOfLines={1}>
                        {item.label}
                      </Text>
                      <Text className={`text-xs mt-1 ${subText}`} numberOfLines={2}>
                        {item.detail}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#06A7A1" style={{ marginLeft: 10 }} />
                </Pressable>
              ))}
              <View
                style={{
                  paddingTop: 11,
                  borderTopWidth: 1,
                  borderTopColor: isDarkMode ? "#26313b" : "#E5E7EB",
                }}
              >
                <Text className={`font-bold ${textColor}`}>Support contact</Text>
                <Text className={`text-xs mt-1 ${subText}`}>notifications@ecothot.com</Text>
              </View>
            </View>

            <Pressable
              onPress={confirmDeleteAccount}
              disabled={accountDeleting}
              accessibilityRole="button"
              accessibilityLabel="Delete Cuevas account"
              style={{
                borderRadius: 20,
                borderWidth: 1,
                borderColor: isDarkMode ? "rgba(248,113,113,0.5)" : "rgba(185,28,28,0.28)",
                backgroundColor: isDarkMode ? "rgba(127,29,29,0.18)" : "#FEF2F2",
                padding: 16,
                marginTop: 24,
                opacity: accountDeleting ? 0.72 : 1,
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 16,
                      backgroundColor: isDarkMode ? "rgba(248,113,113,0.16)" : "#FEE2E2",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <Ionicons name="trash-outline" size={22} color="#EF4444" />
                  </View>
                  <View className="flex-1">
                    <Text className={`font-bold ${textColor}`}>Delete Account</Text>
                    <Text className={`text-xs mt-1 ${subText}`}>
                      Permanently delete your Cuevas account in the app.
                    </Text>
                  </View>
                </View>
                {accountDeleting ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <Ionicons name="chevron-forward" size={20} color="#EF4444" />
                )}
              </View>
            </Pressable>

            <Pressable
              onPress={confirmLogout}
              accessibilityRole="button"
              accessibilityLabel="Log out of Cuevas"
              style={{
                width: "100%",
                alignSelf: "stretch",
                borderRadius: 20,
                borderWidth: 1,
                borderColor: isDarkMode ? "rgba(6,167,161,0.62)" : "rgba(6,167,161,0.38)",
                backgroundColor: isDarkMode ? "rgba(6,167,161,0.18)" : "#E8FFFC",
                padding: 16,
                marginTop: 16,
                minHeight: 84,
                justifyContent: "center",
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1" style={{ minWidth: 0 }}>
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
                    <Ionicons name="log-out-outline" size={22} color="#FFFFFF" />
                  </View>
                  <View className="flex-1" style={{ minWidth: 0 }}>
                    <Text className={`font-bold ${textColor}`} numberOfLines={1}>
                      Log Out
                    </Text>
                    <Text className={`text-xs mt-1 ${subText}`} numberOfLines={2}>
                      Sign out of this account and return to the login screen.
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#06A7A1" style={{ marginLeft: 12 }} />
              </View>
            </Pressable>
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
            extraData={{ editingFriendId, editingFriendTag }}
            contentContainerStyle={{ padding: 16 }}
            ListHeaderComponent={(
              <View className={`rounded-2xl border p-4 mb-4 ${statBg} ${statBorder}`}>
                <Text className={`font-black text-base mb-3 ${textColor}`}>Add Research Contact</Text>
                <TextInput
                  value={networkHandleDraft}
                  onChangeText={(value) => {
                    setNetworkHandleDraft(value);
                    setNetworkError(null);
                  }}
                  placeholder="Search existing users"
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
                {networkSuggestions.length > 0 ? (
                  <View style={{ marginBottom: 10 }}>
                    {networkSuggestions.map((user) => {
                      const alreadyAdded = friendHandleSet.has(user.handle);
                      return (
                        <Pressable
                          key={user.handle}
                          onPress={() => {
                            setNetworkHandleDraft(`@${user.handle}`);
                            setNetworkError(null);
                          }}
                          style={({ pressed }) => ({
                            minHeight: 70,
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 12,
                            paddingHorizontal: 14,
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: "rgba(6,167,161,0.22)",
                            backgroundColor: pressed
                              ? "rgba(6,167,161,0.20)"
                              : isDarkMode
                              ? "#111827"
                              : "#EEF7F6",
                            marginBottom: 10,
                          })}
                        >
                          <View
                            style={{
                              width: 46,
                              height: 46,
                              borderRadius: 23,
                              backgroundColor: "#06A7A1",
                              alignItems: "center",
                              justifyContent: "center",
                              overflow: "hidden",
                            }}
                          >
                            {user.avatar ? (
                              <RNImage source={{ uri: user.avatar }} style={{ width: 46, height: 46 }} />
                            ) : (
                              <Text style={{ color: "#FFFFFF", fontWeight: "900", fontSize: 17 }}>
                                {(user.name[0] || user.handle[0] || "U").toUpperCase()}
                              </Text>
                            )}
                          </View>
                          <View style={{ marginLeft: 12, flex: 1, justifyContent: "center", minWidth: 0 }}>
                            <Text
                              numberOfLines={1}
                              style={{
                                color: isDarkMode ? "#CFEFEC" : "#1F2937",
                                fontWeight: "900",
                                fontSize: 16,
                                lineHeight: 20,
                              }}
                            >
                              {user.name}
                            </Text>
                            <Text
                              numberOfLines={1}
                              style={{
                                color: isDarkMode ? "#9CA3AF" : "#6B7280",
                                fontSize: 13,
                                fontWeight: "700",
                                lineHeight: 17,
                              }}
                            >
                              @{user.handle}
                            </Text>
                          </View>
                          {alreadyAdded && (
                            <Text style={{ color: "#06A7A1", fontSize: 11, fontWeight: "900", marginLeft: 10 }}>
                              ADDED
                            </Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  normalizedNetworkDraft.length > 0 && (
                    <Text style={{ color: "#FF6B6B", fontSize: 12, fontWeight: "800", marginBottom: 10 }}>
                      No existing Cuevas user found. Pick a user that appears in the app.
                    </Text>
                  )
                )}
                {networkError && (
                  <Text style={{ color: "#FF6B6B", fontSize: 12, fontWeight: "800", marginBottom: 10 }}>
                    {networkError}
                  </Text>
                )}
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
                    if (!selectedNetworkUser) {
                      setNetworkError("Select an existing Cuevas user from the suggestions.");
                      return;
                    }
                    addFriend({
                      id: `lab-${selectedNetworkUser.handle}`,
                      handle: selectedNetworkUser.handle,
                      title: networkTagDraft.trim() || selectedNetworkUser.name || "Research Contact",
                    });
                    setNetworkHandleDraft("");
                    setNetworkTagDraft("");
                    setNetworkError(null);
                  }}
                  style={{
                    borderRadius: 18,
                    backgroundColor: "#06A7A1",
                    paddingVertical: 13,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name="person-add-outline"
                    size={18}
                    color={isDarkMode ? "#FFFFFF" : "#10252B"}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={{ color: isDarkMode ? "#FFFFFF" : "#10252B", fontWeight: "900" }}>Add to Network</Text>
                </Pressable>
              </View>
            )}
            ListEmptyComponent={(
              <Text className={`text-sm text-center mt-4 ${subText}`}>
                Your private research network is empty. Add a handle and custom call tag to start.
              </Text>
            )}
            renderItem={({ item }) => {
              const isEditing = editingFriendId === item.id;
              const cleanFriendHandle = normalizeHandle(item.handle, "");
              return (
                <Pressable
                  onPress={() => openNetworkProfile(cleanFriendHandle)}
                  className={`rounded-2xl border p-4 mb-3 ${statBg} ${statBorder}`}
                  style={({ pressed }) => ({ opacity: pressed ? 0.84 : 1 })}
                >
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
                          {(cleanFriendHandle[0] || "N").toUpperCase()}
                        </Text>
                      </View>
                      <View className="ml-3 flex-1">
                        <Text className={`font-bold ${textColor}`}>@{cleanFriendHandle}</Text>
                        {isEditing ? (
                          <TextInput
                            value={editingFriendTag}
                            onChangeText={setEditingFriendTag}
                            placeholder="Custom call tag"
                            placeholderTextColor={isDarkMode ? "#6B7280" : "#9CA3AF"}
                            style={{
                              marginTop: 8,
                              borderRadius: 12,
                              borderWidth: 1,
                              borderColor: "rgba(6,167,161,0.35)",
                              paddingHorizontal: 10,
                              paddingVertical: 8,
                              color: isDarkMode ? "#CFEFEC" : "#1F2937",
                              fontWeight: "800",
                            }}
                          />
                        ) : (
                          <Text className={`text-xs mt-1 ${subText}`}>{item.title}</Text>
                        )}
                      </View>
                    </View>
                    {isEditing ? (
                      <View className="flex-row items-center ml-3">
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation?.();
                            updateFriendTitle(item.id, editingFriendTag);
                            setEditingFriendId(null);
                            setEditingFriendTag("");
                          }}
                          hitSlop={10}
                          style={{ marginRight: 12 }}
                        >
                          <Ionicons name="checkmark-circle-outline" size={20} color="#06A7A1" />
                        </Pressable>
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation?.();
                            setEditingFriendId(null);
                            setEditingFriendTag("");
                          }}
                          hitSlop={10}
                        >
                          <Ionicons name="close-circle-outline" size={20} color={isDarkMode ? "#9CA3AF" : "#6B7280"} />
                        </Pressable>
                      </View>
                    ) : (
                      <View className="flex-row items-center ml-3">
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation?.();
                            setEditingFriendId(item.id);
                            setEditingFriendTag(item.title || "");
                          }}
                          hitSlop={10}
                          style={{ marginRight: 14 }}
                        >
                          <Ionicons name="pencil" size={18} color="#06A7A1" />
                        </Pressable>
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation?.();
                            removeFriend(item.id);
                          }}
                          hitSlop={10}
                        >
                          <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                        </Pressable>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>

      <UserProfileModal
        visible={selectedNetworkProfileHandle !== null}
        handle={selectedNetworkProfileHandle}
        onClose={() => setSelectedNetworkProfileHandle(null)}
        onComment={(postId) => {
          setSelectedNetworkProfileHandle(null);
          setSelectedPostId(postId);
        }}
        onAvatarPress={(h) => setSelectedNetworkProfileHandle(h)}
      />

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
                    marginTop: 24,
                    marginLeft: -14,
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
                  })}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons
                      name="arrow-back-outline"
                      size={17}
                      color={isDarkMode ? "#FFFFFF" : "#10252B"}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      numberOfLines={1}
                      style={{ color: isDarkMode ? "#FFFFFF" : "#10252B", fontWeight: "900" }}
                    >
                      Back to Profile
                    </Text>
                  </View>
                </Pressable>
              </View>
            </LinearGradient>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

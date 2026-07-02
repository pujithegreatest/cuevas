import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PrivacyLevel } from "../types/feed";
import { normalizeHandle } from "../utils/handles";

export interface FriendNode {
  id: string;
  handle: string;
  title: string;
}

export type ModerationContentType = "post" | "story" | "profile";

export interface ModerationReport {
  id: string;
  targetHandle: string;
  contentType: ModerationContentType;
  contentId?: string;
  reason: string;
  createdAt: number;
}

interface AppState {
  isAuthenticated: boolean;
  userEmail: string | null;
  displayName: string | null;
  userHandle: string | null;
  handleAliases: string[];
  userAvatar: string | null;
  userBio: string | null;
  isBusinessAccount: boolean;
  businessName: string | null;
  businessProfileUnlocked: boolean;

  rewardsBalance: number;
  defaultPostPrivacy: PrivacyLevel;
  friends: FriendNode[];
  blockedHandles: string[];
  reportedItems: ModerationReport[];

  isDarkMode: boolean;
  hasThemeOverride: boolean;

  login: (email: string) => void;
  logout: () => void;
  setRewardsBalance: (balance: number) => void;
  toggleDarkMode: () => void;
  setSystemDarkMode: (isDark: boolean) => void;
  setDefaultPostPrivacy: (privacy: PrivacyLevel) => void;
  addFriend: (friend: FriendNode) => void;
  removeFriend: (id: string) => void;
  updateFriendTitle: (id: string, title: string) => void;
  blockHandle: (handle: string) => void;
  unblockHandle: (handle: string) => void;
  reportContent: (report: Omit<ModerationReport, "id" | "createdAt">) => void;
  setDisplayName: (name: string) => void;
  setUserHandle: (handle: string | null) => void;
  setUserAvatar: (uri: string | null) => void;
  setUserBio: (bio: string | null) => void;
  setBusinessProfile: (businessName: string) => void;
  clearBusinessProfile: () => void;
  unlockBusinessProfile: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      userEmail: null,
      displayName: null,
      userHandle: null,
      handleAliases: [],
      userAvatar: null,
      userBio: null,
      isBusinessAccount: false,
      businessName: null,
      businessProfileUnlocked: false,
      rewardsBalance: 0,
      defaultPostPrivacy: "public",
      friends: [],
      blockedHandles: [],
      reportedItems: [],
      isDarkMode: false,
      hasThemeOverride: false,

      login: (email: string) =>
        set((state) => {
          const handleFromEmail = email.split("@")[0];
          const normalizedHandle = normalizeHandle(handleFromEmail);
          const aliases = Array.from(
            new Set([...(state.handleAliases || []), handleFromEmail, normalizedHandle])
          );
          return {
            isAuthenticated: true,
            userEmail: email,
            userHandle: state.userHandle || normalizedHandle,
            handleAliases: aliases,
          };
        }),

      logout: () =>
        set({
          isAuthenticated: false,
          userEmail: null,
          displayName: null,
          userHandle: null,
          userAvatar: null,
          userBio: null,
          isBusinessAccount: false,
          businessName: null,
        }),

      setRewardsBalance: (balance: number) =>
        set({ rewardsBalance: balance }),

      toggleDarkMode: () =>
        set((state) => ({ isDarkMode: !state.isDarkMode, hasThemeOverride: true })),

      setSystemDarkMode: (isDark: boolean) =>
        set({ isDarkMode: isDark }),

      setDefaultPostPrivacy: (privacy: PrivacyLevel) =>
        set({ defaultPostPrivacy: privacy }),

      addFriend: (friend: FriendNode) =>
        set((state) => {
          const normalized = normalizeHandle(friend.handle, "");
          if (!normalized) return state;
          const nextFriend: FriendNode = {
            id: friend.id || `lab-${normalized}`,
            handle: normalized,
            title: friend.title?.trim() || "Research Contact",
          };
          const withoutExisting = (state.friends || []).filter(
            (item) =>
              item.id !== nextFriend.id &&
              normalizeHandle(item.handle, "") !== normalized
          );
          return {
            friends: [nextFriend, ...withoutExisting],
          };
        }),

      removeFriend: (id: string) =>
        set((state) => ({
          friends: (state.friends || []).filter((friend) => friend.id !== id),
        })),

      updateFriendTitle: (id: string, title: string) =>
        set((state) => ({
          friends: (state.friends || []).map((friend) =>
            friend.id === id
              ? { ...friend, title: title.trim() || "Research Contact" }
              : friend
          ),
        })),

      blockHandle: (handle: string) =>
        set((state) => {
          const normalized = normalizeHandle(handle, "");
          if (!normalized) return state;
          return {
            blockedHandles: Array.from(
              new Set([...(state.blockedHandles || []), normalized])
            ),
            friends: (state.friends || []).filter(
              (friend) => normalizeHandle(friend.handle, "") !== normalized
            ),
          };
        }),

      unblockHandle: (handle: string) =>
        set((state) => {
          const normalized = normalizeHandle(handle, "");
          return {
            blockedHandles: (state.blockedHandles || []).filter(
              (item) => item !== normalized
            ),
          };
        }),

      reportContent: (report) =>
        set((state) => {
          const targetHandle = normalizeHandle(report.targetHandle, "");
          if (!targetHandle) return state;
          const nextReport: ModerationReport = {
            ...report,
            targetHandle,
            reason: report.reason?.trim() || "reported",
            id: `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            createdAt: Date.now(),
          };
          return {
            reportedItems: [nextReport, ...(state.reportedItems || [])].slice(0, 100),
          };
        }),

      setDisplayName: (name: string) =>
        set((state) => {
          const trimmed = name.trim();
          if (!trimmed) return { displayName: null };
          const normalized = normalizeHandle(trimmed);
          const emailHandle = state.userEmail ? normalizeHandle(state.userEmail.split("@")[0]) : null;
          const shouldDeriveHandleFromName =
            !state.userHandle || (emailHandle && state.userHandle === emailHandle);
          const aliases = Array.from(
            new Set([...(state.handleAliases || []), trimmed, normalized])
          );
          return {
            displayName: trimmed,
            userHandle: shouldDeriveHandleFromName ? normalized : state.userHandle,
            handleAliases: aliases,
          };
        }),

      setUserHandle: (handle: string | null) =>
        set((state) => {
          const normalized = handle ? normalizeHandle(handle) : null;
          if (!normalized) return { userHandle: null };
          const aliases = Array.from(
            new Set([...(state.handleAliases || []), normalized])
          );
          return { userHandle: normalized, handleAliases: aliases };
        }),

      setUserAvatar: (uri: string | null) => set({ userAvatar: uri }),
      setUserBio: (bio: string | null) =>
        set({ userBio: bio && bio.trim().length > 0 ? bio.trim() : null }),
      setBusinessProfile: (businessName: string) =>
        set({
          isBusinessAccount: true,
          businessName: businessName.trim(),
        }),
      clearBusinessProfile: () =>
        set({
          isBusinessAccount: false,
          businessName: null,
        }),
      unlockBusinessProfile: () =>
        set({
          businessProfileUnlocked: true,
        }),
    }),
    {
      name: "app-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

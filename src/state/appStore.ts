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
        set((state) => ({
          friends: [
            ...(state.friends || []),
            friend,
          ].filter((value, index, list) => list.findIndex((item) => item.id === value.id) === index),
        })),

      removeFriend: (id: string) =>
        set((state) => ({
          friends: (state.friends || []).filter((friend) => friend.id !== id),
        })),

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

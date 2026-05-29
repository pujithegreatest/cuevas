import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PrivacyLevel } from "../types/feed";

export interface FriendNode {
  id: string;
  handle: string;
  title: string;
}

interface AppState {
  isAuthenticated: boolean;
  userEmail: string | null;
  displayName: string | null;
  handleAliases: string[];
  userAvatar: string | null;
  userBio: string | null;

  rewardsBalance: number;
  defaultPostPrivacy: PrivacyLevel;
  friends: FriendNode[];

  isDarkMode: boolean;

  login: (email: string) => void;
  logout: () => void;
  setRewardsBalance: (balance: number) => void;
  toggleDarkMode: () => void;
  setDefaultPostPrivacy: (privacy: PrivacyLevel) => void;
  addFriend: (friend: FriendNode) => void;
  removeFriend: (id: string) => void;
  setDisplayName: (name: string) => void;
  setUserAvatar: (uri: string | null) => void;
  setUserBio: (bio: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      userEmail: null,
      displayName: null,
      handleAliases: [],
      userAvatar: null,
      userBio: null,
      rewardsBalance: 300,
      defaultPostPrivacy: "public",
      friends: [
        { id: "lab-1", handle: "howstringy", title: "Field Researcher" },
        { id: "lab-2", handle: "gianttoes69", title: "Cleanup Lead" },
      ],
      isDarkMode: false,

      login: (email: string) =>
        set((state) => {
          const handleFromEmail = email.split("@")[0];
          const aliases = Array.from(
            new Set([...(state.handleAliases || []), handleFromEmail])
          );
          return {
            isAuthenticated: true,
            userEmail: email,
            handleAliases: aliases,
          };
        }),

      logout: () =>
        set({
          isAuthenticated: false,
          userEmail: null,
          displayName: null,
          userAvatar: null,
          userBio: null,
        }),

      setRewardsBalance: (balance: number) =>
        set({ rewardsBalance: balance }),

      toggleDarkMode: () =>
        set((state) => ({ isDarkMode: !state.isDarkMode })),

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
          const aliases = Array.from(
            new Set([...(state.handleAliases || []), trimmed])
          );
          return { displayName: trimmed, handleAliases: aliases };
        }),

      setUserAvatar: (uri: string | null) => set({ userAvatar: uri }),
      setUserBio: (bio: string | null) =>
        set({ userBio: bio && bio.trim().length > 0 ? bio.trim() : null }),
    }),
    {
      name: "app-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

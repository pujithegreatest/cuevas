import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Story } from "../types/story";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface StoryState {
  stories: Story[];
  viewedIds: string[];
  addStory: (story: Omit<Story, "id" | "timestamp">) => void;
  deleteStory: (storyId: string) => void;
  markViewed: (storyId: string) => void;
  pruneExpired: () => void;
}

export const useStoryStore = create<StoryState>()(
  persist(
    (set, get) => ({
      stories: [],
      viewedIds: [],

      addStory: (story) => {
        const newStory: Story = {
          ...story,
          id: `story-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now(),
        };
        set((state) => ({
          stories: [
            newStory,
            ...state.stories.filter((s) => Date.now() - s.timestamp < ONE_DAY_MS),
          ],
        }));
      },

      deleteStory: (storyId) =>
        set((state) => ({
          stories: state.stories.filter((s) => s.id !== storyId),
        })),

      markViewed: (storyId) =>
        set((state) =>
          state.viewedIds.includes(storyId)
            ? state
            : { viewedIds: [...state.viewedIds, storyId] }
        ),

      pruneExpired: () => {
        const now = Date.now();
        const fresh = get().stories.filter((s) => now - s.timestamp < ONE_DAY_MS);
        if (fresh.length !== get().stories.length) {
          set({ stories: fresh });
        }
      },
    }),
    {
      name: "story-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export function groupStoriesByAuthor(
  stories: Story[],
  viewedIds: string[],
  currentUser: string
) {
  const now = Date.now();
  const fresh = stories.filter((s) => now - s.timestamp < ONE_DAY_MS);

  const groupMap = new Map<string, Story[]>();
  for (const story of fresh) {
    const list = groupMap.get(story.author) || [];
    list.push(story);
    groupMap.set(story.author, list);
  }

  const groups = Array.from(groupMap.entries()).map(([author, list]) => {
    const sorted = list.sort((a, b) => a.timestamp - b.timestamp);
    return {
      author,
      authorRewardPoints: sorted[0]?.authorRewardPoints,
      stories: sorted,
      isOwn: author === currentUser,
      hasUnviewed: sorted.some((s) => !viewedIds.includes(s.id)),
    };
  });

  return groups.sort((a, b) => {
    if (a.isOwn !== b.isOwn) return a.isOwn ? -1 : 1;
    if (a.hasUnviewed !== b.hasUnviewed) return a.hasUnviewed ? -1 : 1;
    const aLatest = Math.max(...a.stories.map((s) => s.timestamp));
    const bLatest = Math.max(...b.stories.map((s) => s.timestamp));
    return bLatest - aLatest;
  });
}

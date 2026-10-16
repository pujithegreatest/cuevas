import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type NotificationState = {
  enabled: boolean;
  hydrated: boolean;
  error: string | null;
  setEnabled: (enabled: boolean) => void;
};

export const useNotificationStore = create<NotificationState>()(persist(
  (set) => ({
    enabled: false,
    hydrated: false,
    error: null,
    setEnabled: (enabled) => set({ enabled, error: null }),
  }),
  {
    name: "cuevas-push-preferences",
    storage: createJSONStorage(() => AsyncStorage),
    partialize: (state) => ({ enabled: state.enabled }),
    onRehydrateStorage: () => () => {
      useNotificationStore.setState({ hydrated: true });
    },
  }
));

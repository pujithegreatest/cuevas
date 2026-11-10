import { create } from "zustand";
import { MissionShare } from "../types/feed";

type MessagingUi = {
  visible: boolean;
  targetHandle: string | null;
  conversationId: string | null;
  unread: number;
  pendingMission: MissionShare | null;
  shareMission: (mission: MissionShare) => void;
  open: (targetHandle?: string, conversationId?: string) => void;
  close: () => void;
};
export const useMessagingStore = create<MessagingUi>((set) => ({
  visible: false, targetHandle: null, conversationId: null, unread: 0,
  pendingMission: null,
  shareMission: (mission) => set({ visible: true, targetHandle: null, conversationId: null, pendingMission: mission }),
  open: (targetHandle, conversationId) => set({ visible: true, targetHandle: targetHandle || null, conversationId: conversationId || null, pendingMission: null }),
  close: () => set({ visible: false, targetHandle: null, conversationId: null, pendingMission: null }),
}));

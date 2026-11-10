import { create } from "zustand";

type MessagingUi = {
  visible: boolean;
  targetHandle: string | null;
  conversationId: string | null;
  unread: number;
  open: (targetHandle?: string, conversationId?: string) => void;
  close: () => void;
};
export const useMessagingStore = create<MessagingUi>((set) => ({
  visible: false, targetHandle: null, conversationId: null, unread: 0,
  open: (targetHandle, conversationId) => set({ visible: true, targetHandle: targetHandle || null, conversationId: conversationId || null }),
  close: () => set({ visible: false, targetHandle: null, conversationId: null }),
}));

import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { observeMessageNotificationOpens } from "../services/messageNotificationNavigation";
import { useAppStore } from "../state/appStore";
import { useMessagingStore } from "../state/messagingStore";
import { clearMessagingSession, Conversation, dmRequest } from "../services/directMessages";

export default function MessagingRegistration() {
  const authenticated = useAppStore((s) => s.isAuthenticated);
  const email = useAppStore((s) => s.userEmail);
  const blockedHandles = useAppStore((s) => s.blockedHandles);
  useEffect(() => {
    if (authenticated && blockedHandles.length) void dmRequest("blockHandles", { handles: blockedHandles }).catch(() => {});
  }, [authenticated, email, blockedHandles]);
  useEffect(() => {
    // React only to an actual logout, not initial store hydration.
    return useAppStore.subscribe((state, previous) => {
      if (previous.isAuthenticated && !state.isAuthenticated) {
        useMessagingStore.getState().close();
        useMessagingStore.setState({ unread: 0 });
        void clearMessagingSession();
      }
    });
  }, []);
  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const update = async () => {
      try {
        if (AppState.currentState !== "active" || (Platform.OS === "web" && document.hidden)) return;
        const data = await dmRequest<{ conversations: Conversation[] }>("inbox");
        if (active) useMessagingStore.setState({ unread: data.conversations.filter((item) => item.unread).length });
      } catch { /* A fresh verified login is required for accounts predating messaging. */ }
      finally { if (active) timer = setTimeout(update, 30000); }
    };
    void update();
    const open = (data: Record<string, unknown> | undefined) => {
      if (active && data?.type === "dm" && typeof data.conversationId === "string") useMessagingStore.getState().open(undefined, data.conversationId);
    };
    const stop = observeMessageNotificationOpens(open);
    return () => { active = false; clearTimeout(timer); stop(); };
  }, [authenticated, email]);
  return null;
}

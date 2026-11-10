import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ArrowLeft, Check, ChevronRight, LogOut, MoreHorizontal, Plus, Search, Send, ShieldAlert, Target, UserPlus, Users, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppStore } from "../state/appStore";
import { useMessagingStore } from "../state/messagingStore";
import { Conversation, DirectMessage, Person, conversationTitle, dmRequest, messagingIdentity, newMessageId } from "../services/directMessages";
import MailButton from "./MailButton";
import MissionShareCard from "./MissionShareCard";
import { MissionShare } from "../types/feed";
import { fetchCuevasMissions } from "../api/cuevas-missions";
import { toMissionShare } from "../utils/missionShare";

const REPORT_REASONS = ["Harassment", "Hate or threats", "Sexual content", "Child safety or exploitation", "Spam or scam", "Other"];

export default function MessagingModal() {
  const { visible, targetHandle, conversationId, close } = useMessagingStore();
  const dark = useAppStore((s) => s.isDarkMode);
  const email = useAppStore((s) => s.userEmail);
  const logout = useAppStore((s) => s.logout);
  const insets = useSafeAreaInsets();
  const [uid, setUid] = useState("");
  const [inbox, setInbox] = useState<Conversation[]>([]);
  const [chat, setChat] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [composer, setComposer] = useState(false);
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState<Person[]>([]);
  const [groupName, setGroupName] = useState("");
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<MissionShare | null>(null);
  const [missionPicker, setMissionPicker] = useState(false);
  const [missions, setMissions] = useState<MissionShare[]>([]);
  const [missionQuery, setMissionQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState(false);
  const [report, setReport] = useState<DirectMessage | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [blockedPeople, setBlockedPeople] = useState<Person[]>([]);
  const list = useRef<FlatList<DirectMessage>>(null);
  const requestVersion = useRef(0);
  const loadedHistory = useRef<string | null>(null);
  const pendingMessage = useRef<{ text: string; id: string } | null>(null);
  const c = { bg: dark ? "#0B171B" : "#F5FCFB", surface: dark ? "#14272C" : "#FFFFFF", text: dark ? "#DAF5EF" : "#152F34", muted: dark ? "#9DB5B8" : "#536D72", border: dark ? "#29464B" : "#CEE5E2", accent: dark ? "#55DCD0" : "#067E79" };
  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(""); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); } finally { setBusy(false); } };
  const loadInbox = useCallback(async () => {
    const data = await dmRequest<{ conversations: Conversation[]; uid: string }>("inbox");
    setInbox(data.conversations); setUid(data.uid);
    useMessagingStore.setState({ unread: data.conversations.filter((item) => item.unread).length });
  }, []);
  const openChat = async (next: Conversation) => {
    loadedHistory.current = null;
    requestVersion.current++; setChat(next); setComposer(false); setSettings(false); setMessages([]); setDraft(""); setHasMore(false); pendingMessage.current = null;
  };
  useEffect(() => {
    requestVersion.current++;
    setUid("");
    setAttachment(visible ? useMessagingStore.getState().pendingMission : null);
    setMissionPicker(false); setMissionQuery("");
    setChat(null); setMessages([]); setInbox([]); setDraft(""); setError(""); setSettings(false); setReport(null); setSelected([]); setPeople([]); setQuery(targetHandle || ""); setGroupName(""); setComposer(Boolean(targetHandle));
    if (!visible) return;
    const version = requestVersion.current;
    setLoading(true);
    (async () => {
      setUid(await messagingIdentity());
      if (version !== requestVersion.current) return;
      await loadInbox();
      if (conversationId) {
        const result = await dmRequest<{ conversation: Conversation }>("messages", { conversationId });
        if (version === requestVersion.current) await openChat(result.conversation);
      } else if (targetHandle) {
        const result = await dmRequest<{ people: Person[] }>("people", { query: targetHandle });
        if (version !== requestVersion.current) return;
        const person = result.people.find((item) => item.handle === targetHandle.replace(/^@/, "").toLowerCase());
        if (person) {
          const created = await dmRequest<{ conversation: Conversation }>("create", { participants: [person.uid] });
          if (version === requestVersion.current) await openChat(created.conversation);
        } else setError("This person is unavailable for messaging.");
      }
    })().catch((e) => { if (version === requestVersion.current) setError(e.message); }).finally(() => setLoading(false));
    return () => { requestVersion.current++; };
  }, [visible, targetHandle, conversationId, email, loadInbox]);
  useEffect(() => {
    if (!visible || !composer || query.trim().length < 2) { setPeople([]); return; }
    let active = true;
    const timer = setTimeout(() => {
      dmRequest<{ people: Person[] }>("people", { query }).then((data) => { if (active) setPeople(data.people); }).catch((e) => { if (active) setError(e.message); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [visible, composer, query]);
  useEffect(() => {
    if (!visible || composer || !uid) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const update = async () => {
      try {
        if (Platform.OS !== "web" && AppState.currentState !== "active") return;
        if (Platform.OS === "web" && typeof document !== "undefined" && document.hidden) return;
        if (!chat) { await loadInbox(); return; }
        const result = await dmRequest<{ messages: DirectMessage[]; conversation: Conversation; hasMore: boolean }>("messages", { conversationId: chat.id });
        if (!active) return;
        setChat(result.conversation);
        setMessages((old) => {
          const oldest = result.messages[0]?.createdAt || Infinity;
          const map = new Map((result.hasMore ? old.filter((message) => message.createdAt < oldest) : []).map((message) => [message.id, message]));
          result.messages.forEach((message) => map.set(message.id, message));
          return [...map.values()].sort((a, b) => a.createdAt - b.createdAt);
        });
        if (loadedHistory.current !== chat.id) {
          loadedHistory.current = chat.id;
          setHasMore(result.hasMore);
          setTimeout(() => { if (active) list.current?.scrollToEnd({ animated: false }); }, 100);
        }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "Messages could not refresh."); }
      finally { if (active) timer = setTimeout(update, 5000); }
    };
    update();
    return () => { active = false; clearTimeout(timer); };
  }, [visible, composer, chat?.id, uid, loadInbox]);
  const createChat = () => run(async () => {
    const data = await dmRequest<{ conversation: Conversation }>("create", { participants: selected.map((person) => person.uid), title: selected.length > 1 ? groupName : "" });
    await openChat(data.conversation);
  });
  const send = () => run(async () => {
    if (!chat || (!draft.trim() && !attachment)) return;
    const version = requestVersion.current;
    const text = draft.trim();
    const signature = JSON.stringify({ text, attachment });
    if (pendingMessage.current?.text !== signature) pendingMessage.current = { text: signature, id: newMessageId() };
    const data = await dmRequest<{ message: DirectMessage }>("send", { conversationId: chat.id, text, ...(attachment ? { missionShare: attachment } : {}), messageId: pendingMessage.current.id });
    if (version !== requestVersion.current) return;
    setMessages((old) => [...old.filter((message) => message.id !== data.message.id), data.message].sort((a, b) => a.createdAt - b.createdAt));
    setDraft(""); pendingMessage.current = null;
    setAttachment(null); useMessagingStore.setState({ pendingMission: null });
    setTimeout(() => list.current?.scrollToEnd({ animated: true }), 100);
  });
  const icon = (label: string, Icon: typeof X, onPress: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : 1 }}><Icon size={23} color={c.accent} /></Pressable>;
  const title = composer ? "New conversation" : chat ? conversationTitle(chat, uid) : "Messages";
  return <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ width: "100%", maxWidth: 900, alignSelf: "center", flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", padding: 10, borderBottomWidth: 1, borderColor: c.border, minHeight: 68 }}>
          {icon(chat || composer ? "Back to inbox" : "Close messages", chat || composer ? ArrowLeft : X, () => { requestVersion.current++; if (chat || composer) { setChat(null); setComposer(false); setSettings(false); setError(""); } else close(); })}
          <View style={{ flex: 1, marginHorizontal: 8 }}><Text numberOfLines={2} style={{ color: c.text, fontSize: 19, fontWeight: "800" }}>{title}</Text>{chat && <Text style={{ color: c.muted, fontSize: 12, marginTop: 3 }}>{chat.type === "group" ? `${Object.keys(chat.members).filter((id) => chat.members[id]).length} members` : "Direct message"}</Text>}</View>
          {chat ? icon("Conversation options", MoreHorizontal, () => setSettings(!settings)) : !composer && icon("New conversation", Plus, () => { setSelected([]); setQuery(""); setGroupName(""); setComposer(true); })}
          {!chat && !composer && icon("Blocked people", ShieldAlert, () => run(async () => { const data = await dmRequest<{ people: Person[] }>("blocked"); setBlockedPeople(data.people); setSettings(!settings); }))}
        </View>
        {settings && !chat && !composer && <View style={{ padding: 16, backgroundColor: c.surface, borderBottomWidth: 1, borderColor: c.border }}><Text style={{ color: c.text, fontWeight: "800", marginBottom: 8 }}>Blocked people</Text>{!blockedPeople.length && <Text style={{ color: c.muted }}>No blocked people</Text>}{blockedPeople.map((person) => <View key={person.uid} style={{ flexDirection: "row", paddingVertical: 10 }}><Text style={{ flex: 1, color: c.text }}>@{person.handle}</Text><Pressable disabled={busy} onPress={() => run(async () => { await dmRequest("block", { targetUid: person.uid, blocked: false }); useAppStore.getState().unblockHandle(person.handle); setBlockedPeople((old) => old.filter((item) => item.uid !== person.uid)); })}><Text style={{ color: c.accent, fontWeight: "700" }}>Unblock</Text></Pressable></View>)}</View>}
        {!!error && <View accessibilityRole="alert" style={{ padding: 14, backgroundColor: dark ? "#3C242C" : "#FDECEE", borderBottomWidth: 1, borderColor: c.border }}><Text style={{ color: dark ? "#FFCDD2" : "#922E40" }}>{error}</Text>{error.toLowerCase().includes("sign in") && <Pressable onPress={() => { close(); logout(); }} style={{ marginTop: 12 }}><Text style={{ color: c.accent, fontWeight: "800" }}>Sign in again</Text></Pressable>}</View>}
        {loading && <ActivityIndicator style={{ margin: 20 }} color={c.accent} />}
        {attachment && !chat && <View style={{ padding: 12, borderBottomWidth: 1, borderColor: c.border }}><Text style={{ color: c.text, fontWeight: "700" }}>Send mission: {attachment.title}</Text><Text style={{ color: c.muted, marginTop: 4 }}>Choose a conversation</Text></View>}
        {composer ? <View style={{ flex: 1, padding: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderRadius: 8, borderWidth: 1, borderColor: c.border, paddingHorizontal: 12 }}><Search size={20} color={c.muted} /><TextInput accessibilityLabel="Find people" placeholder="Find by username or name" placeholderTextColor={c.muted} value={query} onChangeText={setQuery} autoCapitalize="none" style={{ flex: 1, padding: 14, color: c.text, fontSize: 16 }} /></View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 12 }}>{selected.map((person) => <Pressable key={person.uid} accessibilityLabel={`Remove ${person.handle}`} onPress={() => setSelected((old) => old.filter((item) => item.uid !== person.uid))} style={{ flexDirection: "row", alignItems: "center", padding: 8, backgroundColor: c.surface, borderRadius: 8, borderWidth: 1, borderColor: c.accent }}><Text style={{ color: c.text, marginRight: 6 }}>@{person.handle}</Text><X size={15} color={c.accent} /></Pressable>)}</View>
          {selected.length > 1 && <TextInput accessibilityLabel="Group name" value={groupName} onChangeText={setGroupName} maxLength={80} placeholder="Group name (optional)" placeholderTextColor={c.muted} style={{ padding: 14, color: c.text, borderBottomWidth: 1, borderColor: c.border, marginBottom: 12 }} />}
          <FlatList data={people} keyExtractor={(person) => person.uid} keyboardShouldPersistTaps="handled" ListEmptyComponent={<Text style={{ color: c.muted, paddingVertical: 20 }}>{query.length < 2 ? "Search for a person" : "No matching people"}</Text>} renderItem={({ item }) => <Pressable onPress={() => setSelected((old) => old.some((person) => person.uid === item.uid) ? old.filter((person) => person.uid !== item.uid) : old.length < 19 ? [...old, item] : old)} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 15, borderBottomWidth: 1, borderColor: c.border }}><View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: "700", fontSize: 16 }}>{item.name}</Text><Text style={{ color: c.accent, marginTop: 3 }}>@{item.handle}</Text></View>{selected.some((person) => person.uid === item.uid) ? <Check color={c.accent} size={22} /> : <Plus color={c.muted} size={22} />}</Pressable>} />
          <Pressable accessibilityRole="button" disabled={!selected.length || busy} onPress={createChat} style={{ backgroundColor: c.accent, borderRadius: 8, padding: 16, marginVertical: 12, opacity: !selected.length || busy ? 0.5 : 1, alignItems: "center" }}><Text style={{ color: dark ? "#092C2E" : "white", fontWeight: "800" }}>{busy ? "Opening..." : selected.length > 1 ? "Create group" : "Start conversation"}</Text></Pressable>
        </View> : chat ? <>
          {settings && <View style={{ padding: 16, borderBottomWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
            <Pressable onPress={() => { setSelected(Object.values(chat.people).filter((person) => person.uid !== uid && chat.members[person.uid])); setGroupName(""); setQuery(""); setComposer(true); setSettings(false); }} style={{ flexDirection: "row", gap: 10, paddingVertical: 12 }}><UserPlus size={20} color={c.accent} /><Text style={{ color: c.text }}>Start a new group with these people</Text></Pressable>
            {Object.values(chat.people).filter((person) => person.uid !== uid && chat.members[person.uid]).map((person) => <View key={person.uid} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10 }}><Text style={{ color: c.text, flex: 1 }}>@{person.handle}</Text><Pressable disabled={busy} onPress={() => run(async () => { await dmRequest("block", { targetUid: person.uid }); useAppStore.getState().blockHandle(person.handle); setError(`@${person.handle} is blocked from messaging you.`); })}><Text style={{ color: "#D65A70", fontWeight: "700" }}>Block</Text></Pressable></View>)}
            {chat.type === "group" && <Pressable disabled={busy} onPress={() => run(async () => { await dmRequest("leave", { conversationId: chat.id }); setChat(null); setSettings(false); await loadInbox(); })} style={{ flexDirection: "row", gap: 10, paddingVertical: 12 }}><LogOut size={20} color="#D65A70" /><Text style={{ color: "#D65A70" }}>Leave group</Text></Pressable>}
          </View>}
          <FlatList ref={list} data={messages} keyExtractor={(message) => message.id} contentContainerStyle={{ padding: 16, flexGrow: 1 }} keyboardShouldPersistTaps="handled" ListHeaderComponent={hasMore ? <Pressable disabled={busy} onPress={() => run(async () => { const data = await dmRequest<{ messages: DirectMessage[]; hasMore: boolean }>("messages", { conversationId: chat.id, before: messages[0]?.createdAt }); setMessages((old) => [...new Map([...data.messages, ...old].map((message) => [message.id, message])).values()].sort((a, b) => a.createdAt - b.createdAt)); setHasMore(data.hasMore); })} style={{ padding: 12, alignItems: "center" }}><Text style={{ color: c.accent }}>Earlier messages</Text></Pressable> : null} ListEmptyComponent={<View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 30 }}><Users color={c.accent} size={32} /><Text style={{ color: c.muted, marginTop: 12 }}>No messages yet</Text></View>} renderItem={({ item }) => {
            const own = item.sender === uid;
            return <View style={{ alignSelf: own ? "flex-end" : "flex-start", maxWidth: item.missionShare ? "95%" : "85%", width: item.missionShare ? "95%" : undefined, marginBottom: 14 }}>
              <View style={{ backgroundColor: own ? dark ? "#164E50" : "#D2F4ED" : c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 12 }}>
                {!own && <Text style={{ color: c.accent, fontWeight: "700", fontSize: 12, marginBottom: 5 }}>@{chat.people[item.sender]?.handle || "Former member"}</Text>}
                {!!item.text && <Text selectable style={{ color: c.text, fontSize: 16, lineHeight: 23 }}>{item.text}</Text>}
                {item.missionShare && <MissionShareCard mission={item.missionShare} isDarkMode={dark} compact />}
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}><Text style={{ color: c.muted, fontSize: 11, flex: 1 }}>{new Date(item.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text>{!own && <Pressable accessibilityLabel="Report message" hitSlop={8} onPress={() => setReport(item)} style={{ paddingLeft: 16 }}><ShieldAlert size={16} color={c.muted} /></Pressable>}</View>
              </View>
            </View>;
          }} />
          {attachment && <View style={{ paddingHorizontal: 12, backgroundColor: c.surface, borderTopWidth: 1, borderColor: c.border }}><View style={{ flexDirection: "row", alignItems: "center" }}><Text numberOfLines={2} style={{ flex: 1, color: c.text, fontWeight: "700" }}>{attachment.title}</Text>{icon("Remove mission attachment", X, () => { setAttachment(null); useMessagingStore.setState({ pendingMission: null }); }, busy)}</View><Text numberOfLines={1} style={{ color: c.muted, paddingBottom: 8 }}>{attachment.location || "Mission"} · {attachment.points || 0} Cuevas</Text></View>}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, paddingBottom: Math.max(insets.bottom, 12), borderTopWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
            {icon("Attach mission", Target, () => run(async () => { const version = requestVersion.current; const items = await fetchCuevasMissions(); if (version !== requestVersion.current) return; setMissions(items.map(toMissionShare)); setMissionQuery(""); setMissionPicker(true); }), busy)}
            <TextInput accessibilityLabel="Message" placeholder="Message..." placeholderTextColor={c.muted} value={draft} onChangeText={setDraft} multiline maxLength={4000} editable={!busy} style={{ flex: 1, minHeight: 44, maxHeight: 120, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: c.border, color: c.text, fontSize: 16 }} />
            {busy ? <ActivityIndicator color={c.accent} style={{ width: 44 }} /> : icon("Send message", Send, send, !draft.trim() && !attachment)}
          </View>
        </> : <FlatList data={inbox} keyExtractor={(item) => item.id} contentContainerStyle={{ flexGrow: 1 }} ListEmptyComponent={!loading ? <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 30 }}><MailButton onPress={() => setComposer(true)} label="Start a conversation" /><Text style={{ color: c.text, fontWeight: "800", fontSize: 20, marginTop: 18 }}>Your conversations</Text><Text style={{ color: c.muted, marginTop: 8 }}>No messages yet</Text></View> : null} renderItem={({ item }) => <Pressable onPress={() => { setError(""); openChat(item); }} style={{ padding: 18, borderBottomWidth: 1, borderColor: c.border, flexDirection: "row", alignItems: "center", gap: 12 }}><View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: dark ? "#173B3D" : "#DBF4EF", alignItems: "center", justifyContent: "center" }}><Users size={22} color={c.accent} /></View><View style={{ flex: 1 }}><Text numberOfLines={2} style={{ color: c.text, fontSize: 16, fontWeight: item.unread ? "900" : "600" }}>{conversationTitle(item, uid)}</Text><Text style={{ color: c.muted, fontSize: 12, marginTop: 5 }}>{item.type === "group" ? "Group" : "Direct"} · {new Date(item.updatedAt).toLocaleDateString()}</Text></View>{item.unread && <View accessibilityLabel="Unread" style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.accent }} />}<ChevronRight size={20} color={c.muted} /></Pressable>} />}
      </View>
      {report && <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 24 }}><View style={{ backgroundColor: c.surface, borderRadius: 8, padding: 20, width: "100%", maxWidth: 420 }}><View style={{ flexDirection: "row", alignItems: "center" }}><Text style={{ color: c.text, fontSize: 18, fontWeight: "800", flex: 1 }}>Report message</Text>{icon("Cancel report", X, () => setReport(null))}</View><ScrollView>{REPORT_REASONS.map((reason) => <Pressable key={reason} disabled={busy} onPress={() => run(async () => { await dmRequest("report", { conversationId: chat?.id, messageId: report.id, reason }); setReport(null); setError("Report submitted for review."); })} style={{ paddingVertical: 14, borderBottomWidth: 1, borderColor: c.border }}><Text style={{ color: c.text }}>{reason}</Text></Pressable>)}</ScrollView></View></View>}
      {missionPicker && <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 16 }}><View style={{ width: "100%", maxWidth: 600, height: "80%", backgroundColor: c.surface, borderRadius: 8, padding: 16 }}><View style={{ flexDirection: "row", alignItems: "center" }}><Text style={{ flex: 1, color: c.text, fontWeight: "800", fontSize: 19 }}>Share a mission</Text>{icon("Close mission picker", X, () => setMissionPicker(false))}</View><TextInput accessibilityLabel="Find missions" placeholder="Search missions" placeholderTextColor={c.muted} value={missionQuery} onChangeText={setMissionQuery} style={{ color: c.text, borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 12, marginVertical: 10 }} /><FlatList data={missions.filter((mission) => `${mission.title} ${mission.businessHandle || ""} ${mission.location || ""}`.toLowerCase().includes(missionQuery.toLowerCase()))} keyExtractor={(mission) => mission.id} keyboardShouldPersistTaps="handled" ListEmptyComponent={<Text style={{ color: c.muted, padding: 20 }}>No matching missions</Text>} renderItem={({ item }) => <MissionShareCard mission={item} isDarkMode={dark} compact onPress={() => { setAttachment(item); setMissionPicker(false); pendingMessage.current = null; }} />} /></View></View>}
    </KeyboardAvoidingView>
  </Modal>;
}

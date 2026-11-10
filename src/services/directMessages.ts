import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { useAppStore } from "../state/appStore";

const ENDPOINT = "https://us-central1-ecothot-social-media.cloudfunctions.net/directMessages";
const API_KEY = "AIzaSyAaX90jFj3_v_YziTLmoG7cQhT9KBsfsas";
const SESSION_KEY = "cuevas.dm.session.v1";
type Session = { uid: string; email: string; idToken: string; refreshToken: string; expiresAt: number };
export type Person = { uid: string; handle: string; name: string };
export type Conversation = { id: string; type: "direct" | "group"; title: string; members: Record<string, boolean>; people: Record<string, Person>; updatedAt: number; unread?: boolean };
export type DirectMessage = { id: string; sender: string; text: string; createdAt: number };
let session: Session | null = null;
let refreshing: Promise<Session> | null = null;
let generation = 0;

async function stored(value?: string | null) {
  if (Platform.OS === "web") {
    if (value === undefined) return sessionStorage.getItem(SESSION_KEY);
    if (value === null) sessionStorage.removeItem(SESSION_KEY);
    else sessionStorage.setItem(SESSION_KEY, value);
  } else {
    if (value === undefined) return SecureStore.getItemAsync(SESSION_KEY);
    if (value === null) await SecureStore.deleteItemAsync(SESSION_KEY);
    else await SecureStore.setItemAsync(SESSION_KEY, value);
  }
  return null;
}
async function request(url: string, body: unknown, token?: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body), signal: controller.signal });
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Messaging authorization failed. Please sign in again.");
    return data;
  } finally { clearTimeout(timeout); }
}
export async function establishMessagingSession(credentials: { email?: string | null; password?: string; googleToken?: string; appleIdentityToken?: string | null; appleUserId?: string }) {
  const current = ++generation;
  const proof = await request(ENDPOINT, { ...credentials, action: "authenticate" });
  const auth = await request(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`, { token: proof.token, returnSecureToken: true });
  if (current !== generation) return;
  session = { uid: proof.uid, email: proof.email.toLowerCase(), idToken: auth.idToken, refreshToken: auth.refreshToken, expiresAt: Date.now() + Number(auth.expiresIn) * 1000 };
  await stored(JSON.stringify(session));
}
export async function clearMessagingSession() {
  generation++;
  const previous = session;
  session = null;
  await stored(null);
  if (previous) {
    try { await request(ENDPOINT, { action: "device", deviceId: await deviceId(), token: null }, previous.idToken); } catch { /* Expired tokens are removed server-side after the next registration. */ }
  }
}
async function authorizedSession(): Promise<Session> {
  if (!session) {
    const value = await stored();
    if (value) { try { session = JSON.parse(value); } catch { await stored(null); } }
  }
  const account = useAppStore.getState();
  if (!session || !account.isAuthenticated || session.email !== account.userEmail?.toLowerCase()) throw new Error("Sign in again to enable private messaging on this device.");
  if (session.expiresAt > Date.now() + 60000) return session;
  if (!refreshing) {
    const previous = session;
    const current = generation;
    refreshing = request(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, { grant_type: "refresh_token", refresh_token: previous.refreshToken }).then(async (result) => {
      if (current !== generation) throw new Error("Account changed. Please reopen messages.");
      session = { ...previous, idToken: result.id_token, refreshToken: result.refresh_token, expiresAt: Date.now() + Number(result.expires_in) * 1000 };
      await stored(JSON.stringify(session));
      return session;
    }).finally(() => { refreshing = null; });
  }
  return refreshing;
}
export async function dmRequest<T = Record<string, never>>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  const auth = await authorizedSession();
  const current = generation;
  const result = await request(ENDPOINT, { ...data, action }, auth.idToken);
  if (current !== generation || auth.email !== useAppStore.getState().userEmail?.toLowerCase()) throw new Error("Account changed. Please reopen messages.");
  return result;
}
export async function messagingIdentity() { return (await authorizedSession()).uid; }
export function newMessageId() { return Crypto.randomUUID(); }
async function deviceId() {
  const name = "cuevas.dm.device.v1";
  if (Platform.OS === "web") return "web";
  let id = await SecureStore.getItemAsync(name);
  if (!id) { id = Crypto.randomUUID(); await SecureStore.setItemAsync(name, id); }
  return id;
}
export async function registerMessagingDevice(token: string | null) {
  if (Platform.OS !== "web") await dmRequest("device", { deviceId: await deviceId(), token });
}
export function conversationTitle(chat: Conversation, uid: string) {
  return chat.title || Object.values(chat.people || {}).filter((person) => person.uid !== uid && chat.members[person.uid]).map((person) => `@${person.handle || person.name}`).join(", ") || "Conversation";
}

const BASE_URL = "https://www.ecothot.com/_functions";
const CUEVAS_CLIENT_KEY = "ecothot-super-secret-9384fjksd";
const CHAT_ENDPOINTS = ["missionChatMessages", "missionchatmessages"];

export type MissionChatRole = "volunteer" | "vendor";

export interface MissionChatMessage {
  id: string;
  missionId: string;
  text: string;
  authorEmail?: string;
  authorHandle: string;
  authorRole: MissionChatRole;
  businessHandle?: string;
  createdAt: string;
}

async function readApiJson(response: Response) {
  const text = await response.text();
  if (!text.trim()) return { json: null, text };
  try {
    return { json: JSON.parse(text), text };
  } catch {
    return { json: null, text };
  }
}

function normalizeMessage(item: any): MissionChatMessage {
  return {
    id: String(item?.id || item?._id || `chat-${Date.now()}`),
    missionId: String(item?.missionId || item?.MissionId || ""),
    text: String(item?.text || item?.Text || ""),
    authorEmail: item?.authorEmail || item?.AuthorEmail || "",
    authorHandle: String(item?.authorHandle || item?.AuthorHandle || "cuevas"),
    authorRole: item?.authorRole === "vendor" || item?.AuthorRole === "vendor" ? "vendor" : "volunteer",
    businessHandle: item?.businessHandle || item?.BusinessHandle || "",
    createdAt: String(item?.createdAt || item?.CreatedAt || new Date().toISOString()),
  };
}

export async function fetchMissionChatMessages(input: {
  missionId: string;
  userEmail?: string | null;
  businessHandle?: string | null;
  authorRole?: MissionChatRole;
}): Promise<MissionChatMessage[]> {
  const params = new URLSearchParams({
    missionId: input.missionId,
    clientKey: CUEVAS_CLIENT_KEY,
    authorRole: input.authorRole || "volunteer",
  });
  if (input.userEmail) params.set("userEmail", input.userEmail);
  if (input.businessHandle) params.set("businessHandle", input.businessHandle);

  for (const endpoint of CHAT_ENDPOINTS) {
    const response = await fetch(`${BASE_URL}/${endpoint}?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const { json, text } = await readApiJson(response);
    if (response.status === 404 && !json) continue;
    if (!response.ok || !json?.success) {
      throw new Error(json?.error || `Failed to load mission chat (${response.status})${text ? "" : ". Publish the Wix backend."}`);
    }
    return (json.messages || []).map(normalizeMessage);
  }
  throw new Error("Mission chat endpoint is not live yet. Publish the Wix backend.");
}

export async function sendMissionChatMessage(input: {
  missionId: string;
  text: string;
  userEmail?: string | null;
  userHandle?: string | null;
  authorRole: MissionChatRole;
  businessHandle?: string | null;
}): Promise<MissionChatMessage> {
  for (const endpoint of CHAT_ENDPOINTS) {
    const response = await fetch(`${BASE_URL}/${endpoint}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, clientKey: CUEVAS_CLIENT_KEY }),
    });
    const { json, text } = await readApiJson(response);
    if (response.status === 404 && !json) continue;
    if (!response.ok || !json?.success) {
      throw new Error(json?.error || `Failed to send mission chat (${response.status})${text ? "" : ". Publish the Wix backend."}`);
    }
    return normalizeMessage(json.message);
  }
  throw new Error("Mission chat endpoint is not live yet. Publish the Wix backend.");
}

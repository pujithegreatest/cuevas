const BASE_URL = "https://www.ecothot.com/_functions";
const CUEVAS_CLIENT_KEY = "ecothot-super-secret-9384fjksd";

export type MissionType = "One time" | "Recurring" | "Weekly" | "Monthly";
export type MissionDifficulty = "Easy" | "Medium" | "High impact";

export interface CuevasMission {
  id: string;
  title: string;
  points: number;
  durationHours?: number;
  location: string;
  eventDate: string;
  eventDateISO?: string;
  type: MissionType;
  description: string;
  difficulty: MissionDifficulty;
  peopleNeeded?: number | string;
  gearProvided?: boolean;
  materialsNote?: string;
  eventUrl?: string;
  businessName?: string;
  businessHandle?: string;
  businessVerified?: boolean;
  goingCount?: number;
  status?: string;
}

export interface CreateMissionInput {
  title: string;
  description: string;
  location: string;
  eventDate: string;
  durationHours?: number;
  type: MissionType;
  difficulty: MissionDifficulty;
  points: number;
  peopleNeeded: number;
  gearProvided: boolean;
  materialsNote?: string;
  eventUrl?: string;
  businessName: string;
  businessHandle: string;
  businessVerified?: boolean;
  contactEmail?: string | null;
}

export interface MissionAttendee {
  missionId?: string;
  email: string;
  handle?: string;
  status?: string;
  checkedIn?: boolean;
  awardedPoints?: number;
  checkedInAt?: string;
  missionTitle?: string;
  missionLocation?: string;
  missionEventDate?: string;
  missionEventDateISO?: string;
  missionBusinessName?: string;
  missionBusinessHandle?: string;
  missionPoints?: number;
  missionDurationHours?: number;
}

export interface MissionProof {
  id: string;
  missionId: string;
  missionTitle?: string;
  userEmail?: string;
  userHandle?: string;
  businessHandle?: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  status?: string;
  submittedAt?: string;
}

export interface MissionProofInput {
  missionId: string;
  missionTitle?: string;
  userEmail?: string | null;
  userHandle?: string | null;
  businessHandle?: string | null;
  mediaUrl: string;
  mediaType: "image" | "video";
  fileName?: string;
  mimeType?: string;
  durationSeconds?: number | null;
}

async function parseApiJson(response: Response, fallbackMessage: string) {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`${fallbackMessage}: empty response (${response.status})`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${fallbackMessage}: invalid JSON (${response.status})`);
  }
}

function normalizeMission(item: any): CuevasMission {
  const eventDate =
    item?.eventDate ||
    item?.EventDate ||
    item?.date ||
    item?.Date ||
    "Date TBD";
  const parsedEventDate = new Date(eventDate);
  const eventDateISO = Number.isNaN(parsedEventDate.getTime())
    ? undefined
    : parsedEventDate.toISOString();
  const rawPeopleNeeded = item?.peopleNeeded ?? item?.PeopleNeeded ?? "";
  const peopleNeededCount = Number(rawPeopleNeeded);
  return {
    id: String(item?._id || item?.id || item?.missionId || `mission-${Date.now()}`),
    title: item?.title || item?.Title || item?.EventName || item?.eventName || "Untitled Mission",
    points: Number(item?.points ?? item?.Points ?? item?.Cuevas ?? 100),
    durationHours: Number(item?.durationHours ?? item?.DurationHours ?? 1) || 1,
    location: item?.location || item?.Location || "Location TBD",
    eventDate: typeof eventDate === "string" ? eventDate : new Date(eventDate).toLocaleDateString(),
    eventDateISO:
      item?.eventDateISO ||
      item?.EventDateISO ||
      eventDateISO,
    type: item?.type || item?.Type || "One time",
    description: item?.description || item?.Description || "Mission details coming soon.",
    difficulty: item?.difficulty || item?.Difficulty || "Easy",
    peopleNeeded: Number.isFinite(peopleNeededCount) && peopleNeededCount > 0 ? peopleNeededCount : rawPeopleNeeded || "",
    gearProvided: Boolean(item?.gearProvided ?? item?.GearProvided ?? false),
    materialsNote: item?.materialsNote || item?.MaterialsNote || "",
    eventUrl: item?.eventUrl || item?.EventUrl || "",
    businessName: item?.businessName || item?.BusinessName || "Cuevas Partner",
    businessHandle: item?.businessHandle || item?.BusinessHandle || "cuevas-partner",
    businessVerified: Boolean(item?.businessVerified ?? item?.BusinessVerified ?? false),
    goingCount: Number(item?.goingCount ?? item?.GoingCount ?? 0),
    status: item?.status || item?.Status || "active",
  };
}

export async function fetchCuevasMissions(): Promise<CuevasMission[]> {
  const response = await fetch(`${BASE_URL}/missions`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const json = await parseApiJson(response, "Failed to load missions");
  if (!response.ok || !json?.success) {
    throw new Error(json?.error || "Failed to load missions");
  }
  return (json.missions || []).map(normalizeMission);
}

export async function createCuevasMission(input: CreateMissionInput): Promise<CuevasMission> {
  const response = await fetch(`${BASE_URL}/missions`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, clientKey: CUEVAS_CLIENT_KEY }),
  });
  const json = await parseApiJson(response, "Failed to create mission");
  if (!response.ok || !json?.success) {
    throw new Error(json?.error || "Failed to create mission");
  }
  return normalizeMission(json.mission);
}

export async function joinCuevasMission(input: {
  missionId: string;
  userEmail?: string | null;
  userHandle?: string | null;
}): Promise<{ missionId: string; goingCount: number; alreadyJoined?: boolean }> {
  const response = await fetch(`${BASE_URL}/missionSignup`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, clientKey: CUEVAS_CLIENT_KEY }),
  });
  const json = await parseApiJson(response, "Failed to join mission");
  if (!response.ok || !json?.success) {
    throw new Error(json?.error || "Failed to join mission");
  }
  return {
    missionId: String(json.missionId || input.missionId),
    goingCount: Number(json.goingCount || 0),
    alreadyJoined: Boolean(json.alreadyJoined),
  };
}

export async function fetchMissionAttendees(missionId: string): Promise<MissionAttendee[]> {
  const response = await fetch(
    `${BASE_URL}/missionAttendees?missionId=${encodeURIComponent(missionId)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );
  const json = await parseApiJson(response, "Failed to load mission attendees");
  if (!response.ok || !json?.success) {
    throw new Error(json?.error || "Failed to load mission attendees");
  }
  return (json.attendees || []).map((item: any) => ({
    missionId: String(item?.missionId || item?.MissionId || ""),
    email: String(item?.email || item?.UserEmail || ""),
    handle: item?.handle || item?.UserHandle || "",
    status: item?.status || item?.Status || "going",
    checkedIn: Boolean(item?.checkedIn ?? item?.CheckedIn ?? false),
    awardedPoints: Number(item?.awardedPoints ?? item?.AwardedPoints ?? 0),
    checkedInAt: item?.checkedInAt || item?.CheckedInAt || "",
    missionTitle: item?.missionTitle || item?.MissionTitle || "",
    missionLocation: item?.missionLocation || item?.MissionLocation || "",
    missionEventDate: item?.missionEventDate || item?.MissionEventDate || "",
    missionEventDateISO: item?.missionEventDateISO || item?.MissionEventDateISO || "",
    missionBusinessName: item?.missionBusinessName || item?.MissionBusinessName || "",
    missionBusinessHandle: item?.missionBusinessHandle || item?.MissionBusinessHandle || "",
    missionPoints: Number(item?.missionPoints ?? item?.MissionPoints ?? 0) || undefined,
    missionDurationHours: Number(item?.missionDurationHours ?? item?.MissionDurationHours ?? 0) || undefined,
  }));
}

export async function checkInCuevasMission(input: {
  missionId: string;
  userEmail: string;
  userHandle?: string | null;
  businessHandle?: string | null;
}): Promise<{ missionId: string; email: string; awardedPoints: number; loyaltyPoints?: number; alreadyCheckedIn?: boolean }> {
  const response = await fetch(`${BASE_URL}/missionCheckIn`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, clientKey: CUEVAS_CLIENT_KEY }),
  });
  const json = await parseApiJson(response, "Failed to check in mission attendee");
  if (!response.ok || !json?.success) {
    throw new Error(json?.error || "Failed to check in mission attendee");
  }
  return {
    missionId: String(json.missionId || input.missionId),
    email: String(json.email || input.userEmail),
    awardedPoints: Number(json.awardedPoints || 0),
    loyaltyPoints: typeof json.loyaltyPoints === "number" ? json.loyaltyPoints : undefined,
    alreadyCheckedIn: Boolean(json.alreadyCheckedIn),
  };
}

export async function completeCuevasMission(input: {
  missionId: string;
  businessHandle?: string | null;
}): Promise<CuevasMission> {
  const response = await fetch(`${BASE_URL}/missionComplete`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, clientKey: CUEVAS_CLIENT_KEY }),
  });
  const json = await parseApiJson(response, "Failed to complete mission");
  if (!response.ok || !json?.success) {
    throw new Error(json?.error || "Failed to complete mission");
  }
  return normalizeMission(json.mission);
}

export async function deleteCuevasMission(input: {
  missionId: string;
  businessHandle?: string | null;
}): Promise<{ missionId: string }> {
  const response = await fetch(`${BASE_URL}/missionDelete`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, clientKey: CUEVAS_CLIENT_KEY }),
  });
  const json = await parseApiJson(response, "Failed to delete mission");
  if (!response.ok || !json?.success) {
    throw new Error(json?.error || "Failed to delete mission");
  }
  return { missionId: String(json.missionId || input.missionId) };
}

export async function fetchMissionCheckIns(input: {
  missionId?: string;
  userEmail?: string | null;
}): Promise<MissionAttendee[]> {
  const params = new URLSearchParams({ clientKey: CUEVAS_CLIENT_KEY });
  if (input.missionId) params.set("missionId", input.missionId);
  if (input.userEmail) params.set("userEmail", input.userEmail);
  const response = await fetch(`${BASE_URL}/missionCheckIns?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const json = await parseApiJson(response, "Failed to load mission check-ins");
  if (!response.ok || !json?.success) {
    throw new Error(json?.error || "Failed to load mission check-ins");
  }
  return (json.checkIns || []).map((item: any) => ({
    missionId: String(item?.missionId || item?.MissionId || ""),
    email: String(item?.email || item?.UserEmail || ""),
    handle: item?.handle || item?.UserHandle || "",
    status: item?.status || item?.Status || "checked-in",
    checkedIn: true,
    awardedPoints: Number(item?.awardedPoints ?? item?.AwardedPoints ?? 0),
    checkedInAt: item?.checkedInAt || item?.CheckedInAt || "",
    missionTitle: item?.missionTitle || item?.MissionTitle || "",
    missionLocation: item?.missionLocation || item?.MissionLocation || "",
    missionEventDate: item?.missionEventDate || item?.MissionEventDate || "",
    missionEventDateISO: item?.missionEventDateISO || item?.MissionEventDateISO || "",
    missionBusinessName: item?.missionBusinessName || item?.MissionBusinessName || "",
    missionBusinessHandle: item?.missionBusinessHandle || item?.MissionBusinessHandle || "",
    missionPoints: Number(item?.missionPoints ?? item?.MissionPoints ?? 0) || undefined,
    missionDurationHours: Number(item?.missionDurationHours ?? item?.MissionDurationHours ?? 0) || undefined,
  }));
}

export async function upsertCuevasBusinessProfile(input: {
  businessName: string;
  businessHandle: string;
  ownerEmail?: string | null;
}): Promise<{ businessName: string; businessHandle: string }> {
  const response = await fetch(`${BASE_URL}/businessProfile`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, clientKey: CUEVAS_CLIENT_KEY }),
  });
  const json = await parseApiJson(response, "Failed to save business profile");
  if (!response.ok || !json?.success) {
    throw new Error(json?.error || "Failed to save business profile");
  }
  return {
    businessName: String(json.business?.businessName || input.businessName),
    businessHandle: String(json.business?.businessHandle || input.businessHandle),
  };
}

export async function submitMissionProof(input: MissionProofInput): Promise<{ proofId: string; mediaUrl: string }> {
  const response = await fetch(`${BASE_URL}/missionProof`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, clientKey: CUEVAS_CLIENT_KEY }),
  });
  const json = await parseApiJson(response, "Failed to save mission proof");
  if (!response.ok || !json?.success) {
    throw new Error(json?.error || "Failed to save mission proof");
  }
  return {
    proofId: String(json.proof?.id || json.proof?._id || ""),
    mediaUrl: String(json.proof?.mediaUrl || input.mediaUrl),
  };
}

export async function fetchMissionProofs(input: {
  missionId?: string;
  userEmail?: string | null;
  businessHandle?: string | null;
}): Promise<MissionProof[]> {
  const params = new URLSearchParams({ clientKey: CUEVAS_CLIENT_KEY });
  if (input.missionId) params.set("missionId", input.missionId);
  if (input.userEmail) params.set("userEmail", input.userEmail);
  if (input.businessHandle) params.set("businessHandle", input.businessHandle);
  const response = await fetch(`${BASE_URL}/missionProofs?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const json = await parseApiJson(response, "Failed to load mission proofs");
  if (!response.ok || !json?.success) {
    throw new Error(json?.error || "Failed to load mission proofs");
  }
  return (json.proofs || []).map((item: any) => ({
    id: String(item?.id || item?._id || ""),
    missionId: String(item?.missionId || item?.MissionId || ""),
    missionTitle: item?.missionTitle || item?.MissionTitle || "",
    userEmail: item?.userEmail || item?.UserEmail || "",
    userHandle: item?.userHandle || item?.UserHandle || "",
    businessHandle: item?.businessHandle || item?.BusinessHandle || "",
    mediaUrl: String(item?.mediaUrl || item?.MediaUrl || ""),
    mediaType: String(item?.mediaType || item?.MediaType || "image").toLowerCase() === "video" ? "video" : "image",
    status: item?.status || item?.Status || "submitted",
    submittedAt: item?.submittedAt || item?.SubmittedAt || "",
  }));
}

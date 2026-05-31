const BASE_URL = "https://www.ecothot.com/_functions";
const CUEVAS_CLIENT_KEY = "ecothot-super-secret-9384fjksd";

export type MissionType = "One time" | "Recurring" | "Weekly" | "Monthly";
export type MissionDifficulty = "Easy" | "Medium" | "High impact";

export interface CuevasMission {
  id: string;
  title: string;
  points: number;
  location: string;
  eventDate: string;
  eventDateISO?: string;
  type: MissionType;
  description: string;
  difficulty: MissionDifficulty;
  peopleNeeded?: string;
  gearProvided?: boolean;
  materialsNote?: string;
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
  type: MissionType;
  difficulty: MissionDifficulty;
  points: number;
  peopleNeeded: string;
  gearProvided: boolean;
  materialsNote?: string;
  businessName: string;
  businessHandle: string;
  businessVerified?: boolean;
  contactEmail?: string | null;
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
  return {
    id: String(item?._id || item?.id || item?.missionId || `mission-${Date.now()}`),
    title: item?.title || item?.Title || item?.EventName || item?.eventName || "Untitled Mission",
    points: Number(item?.points ?? item?.Points ?? item?.Cuevas ?? 100),
    location: item?.location || item?.Location || "Location TBD",
    eventDate: typeof eventDate === "string" ? eventDate : new Date(eventDate).toLocaleDateString(),
    eventDateISO:
      item?.eventDateISO ||
      item?.EventDateISO ||
      eventDateISO,
    type: item?.type || item?.Type || "One time",
    description: item?.description || item?.Description || "Mission details coming soon.",
    difficulty: item?.difficulty || item?.Difficulty || "Easy",
    peopleNeeded: item?.peopleNeeded || item?.PeopleNeeded || "",
    gearProvided: Boolean(item?.gearProvided ?? item?.GearProvided ?? false),
    materialsNote: item?.materialsNote || item?.MaterialsNote || "",
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
  const json = await response.json();
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
  const json = await response.json();
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
  const json = await response.json();
  if (!response.ok || !json?.success) {
    throw new Error(json?.error || "Failed to join mission");
  }
  return {
    missionId: String(json.missionId || input.missionId),
    goingCount: Number(json.goingCount || 0),
    alreadyJoined: Boolean(json.alreadyJoined),
  };
}

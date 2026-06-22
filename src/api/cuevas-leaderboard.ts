const BASE_URL = "https://www.ecothot.com/_functions";
const CUEVAS_CLIENT_KEY = "ecothot-super-secret-9384fjksd";

export interface CuevasLeaderboardEntry {
  rank: number;
  name: string;
  email?: string;
  points: number;
  badge?: string;
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

export async function fetchCuevasLeaderboard(limit = 50): Promise<CuevasLeaderboardEntry[]> {
  const params = new URLSearchParams({
    clientKey: CUEVAS_CLIENT_KEY,
    limit: String(Math.max(1, Math.min(100, Math.round(limit)))),
  });
  const response = await fetch(`${BASE_URL}/cuevasLeaderboard?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const json = await parseApiJson(response, "Failed to load Cuevas leaderboard");
  if (!response.ok || !json?.success) {
    throw new Error(json?.error || "Failed to load Cuevas leaderboard");
  }
  return (json.leaderboard || []).map((item: any, index: number) => ({
    rank: Number(item?.rank || index + 1),
    name: String(item?.name || item?.displayName || item?.handle || item?.email?.split?.("@")?.[0] || "cuevas-member"),
    email: item?.email ? String(item.email) : undefined,
    points: Number(item?.points ?? item?.loyaltyPoints ?? item?.cuevas ?? 0) || 0,
    badge: item?.badge ? String(item.badge) : undefined,
  }));
}

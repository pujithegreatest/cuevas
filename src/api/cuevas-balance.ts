const BASE_URL = "https://www.ecothot.com/_functions";
const CUEVAS_CLIENT_KEY = "ecothot-super-secret-9384fjksd";

export async function fetchCuevasBalance(email?: string | null): Promise<number | null> {
  if (!email) return null;
  const params = new URLSearchParams({
    email,
    clientKey: CUEVAS_CLIENT_KEY,
  });
  const response = await fetch(`${BASE_URL}/cuevasBalance?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const text = await response.text();
  if (!text.trim()) return null;
  const json = JSON.parse(text);
  if (!response.ok || !json?.success) {
    throw new Error(json?.error || "Failed to refresh Cuevas balance");
  }
  const balance = Number(json.cuevas ?? json.loyaltyPoints ?? 0);
  return Number.isFinite(balance) ? balance : null;
}

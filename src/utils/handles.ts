export function normalizeHandle(value?: string | null, fallback = "guest") {
  const normalized = String(value || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "");
  return normalized || fallback;
}

export function emailLocalPart(email?: string | null) {
  return String(email || "").split("@")[0] || "";
}

export function displayUsername(
  displayName?: string | null,
  email?: string | null,
  fallback = "Guest"
) {
  const trimmed = String(displayName || "").trim();
  if (trimmed) return trimmed;
  const local = emailLocalPart(email).trim();
  return local || fallback;
}

export function deriveHandle(
  explicitHandle?: string | null,
  displayName?: string | null,
  email?: string | null
) {
  return normalizeHandle(explicitHandle || displayName || emailLocalPart(email));
}

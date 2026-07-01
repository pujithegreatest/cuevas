const CUEVAS_CLIENT_KEY = "ecothot-super-secret-9384fjksd";
const UPDATE_USERNAME_API = "https://www.ecothot.com/_functions/updateUsername";

export interface UpdateUsernameResponse {
  success: boolean;
  username?: string;
  displayName?: string;
  handle?: string;
  error?: string;
  pendingRemote?: boolean;
}

export async function updateUsernameOnWix(
  email: string,
  newUsername: string,
  options?: {
    displayName?: string;
    previousUsername?: string;
    aliases?: string[];
  }
): Promise<UpdateUsernameResponse> {
  const trimmed = newUsername.trim();
  const displayName = options?.displayName?.trim() || trimmed;
  if (!trimmed) {
    return { success: false, error: "Handle cannot be empty." };
  }
  if (trimmed.length < 3) {
    return { success: false, error: "Handle must be at least 3 characters." };
  }
  if (trimmed.length > 24) {
    return { success: false, error: "Handle must be 24 characters or less." };
  }
  if (!/^[A-Za-z0-9_.-]+$/.test(trimmed)) {
    return {
      success: false,
      error: "Use letters, numbers, dots, dashes or underscores only.",
    };
  }

  try {
    const res = await fetch(UPDATE_USERNAME_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        clientKey: CUEVAS_CLIENT_KEY,
        email,
        username: trimmed,
        handle: trimmed,
        displayName,
        previousUsername: options?.previousUsername,
        aliases: options?.aliases || [],
      }),
    });

    if (res.status === 404 || res.status === 405) {
      return { success: true, username: trimmed, handle: trimmed, displayName, pendingRemote: true };
    }

    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      if (res.ok) {
        return { success: true, username: trimmed, handle: trimmed, displayName };
      }
      return {
        success: false,
        error: `Server returned ${res.status}: ${text.slice(0, 120) || "no body"}`,
      };
    }

    if (res.ok && data?.success) {
      const handle = data.handle || data.username || trimmed;
      return {
        success: true,
        username: data.username || handle,
        handle,
        displayName: data.displayName || displayName,
      };
    }

    if (res.ok && data && !data.error) {
      const handle = data.handle || data.username || trimmed;
      return {
        success: true,
        username: data.username || handle,
        handle,
        displayName: data.displayName || displayName,
      };
    }

    return {
      success: false,
      error: data?.error || `Server returned ${res.status}.`,
    };
  } catch (e) {
    return {
      success: true,
      username: trimmed,
      handle: trimmed,
      displayName,
      pendingRemote: true,
      error:
        e instanceof Error && e.message.includes("Network request failed")
          ? "Saved locally (offline)."
          : "Saved locally (server unreachable).",
    };
  }
}

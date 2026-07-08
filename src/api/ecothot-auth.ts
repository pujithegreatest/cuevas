// Use the client key directly - it's hardcoded since it's needed for API auth
import { normalizeHandle } from "../utils/handles";

const CUEVAS_CLIENT_KEY = "ecothot-super-secret-9384fjksd";

interface LoginRequest {
  clientKey: string;
  email: string;
  password: string;
}

interface SignupRequest extends LoginRequest {
  displayName: string;
  handle?: string;
}

interface GoogleLoginRequest {
  clientKey: string;
  email: string;
  googleToken: string;
  displayName?: string;
  handle?: string;
}

interface AppleLoginRequest {
  clientKey: string;
  email?: string;
  appleUserId: string;
  appleIdentityToken?: string | null;
  displayName?: string;
  handle?: string;
}

interface LoginResponse {
  success: boolean;
  email?: string;
  cuevas?: number;
  displayName?: string;
  handle?: string;
  error?: string;
}

/**
 * Login to Cuevas API
 * @param email - User's email
 * @param password - User's password
 * @returns LoginResponse object with success status and balance or error
 */
export async function loginToEcothot(
  email: string,
  password: string
): Promise<LoginResponse> {
  try {
    // Verify clientKey is available
    if (!CUEVAS_CLIENT_KEY) {
      return {
        success: false,
        error: "Configuration error: Missing client key. Please restart the app.",
      };
    }

    const requestBody: LoginRequest = {
      clientKey: CUEVAS_CLIENT_KEY,
      email: email,
      password: password,
    };

    const response = await fetch("https://www.ecothot.com/_functions/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    // Check if the response is ok
    if (!response.ok) {
      // Try to get error details from response
      const responseText = await response.text();
      let errorMessage = `Server error (${response.status})`;

      // Try to parse error details
      if (responseText) {
        try {
          const errorData = JSON.parse(responseText);
          if (errorData.error) {
            errorMessage = errorData.error;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // If not JSON, show first 100 chars of response
          if (responseText.length > 0) {
            errorMessage = `${errorMessage}: ${responseText.substring(0, 100)}`;
          }
        }
      }

      return {
        success: false,
        error: errorMessage,
      };
    }

    // Get response text first to check if it's empty
    const responseText = await response.text();

    if (!responseText || responseText.trim() === "") {
      return {
        success: false,
        error: "Server returned empty response. Please try again.",
      };
    }

    // Try to parse JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      return {
        success: false,
        error: "Invalid server response. Please try again.",
      };
    }

    // API returns success flag and either cuevas balance or error message
    if (data.success) {
      return {
        success: true,
        email: data.email || email,
        cuevas: data.cuevas,
        displayName: data.displayName,
        handle: data.handle || data.username,
      };
    } else {
      return {
        success: false,
        error: data.error || "Login failed. Please check your credentials.",
      };
    }
  } catch (error) {
    // Log error for debugging but don't expose to user
    if (error instanceof Error) {
      // Check for network-specific errors
      if (error.message.includes("Network request failed")) {
        return {
          success: false,
          error: "No internet connection. Please check your network.",
        };
      }
    }

    return {
      success: false,
      error: "Unable to connect to server. Please try again.",
    };
  }
}

export async function signupToCuevas(
  email: string,
  password: string,
  displayName: string
): Promise<LoginResponse> {
  try {
    if (!CUEVAS_CLIENT_KEY) {
      return {
        success: false,
        error: "Configuration error: Missing client key. Please restart the app.",
      };
    }

    const requestBody: SignupRequest = {
      clientKey: CUEVAS_CLIENT_KEY,
      email,
      password,
      displayName,
      handle: normalizeHandle(displayName || email),
    };

    const response = await fetch("https://www.ecothot.com/_functions/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    let data: any = {};
    if (responseText && responseText.trim()) {
      try {
        data = JSON.parse(responseText);
      } catch {
        return {
          success: false,
          error: `Invalid server response (${response.status}). Please try again.`,
        };
      }
    }

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || `Server error (${response.status})`,
      };
    }

    return {
      success: true,
      email: data.email || email,
      cuevas: data.cuevas,
      displayName: data.displayName,
      handle: data.handle || data.username,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Network request failed")) {
      return {
        success: false,
        error: "No internet connection. Please check your network.",
      };
    }

    return {
      success: false,
      error: "Unable to connect to server. Please try again.",
    };
  }
}

/**
 * Login to Cuevas API using Google authentication
 * @param email - User's Google email
 * @param googleToken - Google ID token
 * @returns LoginResponse object with success status and balance or error
 */
export async function loginWithGoogle(
  email: string,
  googleToken: string,
  displayName?: string
): Promise<LoginResponse> {
  try {
    if (!CUEVAS_CLIENT_KEY) {
      return {
        success: false,
        error: "Configuration error: Missing client key. Please restart the app.",
      };
    }

    const requestBody: GoogleLoginRequest = {
      clientKey: CUEVAS_CLIENT_KEY,
      email: email,
      googleToken: googleToken,
      displayName,
      handle: displayName ? normalizeHandle(displayName) : undefined,
    };

    // Use the existing login endpoint since it supports the same logic
    const response = await fetch("https://www.ecothot.com/_functions/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const responseText = await response.text();
      let errorMessage = `Server error (${response.status})`;

      if (responseText) {
        try {
          const errorData = JSON.parse(responseText);
          if (errorData.error) {
            errorMessage = errorData.error;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          if (responseText.length > 0) {
            errorMessage = `${errorMessage}: ${responseText.substring(0, 100)}`;
          }
        }
      }

      return {
        success: false,
        error: errorMessage,
      };
    }

    const responseText = await response.text();

    if (!responseText || responseText.trim() === "") {
      return {
        success: false,
        error: "Server returned empty response. Please try again.",
      };
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      return {
        success: false,
        error: "Invalid server response. Please try again.",
      };
    }

    if (data.success) {
      return {
        success: true,
        email: data.email || email,
        cuevas: data.cuevas,
        displayName: data.displayName,
        handle: data.handle || data.username,
      };
    } else {
      return {
        success: false,
        error: data.error || "Google login failed. Please try again.",
      };
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Network request failed")) {
        return {
          success: false,
          error: "No internet connection. Please check your network.",
        };
      }
    }

    return {
      success: false,
      error: "Unable to connect to server. Please try again.",
    };
  }
}

export async function loginWithApple(input: {
  email?: string | null;
  appleUserId: string;
  appleIdentityToken?: string | null;
  displayName?: string | null;
}): Promise<LoginResponse> {
  try {
    if (!CUEVAS_CLIENT_KEY) {
      return {
        success: false,
        error: "Configuration error: Missing client key. Please restart the app.",
      };
    }

    const requestBody: AppleLoginRequest = {
      clientKey: CUEVAS_CLIENT_KEY,
      email: input.email?.trim().toLowerCase() || undefined,
      appleUserId: input.appleUserId,
      appleIdentityToken: input.appleIdentityToken || null,
      displayName: input.displayName?.trim() || undefined,
      handle: input.displayName ? normalizeHandle(input.displayName) : undefined,
    };
    console.log("[AppleAuth] request summary:", {
      hasEmail: Boolean(requestBody.email),
      hasAppleUserId: Boolean(requestBody.appleUserId),
      hasIdentityToken: Boolean(requestBody.appleIdentityToken),
      hasDisplayName: Boolean(requestBody.displayName),
      hasHandle: Boolean(requestBody.handle),
    });

    const response = await fetch("https://www.ecothot.com/_functions/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    let data: any = {};
    if (responseText && responseText.trim()) {
      try {
        data = JSON.parse(responseText);
      } catch {
        console.log("[AppleAuth] invalid backend response:", {
          status: response.status,
          responseText: responseText.substring(0, 200),
        });
        return {
          success: false,
          error: `Invalid server response (${response.status}). Please try again.`,
        };
      }
    }
    console.log("[AppleAuth] login endpoint result:", {
      ok: response.ok,
      status: response.status,
      success: Boolean(data.success),
      code: data.code,
      error: data.error,
      hasEmail: Boolean(data.email),
      hasHandle: Boolean(data.handle || data.username),
    });

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || `Server error (${response.status})`,
      };
    }

    const safeAppleFallbackEmail = input.appleUserId
      ? `apple_${input.appleUserId.replace(/[^a-z0-9]/gi, "").slice(-24) || "user"}@apple.cuevas.local`
      : undefined;

    return {
      success: true,
      email: data.email || input.email || safeAppleFallbackEmail,
      cuevas: data.cuevas,
      displayName: data.displayName,
      handle: data.handle || data.username,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Network request failed")) {
      return {
        success: false,
        error: "No internet connection. Please check your network.",
      };
    }

    return {
      success: false,
      error: "Unable to connect to server. Please try again.",
    };
  }
}

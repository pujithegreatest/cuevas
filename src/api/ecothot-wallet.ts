const BACKEND_URL = "https://us-central1-ecothot-social-media.cloudfunctions.net";

export type WalletGenerateResponse =
  | { success: true; applePassUrl?: string; googleSaveUrl?: string }
  | { success: false; error: string; missingConfig?: boolean };

export async function generateWalletLinks(params: {
  email: string;
  rewardsBalance?: number;
  memberDisplayName?: string;
}): Promise<WalletGenerateResponse> {
  const tag = "[WALLET_API]";
  try {
    if (!params?.email) {
      return { success: false, error: "Missing email." };
    }

    console.log(tag, "POST walletLinks", {
      email: params.email,
      rewardsBalance: params.rewardsBalance,
      hasMemberDisplayName: Boolean(params.memberDisplayName),
    });

    const response = await fetch(`${BACKEND_URL}/walletLinks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        email: params.email,
        rewardsBalance: typeof params.rewardsBalance === "number" ? params.rewardsBalance : 0,
        memberDisplayName: params.memberDisplayName,
      }),
    });

    const text = await response.text();
    console.log(tag, "status", response.status, "body", text?.slice?.(0, 200));

    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      return { success: false, error: `Server returned invalid response (${response.status}).` };
    }

    const applePassUrl = data?.apple?.downloadUrl;
    const googleSaveUrl = data?.google?.saveUrl;
    if (data?.success && (typeof applePassUrl === "string" || typeof googleSaveUrl === "string")) {
      return { success: true, applePassUrl, googleSaveUrl };
    }

    return {
      success: false,
      error: data?.error || `Server error (${response.status}).`,
      missingConfig: !!data?.missingConfig,
    };
  } catch (e) {
    console.log(tag, "fatal", String((e as any)?.message || e));
    return { success: false, error: "Unable to connect to wallet server. Please try again." };
  }
}

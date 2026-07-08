import { Alert, Linking, Platform } from "react-native";
import { generateWalletLinks } from "../api/ecothot-wallet";

export async function addRewardsCardToWallet(params: {
  email: string | null;
  rewardsBalance?: number;
  memberDisplayName?: string;
}) {
  const tag = "[WALLET]";
  try {
    const email = (params.email || "").trim();
    if (!email) {
      Alert.alert("Not logged in", "Please log in first, then try again.");
      return false;
    }

    const res = await generateWalletLinks({
      email,
      rewardsBalance: params.rewardsBalance,
      memberDisplayName: params.memberDisplayName,
    });

    if (!res.success) {
      if (res.missingConfig) {
        Alert.alert(
          "Wallet not configured yet",
          "The Apple Wallet certificate is not set up on the server. Please check the backend configuration."
        );
      } else {
        Alert.alert("Wallet error", res.error || "Unable to create wallet pass.");
      }
      return false;
    }

    const walletUrl = Platform.select({
      ios: res.applePassUrl,
      android: res.googleSaveUrl,
      default: res.googleSaveUrl || res.applePassUrl,
    });

    if (!walletUrl) {
      Alert.alert(
        "Wallet not configured yet",
        Platform.OS === "android"
          ? "Google Wallet is not set up on the server yet."
          : "Apple Wallet is not set up on the server yet."
      );
      return false;
    }

    console.log(tag, "opening wallet URL", { platform: Platform.OS, walletUrl });
    const can = await Linking.canOpenURL(walletUrl);
    if (!can) {
      Alert.alert("Cannot open Wallet", "Your device could not open the wallet URL.");
      return false;
    }
    await Linking.openURL(walletUrl);
    return true;
  } catch (e) {
    console.log("[WALLET] error", String((e as any)?.message || e));
    Alert.alert("Wallet error", "Something went wrong while adding your card to Wallet.");
    return false;
  }
}

import { useCallback, useEffect } from "react";
import { AppState } from "react-native";
import { fetchCuevasBalance } from "../api/cuevas-balance";
import { useAppStore } from "../state/appStore";

export function useCuevasBalanceSync(intervalMs = 10000) {
  const userEmail = useAppStore((state) => state.userEmail);
  const setRewardsBalance = useAppStore((state) => state.setRewardsBalance);

  const refreshBalance = useCallback(async () => {
    try {
      const balance = await fetchCuevasBalance(userEmail);
      if (typeof balance === "number") {
        setRewardsBalance(balance);
      }
    } catch (error) {
      console.log("[BALANCE] refresh failed", String((error as any)?.message || error));
    }
  }, [setRewardsBalance, userEmail]);

  useEffect(() => {
    if (!userEmail) return;
    refreshBalance();
    const timer = setInterval(refreshBalance, intervalMs);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshBalance();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [intervalMs, refreshBalance, userEmail]);
}

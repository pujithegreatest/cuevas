import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Image as RNImage, ScrollView, Modal, RefreshControl } from "react-native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { MainTabParamList } from "../types/navigation";
import { useAppStore } from "../state/appStore";
import { Ionicons } from "../components/Ionicons";
import ViewShot from "react-native-view-shot";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { sharePngUriToInstagramStory } from "../utils/instagramStories";
import { addRewardsCardToWallet } from "../utils/walletAdd";
import { QRCodeDisplay } from "../components/QRCodeDisplay";
import { fetchCuevasLeaderboard } from "../api/cuevas-leaderboard";
import type { CuevasLeaderboardEntry } from "../api/cuevas-leaderboard";

type Props = BottomTabScreenProps<MainTabParamList, "RewardsBalance">;

export default function RewardsBalanceScreen({ navigation }: Props) {
  const viewShotRef = useRef<ViewShot>(null);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [leaderboard, setLeaderboard] = useState<CuevasLeaderboardEntry[]>([]);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const rewardsBalance = useAppStore((s) => s.rewardsBalance);
  const userEmail = useAppStore((s) => s.userEmail);
  const isDarkMode = useAppStore((s) => s.isDarkMode);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);
  const logout = useAppStore((s) => s.logout);

  const handleExport = async () => {
    try {
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        return;
      }

      // Capture the balance display
      if (viewShotRef.current && viewShotRef.current.capture) {
        const uri = await viewShotRef.current.capture();

        // Save to library or share
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: "image/png",
            dialogTitle: "Share Rewards Balance",
          });
        } else {
          await MediaLibrary.createAssetAsync(uri);
        }
      }
    } catch (error) {
      console.error("Error exporting:", error);
    }
  };

  const handleShareToInstagramStory = async () => {
    try {
      if (viewShotRef.current && viewShotRef.current.capture) {
        const uri = await viewShotRef.current.capture();
        const ok = await sharePngUriToInstagramStory(uri, {
          debugTag: "REWARDS",
          attributionURL: "https://www.ecothot.com/",
        });
        if (!ok && (await Sharing.isAvailableAsync())) {
          await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share Rewards Balance" });
        }
      }
    } catch (e) {
      console.log("[REWARDS] IG story share failed", String((e as any)?.message || e));
    }
  };

  const handleLogout = () => {
    // Just logout - navigation will happen automatically
    // via conditional rendering in RootNavigator
    logout();
  };

  const handleAddToWallet = async () => {
    console.log("[REWARDS] addToWallet tapped", { userEmail, rewardsBalance });
    await addRewardsCardToWallet({ email: userEmail, rewardsBalance });
  };

  const loadLeaderboard = useCallback(async () => {
    setRefreshing(true);
    try {
      const entries = await fetchCuevasLeaderboard(50);
      setLeaderboard(entries);
      setLeaderboardError(null);
    } catch (error) {
      console.log("[REWARDS] leaderboard sync failed", String((error as any)?.message || error));
      setLeaderboard([]);
      setLeaderboardError("Leaderboard sync failed. Pull down to retry.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (leaderboardOpen) {
      loadLeaderboard();
    }
  }, [leaderboardOpen, loadLeaderboard]);

  return (
    <LinearGradient
      colors={isDarkMode ? ["#1a1a1a", "#0a0a0a"] : ["#CFEFEC", "#A8D5D3"]}
      style={{ flex: 1 }}
    >
      {/* Header - fixed above scroll */}
      <View
        className="flex-row justify-between items-center px-6 pb-4"
        style={{ paddingTop: 56 }}
      >
        <Pressable
          onPress={handleLogout}
          className="p-2"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Ionicons
            name="log-out-outline"
            size={24}
            color={isDarkMode ? "#CFEFEC" : "#80171F"}
          />
        </Pressable>

        <Text
          className={`text-2xl font-bold ${
            isDarkMode ? "text-dark-text" : "text-pixel-text"
          }`}
        >
          Rewards
        </Text>

        <Pressable
          onPress={toggleDarkMode}
          className="p-2"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Ionicons
            name={isDarkMode ? "sunny" : "moon"}
            size={24}
            color={isDarkMode ? "#CFEFEC" : "#80171F"}
          />
        </Pressable>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        contentContainerStyle={{ alignItems: "center", paddingHorizontal: 24, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Coin Image */}
        <Image
          source={require("../../assets/coin.gif")}
          style={{ width: 160, height: 160, marginTop: 8, marginBottom: 28 }}
          contentFit="contain"
        />

        {/* Balance Card */}
        <View
          className={`w-full rounded-3xl p-8 mb-8 ${
            isDarkMode ? "bg-dark-surface" : "bg-white"
          }`}
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 5,
          }}
        >
          <Text
            className={`text-sm text-center mb-2 uppercase tracking-wider ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Your Balance
          </Text>
          <Text
            className={`text-6xl font-bold text-center ${
              isDarkMode ? "text-dark-accent" : "text-pixel-text"
            }`}
          >
            {rewardsBalance.toLocaleString()}
          </Text>
          <Text
            className={`text-2xl text-center mt-2 ${
              isDarkMode ? "text-dark-text" : "text-pixel-teal"
            }`}
          >
            CUEVAS
          </Text>
        </View>

        {/* Account QR Code */}
        {userEmail ? (
          <View
            className={`w-full rounded-3xl p-6 mb-8 items-center ${
              isDarkMode ? "bg-dark-surface" : "bg-white"
            }`}
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 5,
            }}
          >
            <Text
              className={`text-sm mb-4 uppercase tracking-wider ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}
            >
              Your Account Code
            </Text>
            <QRCodeDisplay
              value={userEmail}
              size={180}
              color={isDarkMode ? "#CFEFEC" : "#1a1a1a"}
              backgroundColor={isDarkMode ? "#1e1e1e" : "#FFFFFF"}
            />
          </View>
        ) : null}

        {/* Export Button */}
        <Pressable
          onPress={handleExport}
          className={`py-4 px-12 rounded-full ${
            isDarkMode ? "bg-dark-accent" : "bg-pixel-teal"
          }`}
          style={({ pressed }) => ({
            opacity: pressed ? 0.8 : 1,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 3,
          })}
        >
          <Text
            className="text-base font-semibold"
            style={{ color: isDarkMode ? "#FFFFFF" : "#10252B" }}
          >
            Save as PNG
          </Text>
        </Pressable>

        {/* Share to Instagram Stories (new, does not change Export) */}
        <Pressable
          onPress={handleShareToInstagramStory}
          className={`mt-4 py-4 px-12 rounded-full border ${
            isDarkMode ? "border-gray-700 bg-dark-surface" : "border-gray-200 bg-white"
          }`}
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <View className="flex-row items-center justify-center">
            <Ionicons name="logo-instagram" size={20} color={isDarkMode ? "#CFEFEC" : "#1F2937"} />
            <Text className={`ml-2 text-base font-semibold ${isDarkMode ? "text-dark-text" : "text-pixel-text"}`}>
              Share to IG Story
            </Text>
          </View>
        </Pressable>

        {/* Add to Wallet (Apple Wallet / Google Wallet) */}
        <Pressable
          onPress={handleAddToWallet}
          className={`mt-4 py-4 px-12 rounded-full border ${
            isDarkMode ? "border-gray-700 bg-dark-surface" : "border-gray-200 bg-white"
          }`}
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <View className="flex-row items-center justify-center">
            <Ionicons name="wallet-outline" size={20} color={isDarkMode ? "#CFEFEC" : "#1F2937"} />
            <Text className={`ml-2 text-base font-semibold ${isDarkMode ? "text-dark-text" : "text-pixel-text"}`}>
              Add card to Wallet
            </Text>
          </View>
        </Pressable>

        {/* View Crypto Stock */}
        <Pressable
          onPress={() => setLeaderboardOpen(true)}
          className={`mt-4 py-4 px-12 rounded-full ${
            isDarkMode ? "bg-dark-surface border border-dark-accent" : "bg-white border border-gray-200"
          }`}
          style={({ pressed }) => ({
            opacity: pressed ? 0.8 : 1,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 3,
          })}
        >
          <View className="flex-row items-center justify-center">
            <Ionicons name="trophy" size={20} color="#FFD700" />
            <Text className={`ml-2 text-base font-semibold ${isDarkMode ? "text-dark-text" : "text-pixel-text"}`}>
              View Leaderboard
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => navigation.getParent()?.navigate("StockBalance" as never)}
          className={`mt-4 py-4 px-12 rounded-full ${
            isDarkMode ? "bg-dark-surface border border-dark-accent" : "bg-pixel-text"
          }`}
          style={({ pressed }) => ({
            opacity: pressed ? 0.8 : 1,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 3,
          })}
        >
          <View className="flex-row items-center justify-center">
            <Ionicons name="trending-up" size={20} color={isDarkMode ? "#06A7A1" : "#CFEFEC"} />
            <Text
              className="ml-2 text-base font-semibold"
              style={{ color: isDarkMode ? "#06A7A1" : "#CFEFEC" }}
            >
              View Crypto Stock
            </Text>
          </View>
        </Pressable>
      </ScrollView>

      <Modal
        visible={leaderboardOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setLeaderboardOpen(false)}
      >
        <LinearGradient
          colors={isDarkMode ? ["#081920", "#0A0A0A"] : ["#CFEFEC", "#F7FFFF"]}
          style={{ flex: 1 }}
        >
          <View
            className={`flex-row items-center justify-between px-5 pb-4 border-b ${
              isDarkMode ? "border-gray-800" : "border-gray-200"
            }`}
            style={{ paddingTop: 56 }}
          >
            <Pressable onPress={() => setLeaderboardOpen(false)} hitSlop={10}>
              <Ionicons name="close" size={26} color={isDarkMode ? "#CFEFEC" : "#1F2937"} />
            </Pressable>
            <Text className={`text-lg font-bold ${isDarkMode ? "text-dark-text" : "text-pixel-text"}`}>
              Cuevas Leaderboard
            </Text>
            <Ionicons name="trophy" size={24} color="#FFD700" />
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={loadLeaderboard}
                tintColor="#06A7A1"
              />
            }
          >
            <LinearGradient
              colors={isDarkMode ? ["rgba(6,167,161,0.24)", "rgba(128,23,31,0.18)"] : ["#FFFFFF", "#E8FFFC"]}
              style={{
                borderRadius: 26,
                padding: 18,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: "rgba(6,167,161,0.28)",
              }}
            >
              <Text className={`text-2xl font-black ${isDarkMode ? "text-dark-text" : "text-pixel-text"}`}>
                Top Cuevas Holders
              </Text>
              <Text className={`mt-1 text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                Live ranking from current reward balances and mission activity.
              </Text>
            </LinearGradient>

            {leaderboardError ? (
              <View className={`rounded-3xl p-4 mb-3 border ${isDarkMode ? "bg-dark-surface border-gray-800" : "bg-white border-gray-200"}`}>
                <Text className={`text-base font-bold ${isDarkMode ? "text-dark-text" : "text-pixel-text"}`}>Could not load leaderboard.</Text>
                <Text className={`text-sm mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>{leaderboardError}</Text>
              </View>
            ) : null}

            {!leaderboardError && leaderboard.length === 0 ? (
              <View className={`rounded-3xl p-4 border ${isDarkMode ? "bg-dark-surface border-gray-800" : "bg-white border-gray-200"}`}>
                <Text className={`text-base font-bold ${isDarkMode ? "text-dark-text" : "text-pixel-text"}`}>No ranked holders yet.</Text>
                <Text className={`text-sm mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>Complete or check into a mission to appear here.</Text>
              </View>
            ) : leaderboard.map((entry) => (
              <View
                key={entry.name}
                className={`rounded-3xl p-4 mb-3 border ${
                  isDarkMode ? "bg-dark-surface border-gray-800" : "bg-white border-gray-200"
                }`}
                style={{
                  shadowColor: "#000",
                  shadowOpacity: isDarkMode ? 0.22 : 0.10,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 3,
                }}
              >
                <View className="flex-row items-center">
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 16,
                      backgroundColor: entry.rank === 1 ? "#FFD700" : "#06A7A1",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <Text style={{ color: entry.rank === 1 ? "#1F2937" : "#FFFFFF", fontWeight: "900" }}>
                      #{entry.rank}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className={`text-lg font-black ${isDarkMode ? "text-dark-text" : "text-pixel-text"}`}>
                      {entry.name.replace(/^@+/, "")}
                    </Text>
                    <Text className={`text-xs mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                      {entry.badge}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-dark-accent text-xl font-black">
                      {entry.points}
                    </Text>
                    <Text className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                      CUEVAS
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </LinearGradient>
      </Modal>

      {/* Hidden ViewShot for export */}
      <View style={{ position: "absolute", left: -9999 }}>
        <ViewShot
          ref={viewShotRef}
          options={{ format: "png", quality: 1.0, result: "tmpfile" }}
        >
          <LinearGradient
            colors={isDarkMode ? ["#1a1a1a", "#2d1f3d", "#1a1a1a"] : ["#CFEFEC", "#A8D5D3", "#7EC8C8", "#CFEFEC"]}
          style={{
            width: 1080,
            height: 1920,
            alignItems: "center",
            justifyContent: "center",
            padding: 60,
          }}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        >
          <View style={{ alignItems: "center" }}>
              {/* Static Coin Image for export */}
              <RNImage
              source={require("../../assets/image-1764330193.png")}
              style={{ width: 300, height: 300, marginBottom: 60 }}
              resizeMode="contain"
            />

            {/* Balance Display */}
            <Text
              style={{
                fontFamily: "Courier New",
                fontSize: 32,
                color: isDarkMode ? "#CFEFEC" : "#3D3737",
                marginBottom: 20,
              }}
            >
              YOUR BALANCE
            </Text>
            <Text
              style={{
                fontFamily: "Courier New",
                fontSize: 120,
                fontWeight: "bold",
                color: isDarkMode ? "#06A7A1" : "#80171F",
                marginBottom: 20,
              }}
            >
              {rewardsBalance}
            </Text>
            <Text
              style={{
                fontFamily: "Courier New",
                fontSize: 48,
                color: isDarkMode ? "#CFEFEC" : "#06A7A1",
                marginBottom: 80,
              }}
            >
              CUEVAS
            </Text>

            {/* Footer */}
            <Text
              style={{
                fontFamily: "Courier New",
                fontSize: 24,
                color: isDarkMode ? "#06A7A1" : "#3D3737",
                marginTop: 40,
              }}
            >
              apps by ecothot
            </Text>
          </View>
          </LinearGradient>
        </ViewShot>
      </View>
    </LinearGradient>
  );
}

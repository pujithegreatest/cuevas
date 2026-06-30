import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { useAppStore } from "../state/appStore";
import { loginToEcothot, loginWithApple, loginWithGoogle, signupToCuevas } from "../api/ecothot-auth";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import { Ionicons } from "../components/Ionicons";
import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";

// Required for Google auth to work properly on web
WebBrowser.maybeCompleteAuthSession();

// Get Google auth credentials from app.json extra
// Try multiple locations for config as it varies by environment
const manifestExtra = (Constants as any).manifest?.extra;
const extra = Constants.expoConfig?.extra || manifestExtra || {};

const GOOGLE_IOS_CLIENT_ID = extra.googleIosClientId || "863626649134-qti4ohta0m03uhaetm4l8urra7s66d0m.apps.googleusercontent.com";
const GOOGLE_ANDROID_CLIENT_ID = extra.googleAndroidClientId || "";
const GOOGLE_WEB_CLIENT_ID = extra.googleWebClientId || "863626649134-pudh60mc0rcu9lpil92a6b6861kqaki5.apps.googleusercontent.com";

// Debug: Log the client IDs (remove in production)
console.log("Google Auth Config:", {
  ios: GOOGLE_IOS_CLIENT_ID ? "✓ Set" : "✗ Missing",
  android: GOOGLE_ANDROID_CLIENT_ID ? "✓ Set" : "✗ Missing", 
  web: GOOGLE_WEB_CLIENT_ID ? "✓ Set" : "✗ Missing",
  extra: extra,
});

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

// Separate component for Google auth to avoid hook issues when not configured
function GoogleAuthButton({
  isDarkMode,
  isLoading,
  onLoginSuccess,
  onError,
}: {
  isDarkMode: boolean;
  isLoading: boolean;
  onLoginSuccess: (email: string, cuevas: number, displayName?: string) => void;
  onError: (error: string) => void;
}) {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);

  const redirectUri = Platform.select({
    ios: "com.googleusercontent.apps.863626649134-qti4ohta0m03uhaetm4l8urra7s66d0m:/oauth2redirect/google",
    android: "com.googleusercontent.apps.863626649134-t9glfa6lnl1s1t840s7n1u9olgmkok5l:/oauth2redirect/google",
    default: undefined,
  });

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    redirectUri,
  });

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    AppleAuthentication.isAvailableAsync()
      .then(setIsAppleAvailable)
      .catch(() => setIsAppleAvailable(false));
  }, []);

  // Debug: Log the redirect URI
  useEffect(() => {
    if (request) {
      console.log("Redirect URI:", request.redirectUri);
    }
  }, [request]);

  useEffect(() => {
    if (response?.type === "success") {
      console.log("Google auth response:", {
        hasAuthAccessToken: Boolean(response.authentication?.accessToken),
        hasParamAccessToken: Boolean(response.params?.access_token),
        hasIdToken: Boolean(response.params?.id_token),
        params: Object.keys(response.params || {}),
      });
      handleGoogleLogin(
        response.authentication?.accessToken ||
          response.params?.access_token ||
          response.params?.id_token
      );
    } else if (response?.type === "error") {
      console.log("Google auth error response:", response);
      onError("Google sign-in failed. Please try again.");
      setIsGoogleLoading(false);
    } else if (response?.type === "dismiss" || response?.type === "cancel") {
      setIsGoogleLoading(false);
    }
  }, [response]);

  const handleGoogleLogin = async (accessToken: string | undefined) => {
    if (!accessToken) {
      onError("Google sign-in returned no token. Please try again.");
      setIsGoogleLoading(false);
      return;
    }

    try {
      // Get user info from Google
      const userInfoResponse = await fetch(
        "https://www.googleapis.com/userinfo/v2/me",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!userInfoResponse.ok) {
        const responseText = await userInfoResponse.text();
        console.log("Google userinfo failed:", userInfoResponse.status, responseText);
        onError("Google sign-in token could not be verified. Please try again.");
        setIsGoogleLoading(false);
        return;
      }

      const userInfo = await userInfoResponse.json();

      if (!userInfo.email) {
        onError("Could not get email from Google account.");
        setIsGoogleLoading(false);
        return;
      }

      console.log("Google Email:", userInfo.email); // Debug log

      // Login to Ecothot with Google credentials
      const echothotResponse = await loginWithGoogle(userInfo.email, accessToken, userInfo.name);

      if (echothotResponse.success && echothotResponse.cuevas !== undefined) {
        onLoginSuccess(
          echothotResponse.email || userInfo.email,
          echothotResponse.cuevas,
          echothotResponse.displayName || userInfo.name
        );
      } else {
        onError(echothotResponse.error || "Google login failed. Please try again.");
      }
    } catch (err) {
      console.log("Google login error:", err);
      onError("An unexpected error occurred. Please try again.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGooglePress = async () => {
    onError("");
    setIsGoogleLoading(true);
    try {
      const result = await promptAsync();
      if (result.type !== "success") {
        setIsGoogleLoading(false);
      }
    } catch (err) {
      console.log("Google prompt error:", err);
      onError("Google sign-in failed to start. Please try again.");
      setIsGoogleLoading(false);
    }
  };

  const handleApplePress = async () => {
    onError("");
    setIsAppleLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const displayName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(" ")
        .trim();
      const cuevasResponse = await loginWithApple({
        email: credential.email,
        appleUserId: credential.user,
        appleIdentityToken: credential.identityToken,
        displayName,
      });

      if (cuevasResponse.success && cuevasResponse.cuevas !== undefined) {
        onLoginSuccess(
          cuevasResponse.email || credential.email || `apple:${credential.user}`,
          cuevasResponse.cuevas,
          cuevasResponse.displayName || displayName
        );
      } else {
        onError(cuevasResponse.error || "Apple sign-in failed. Please try again.");
      }
    } catch (err: any) {
      if (err?.code !== "ERR_REQUEST_CANCELED") {
        console.log("Apple login error:", err);
        onError("Apple sign-in failed. Please try again.");
      }
    } finally {
      setIsAppleLoading(false);
    }
  };

  return (
    <>
      {/* Divider */}
      <View className="flex-row items-center my-6">
        <View
          className={`flex-1 h-[1px] ${
            isDarkMode ? "bg-gray-600" : "bg-gray-300"
          }`}
        />
        <Text
          className={`mx-4 text-sm ${
            isDarkMode ? "text-gray-400" : "text-gray-500"
          }`}
          style={{ fontFamily: "Courier New" }}
        >
          OR
        </Text>
        <View
          className={`flex-1 h-[1px] ${
            isDarkMode ? "bg-gray-600" : "bg-gray-300"
          }`}
        />
      </View>

      {isAppleAvailable ? (
        <Pressable
          onPress={handleApplePress}
          disabled={isLoading || isAppleLoading || isGoogleLoading}
          className={`py-4 px-6 border-2 items-center flex-row justify-center mb-3 ${
            isAppleLoading
              ? isDarkMode
                ? "bg-dark-surface border-gray-600"
                : "bg-gray-100 border-gray-300"
              : "bg-black border-black"
          }`}
          style={({ pressed }) => ({
            minHeight: 54,
            borderRadius: 18,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          {isAppleLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text className="text-lg font-bold text-white" style={{ fontFamily: "Courier New" }}>
               SIGN IN WITH APPLE
            </Text>
          )}
        </Pressable>
      ) : null}

      {/* Google Sign-In Button */}
      <Pressable
        onPress={handleGooglePress}
        disabled={isLoading || isAppleLoading || isGoogleLoading || !request}
        className={`py-4 px-6 border-2 items-center flex-row justify-center ${
          isGoogleLoading || !request
            ? isDarkMode
              ? "bg-dark-surface border-gray-600"
              : "bg-gray-100 border-gray-300"
            : isDarkMode
            ? "bg-white border-white"
            : "bg-white border-pixel-black"
        }`}
        style={({ pressed }) => ({
          minHeight: 54,
          borderRadius: 18,
          shadowColor: "#000",
          shadowOpacity: isDarkMode ? 0 : 0.08,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 5 },
          elevation: 2,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        {isGoogleLoading ? (
          <ActivityIndicator size="small" color={isDarkMode ? "#666" : "#999"} />
        ) : (
          <>
            <Ionicons
              name="logo-google"
              size={20}
              color={!request ? "#999" : "#DB4437"}
              style={{ marginRight: 10 }}
            />
            <Text
              className={`text-lg font-bold ${
                !request ? "text-gray-400" : "text-gray-800"
              }`}
              style={{ fontFamily: "Courier New" }}
            >
              SIGN IN WITH GOOGLE
            </Text>
          </>
        )}
      </Pressable>
    </>
  );
}

export default function LoginScreen({ navigation }: Props) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [displayName, setDisplayNameInput] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const login = useAppStore((s) => s.login);
  const setDisplayName = useAppStore((s) => s.setDisplayName);
  const setRewardsBalance = useAppStore((s) => s.setRewardsBalance);
  const isDarkMode = useAppStore((s) => s.isDarkMode);

  const handleGoogleLoginSuccess = (userEmail: string, cuevas: number, authDisplayName?: string) => {
    setRewardsBalance(cuevas);
    if (authDisplayName?.trim()) {
      setDisplayName(authDisplayName.trim());
    }
    login(userEmail);
  };

  const handleSubmit = async () => {
    setError("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }
    if (!normalizedEmail.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }
    if (mode === "signup") {
      if (!displayName.trim()) {
        setError("Choose a display name");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
    }

    setIsLoading(true);

    try {
      const response =
        mode === "signup"
          ? await signupToCuevas(normalizedEmail, password, displayName)
          : await loginToEcothot(normalizedEmail, password);

      if (response.success && response.cuevas !== undefined) {
        setRewardsBalance(response.cuevas);
        if (response.displayName || displayName.trim()) {
          setDisplayName(response.displayName || displayName.trim());
        }
        login(normalizedEmail);
      } else {
        setError(response.error || `${mode === "signup" ? "Sign up" : "Login"} failed. Please try again.`);
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const isSignup = mode === "signup";
  const textColor = isDarkMode ? "#CFEFEC" : "#10252B";
  const mutedColor = isDarkMode ? "#9CA3AF" : "#5F6B73";
  const fieldBg = isDarkMode ? "rgba(9, 24, 30, 0.92)" : "rgba(255,255,255,0.92)";

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <LinearGradient
        colors={isDarkMode ? ["#061116", "#081920", "#0A0A0A"] : ["#CFEFEC", "#F7FFFF"]}
        style={{ flex: 1 }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, paddingVertical: 46 }}
          >
            <View style={{ alignItems: "center", marginBottom: 24 }}>
              <View
                style={{
                  width: 86,
                  height: 86,
                  borderRadius: 30,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(6,167,161,0.16)",
                  borderWidth: 1,
                  borderColor: "rgba(6,167,161,0.46)",
                  shadowColor: "#06A7A1",
                  shadowOpacity: 0.36,
                  shadowRadius: 18,
                }}
              >
                <Image source={require("../../assets/coin.gif")} style={{ width: 58, height: 58 }} contentFit="contain" />
              </View>
              <Text
                style={{
                  color: textColor,
                  fontFamily: "Courier New",
                  fontSize: 44,
                  fontWeight: "900",
                  letterSpacing: 3,
                  marginTop: 16,
                }}
              >
                CUEVAS
              </Text>
              <Text
                style={{
                  color: "#06A7A1",
                  fontFamily: "Courier New",
                  fontSize: 13,
                  fontWeight: "900",
                  letterSpacing: 2,
                  marginTop: 4,
                }}
              >
                {isSignup ? "CREATE YOUR REWARD ID" : "REWARDS LOGIN"}
              </Text>
            </View>

            <View
              style={{
                borderRadius: 30,
                borderWidth: 1,
                borderColor: "rgba(6,167,161,0.36)",
                backgroundColor: isDarkMode ? "rgba(7,18,23,0.88)" : "rgba(255,255,255,0.76)",
                padding: 18,
                shadowColor: "#06A7A1",
                shadowOpacity: isDarkMode ? 0.22 : 0.14,
                shadowRadius: 18,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  padding: 5,
                  backgroundColor: isDarkMode ? "#061116" : "#FFFFFF",
                  borderRadius: 18,
                  marginBottom: 18,
                  borderWidth: 1,
                  borderColor: isDarkMode ? "rgba(6,167,161,0.34)" : "rgba(6,167,161,0.48)",
                  gap: 6,
                }}
              >
                {(["login", "signup"] as const).map((item) => {
                  const active = mode === item;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => {
                        setMode(item);
                        setError("");
                      }}
                      style={{
                        flex: 1,
                        minHeight: 44,
                        paddingVertical: 11,
                        borderRadius: 14,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: active ? "#06A7A1" : isDarkMode ? "rgba(255,255,255,0.06)" : "#E8FFFC",
                        borderWidth: 1,
                        borderColor: active ? "#057D78" : isDarkMode ? "rgba(6,167,161,0.24)" : "rgba(6,167,161,0.30)",
                      }}
                    >
                      <Text style={{ color: active ? (isDarkMode ? "#FFFFFF" : "#10252B") : isDarkMode ? "#CFEFEC" : "#057D78", fontFamily: "Courier New", fontWeight: "900" }}>
                        {item === "login" ? "SIGN IN" : "SIGN UP"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {isSignup ? (
                <View style={{ marginBottom: 14 }}>
                  <Text style={{ color: textColor, fontFamily: "Courier New", fontSize: 12, fontWeight: "900", marginBottom: 7 }}>
                    USERNAME
                  </Text>
                  <TextInput
                    value={displayName}
                    onChangeText={setDisplayNameInput}
                    placeholder="username"
                    placeholderTextColor={isDarkMode ? "#66777A" : "#8A9A9D"}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{
                      borderWidth: 1,
                      borderColor: "rgba(6,167,161,0.45)",
                      borderRadius: 16,
                      paddingHorizontal: 14,
                      paddingVertical: 13,
                      color: textColor,
                      backgroundColor: fieldBg,
                      fontFamily: "Courier New",
                      fontSize: 15,
                    }}
                  />
                </View>
              ) : null}

              <View style={{ marginBottom: 14 }}>
                <Text style={{ color: textColor, fontFamily: "Courier New", fontSize: 12, fontWeight: "900", marginBottom: 7 }}>
                  EMAIL
                </Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your@email.com"
                  placeholderTextColor={isDarkMode ? "#66777A" : "#8A9A9D"}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    borderWidth: 1,
                    borderColor: "rgba(6,167,161,0.45)",
                    borderRadius: 16,
                    paddingHorizontal: 14,
                    paddingVertical: 13,
                    color: textColor,
                    backgroundColor: fieldBg,
                    fontFamily: "Courier New",
                    fontSize: 15,
                  }}
                />
              </View>

              <View style={{ marginBottom: isSignup ? 14 : 18 }}>
                <Text style={{ color: textColor, fontFamily: "Courier New", fontSize: 12, fontWeight: "900", marginBottom: 7 }}>
                  PASSWORD
                </Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={isDarkMode ? "#66777A" : "#8A9A9D"}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    borderWidth: 1,
                    borderColor: "rgba(6,167,161,0.45)",
                    borderRadius: 16,
                    paddingHorizontal: 14,
                    paddingVertical: 13,
                    color: textColor,
                    backgroundColor: fieldBg,
                    fontFamily: "Courier New",
                    fontSize: 15,
                  }}
                />
              </View>

              {isSignup ? (
                <View style={{ marginBottom: 18 }}>
                  <Text style={{ color: textColor, fontFamily: "Courier New", fontSize: 12, fontWeight: "900", marginBottom: 7 }}>
                    CONFIRM PASSWORD
                  </Text>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="••••••••"
                    placeholderTextColor={isDarkMode ? "#66777A" : "#8A9A9D"}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{
                      borderWidth: 1,
                      borderColor: "rgba(6,167,161,0.45)",
                      borderRadius: 16,
                      paddingHorizontal: 14,
                      paddingVertical: 13,
                      color: textColor,
                      backgroundColor: fieldBg,
                      fontFamily: "Courier New",
                      fontSize: 15,
                    }}
                  />
                </View>
              ) : null}

              {error ? (
                <View style={{ marginBottom: 14, padding: 12, borderRadius: 16, backgroundColor: "rgba(128,23,31,0.16)", borderWidth: 1, borderColor: "#80171F" }}>
                  <Text style={{ color: "#FF6B72", fontFamily: "Courier New", fontSize: 12, fontWeight: "900", marginBottom: 4 }}>
                    ERROR
                  </Text>
                  <Text style={{ color: "#FFB4B8", fontFamily: "Courier New", fontSize: 12 }}>
                    {error}
                  </Text>
                </View>
              ) : null}

              <Pressable
                onPress={handleSubmit}
                disabled={isLoading}
                style={({ pressed }) => ({
                  borderRadius: 18,
                  minHeight: 56,
                  paddingVertical: 15,
                  paddingHorizontal: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isLoading ? "rgba(6,167,161,0.34)" : "#06A7A1",
                  borderWidth: 2,
                  borderColor: isDarkMode ? "#39D8D0" : "#057D78",
                  shadowColor: "#06A7A1",
                  shadowOpacity: 0.24,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 4,
                  opacity: pressed || isLoading ? 0.72 : 1,
              })}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name={isSignup ? "person-add-outline" : "log-in-outline"} size={18} color={isDarkMode ? "#FFFFFF" : "#10252B"} />
                  <Text style={{ color: isDarkMode ? "#FFFFFF" : "#10252B", fontFamily: "Courier New", fontSize: 16, fontWeight: "900", letterSpacing: 1, marginLeft: 8 }}>
                    {isLoading ? (isSignup ? "CREATING..." : "SIGNING IN...") : isSignup ? "CREATE ACCOUNT" : "SIGN IN"}
                  </Text>
                </View>
              </Pressable>

              <GoogleAuthButton
                isDarkMode={isDarkMode}
                isLoading={isLoading}
                onLoginSuccess={handleGoogleLoginSuccess}
                onError={setError}
              />

              <Text style={{ color: mutedColor, fontFamily: "Courier New", fontSize: 11, textAlign: "center", lineHeight: 16, marginTop: 4 }}>
                {isSignup
                  ? "Create a Cuevas account for rewards, missions, posts, and wallet sync."
                  : Platform.OS === "ios"
                  ? "Use Cuevas credentials, Apple, or Google to access rewards."
                  : "Use Cuevas credentials or Google to access rewards."}
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </TouchableWithoutFeedback>
  );
}

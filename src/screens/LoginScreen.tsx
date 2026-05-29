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
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { useAppStore } from "../state/appStore";
import { loginToEcothot, loginWithGoogle } from "../api/ecothot-auth";
import * as Google from "expo-auth-session/providers/google";
import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "../components/Ionicons";
import Constants from "expo-constants";

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
  onLoginSuccess: (email: string, cuevas: number) => void;
  onError: (error: string) => void;
}) {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

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
      const echothotResponse = await loginWithGoogle(userInfo.email, accessToken);

      if (echothotResponse.success && echothotResponse.cuevas !== undefined) {
        onLoginSuccess(userInfo.email, echothotResponse.cuevas);
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

      {/* Google Sign-In Button */}
      <Pressable
        onPress={handleGooglePress}
        disabled={isLoading || isGoogleLoading || !request}
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const login = useAppStore((s) => s.login);
  const setRewardsBalance = useAppStore((s) => s.setRewardsBalance);
  const isDarkMode = useAppStore((s) => s.isDarkMode);

  const handleGoogleLoginSuccess = (userEmail: string, cuevas: number) => {
    setRewardsBalance(cuevas);
    login(userEmail);
  };

  const handleLogin = async () => {
    setError("");

    // Basic validation
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    setIsLoading(true);

    try {
      // Call the Ecothot API
      const response = await loginToEcothot(email, password);

      if (response.success && response.cuevas !== undefined) {
        // Set the balance from the API response
        setRewardsBalance(response.cuevas);

        // Log the user in - this will automatically trigger navigation
        // via conditional rendering in RootNavigator
        login(email);
      } else {
        // Show error message from API
        setError(response.error || "Login failed. Please try again.");
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View
          className={`flex-1 px-6 justify-center ${
            isDarkMode ? "bg-dark-bg" : "bg-pixel-bg"
          }`}
        >
          {/* Title */}
          <View className="items-center mb-12">
            <Text
              className={`text-4xl font-bold mb-2 font-pixel ${
                isDarkMode ? "text-dark-text" : "text-pixel-text"
              }`}
              style={{ fontFamily: "Courier New" }}
            >
              ECOTHOT
            </Text>
            <Text
              className={`text-lg ${
                isDarkMode ? "text-dark-accent" : "text-pixel-teal"
              }`}
              style={{ fontFamily: "Courier New" }}
            >
              Rewards Login
            </Text>
          </View>

          {/* Email Input */}
          <View className="mb-4">
            <Text
              className={`text-sm mb-2 ${
                isDarkMode ? "text-dark-text" : "text-pixel-black"
              }`}
              style={{ fontFamily: "Courier New" }}
            >
              EMAIL
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={isDarkMode ? "#666" : "#999"}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              className={`border-2 px-4 py-3 text-base ${
                isDarkMode
                  ? "bg-dark-surface border-dark-accent text-dark-text"
                  : "bg-white border-pixel-black text-pixel-black"
              }`}
              style={{ fontFamily: "Courier New" }}
            />
          </View>

          {/* Password Input */}
          <View className="mb-6">
            <Text
              className={`text-sm mb-2 ${
                isDarkMode ? "text-dark-text" : "text-pixel-black"
              }`}
              style={{ fontFamily: "Courier New" }}
            >
              PASSWORD
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={isDarkMode ? "#666" : "#999"}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              className={`border-2 px-4 py-3 text-base ${
                isDarkMode
                  ? "bg-dark-surface border-dark-accent text-dark-text"
                  : "bg-white border-pixel-black text-pixel-black"
              }`}
              style={{ fontFamily: "Courier New" }}
            />
          </View>

          {/* Error Message */}
          {error ? (
            <View className="mb-4 p-4 bg-red-100 border-2 border-red-500">
              <Text
                className="text-red-700 text-sm font-bold mb-1"
                style={{ fontFamily: "Courier New" }}
              >
                ERROR
              </Text>
              <Text
                className="text-red-700 text-xs"
                style={{ fontFamily: "Courier New" }}
              >
                {error}
              </Text>
            </View>
          ) : null}

          {/* Login Button */}
          <Pressable
            onPress={handleLogin}
            disabled={isLoading}
            className={`py-4 px-6 border-2 items-center ${
              isLoading
                ? isDarkMode
                  ? "bg-dark-surface border-gray-600"
                  : "bg-gray-300 border-gray-400"
                : isDarkMode
                ? "bg-dark-accent border-dark-accent"
                : "bg-pixel-teal border-pixel-black"
            }`}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              className={`text-lg font-bold ${
                isLoading ? "text-gray-500" : "text-white"
              }`}
              style={{ fontFamily: "Courier New" }}
            >
              {isLoading ? "LOGGING IN..." : "LOGIN"}
            </Text>
          </Pressable>

          {/* Google Sign-In */}
          <GoogleAuthButton
            isDarkMode={isDarkMode}
            isLoading={isLoading}
            onLoginSuccess={handleGoogleLoginSuccess}
            onError={setError}
          />

          {/* Info Text */}
          <View className="mt-8 items-center">
            <Text
              className={`text-xs text-center ${
                isDarkMode ? "text-gray-400" : "text-pixel-black"
              }`}
              style={{ fontFamily: "Courier New" }}
            >
              Login with your ecothot.com credentials
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

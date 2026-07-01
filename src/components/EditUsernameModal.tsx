import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image as RNImage,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Ionicons } from "./Ionicons";
import { useAppStore } from "../state/appStore";
import { useFeedStore } from "../state/feedStore";
import { updateUsernameOnWix } from "../api/update-username";
import { normalizeHandle } from "../utils/handles";

interface EditUsernameModalProps {
  visible: boolean;
  onClose: () => void;
  currentUsername: string;
  currentHandle: string;
}

export default function EditUsernameModal({
  visible,
  onClose,
  currentUsername,
  currentHandle,
}: EditUsernameModalProps) {
  const isDarkMode = useAppStore((s) => s.isDarkMode);
  const userEmail = useAppStore((s) => s.userEmail);
  const handleAliases = useAppStore((s) => s.handleAliases);
  const setDisplayName = useAppStore((s) => s.setDisplayName);
  const setUserHandle = useAppStore((s) => s.setUserHandle);
  const userAvatar = useAppStore((s) => s.userAvatar);
  const setUserAvatar = useAppStore((s) => s.setUserAvatar);
  const userBio = useAppStore((s) => s.userBio);
  const setUserBio = useAppStore((s) => s.setUserBio);
  const updateAuthorHandle = useFeedStore((s) => s.updateAuthorHandle);

  const [username, setUsername] = useState(currentUsername);
  const [handleValue, setHandleValue] = useState(currentHandle);
  const [bio, setBio] = useState(userBio || "");
  const [avatar, setAvatar] = useState<string | null>(userAvatar);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (visible) {
      setUsername(currentUsername);
      setHandleValue(currentHandle);
      setBio(userBio || "");
      setAvatar(userAvatar);
      setError(null);
      setSuccess(false);
      setSaving(false);
    }
  }, [visible, currentUsername, currentHandle, userBio, userAvatar]);

  const pickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!result.canceled && result.assets?.[0]) {
        const uri = result.assets[0].uri;
        try {
          const c = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: 400 } }],
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
          );
          setAvatar(c.uri);
        } catch {
          setAvatar(uri);
        }
      }
    } catch {
      setError("Couldn't open photo library.");
    }
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(false);
    setSaving(true);
    setUserAvatar(avatar);
    setUserBio(bio);
    const trimmedUsername = username.trim();
    const trimmedHandle = normalizeHandle(handleValue, "");
    if (!trimmedUsername) {
      setSaving(false);
      setError("Username cannot be empty.");
      return;
    }
    if (!trimmedHandle) {
      setSaving(false);
      setError("Handle cannot be empty.");
      return;
    }
    const handleChanged = trimmedHandle !== currentHandle;
    const usernameChanged = trimmedUsername !== currentUsername;
    const previousHandles = Array.from(
      new Set(
        [currentHandle, currentUsername, ...(handleAliases || []), userEmail?.split("@")[0]].filter(
          (value): value is string => !!value
        )
      )
    );
    let savedHandle = trimmedHandle;
    if (handleChanged || usernameChanged) {
      if (!userEmail) {
        setError("You must be signed in to change your profile.");
        setSaving(false);
        return;
      }
      const result = await updateUsernameOnWix(userEmail, trimmedHandle, {
        displayName: trimmedUsername,
        previousUsername: currentHandle,
        aliases: previousHandles,
      });
      if (result.success && (result.handle || result.username)) {
        savedHandle = result.handle || result.username || trimmedHandle;
      } else {
        setSaving(false);
        setError(result.error || "Could not update handle.");
        return;
      }
    }
    setDisplayName(trimmedUsername);
    setUserHandle(savedHandle);
    if (handleChanged || usernameChanged) {
      updateAuthorHandle(previousHandles, trimmedUsername, userEmail);
    }
    setSaving(false);
    setSuccess(true);
    setTimeout(() => {
      onClose();
    }, 500);
  };

  const bg = isDarkMode ? "#1F2937" : "#fff";
  const text = isDarkMode ? "#CFEFEC" : "#1F2937";
  const sub = isDarkMode ? "#9CA3AF" : "#6B7280";
  const surface = isDarkMode ? "#111827" : "#F3F4F6";
  const border = isDarkMode ? "#374151" : "#E5E7EB";
  const accent = "#06A7A1";
  const handleChanged = normalizeHandle(handleValue, "") !== currentHandle;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Pressable
          onPress={onClose}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.55)",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              width: "100%",
              maxWidth: 380,
              backgroundColor: bg,
              borderRadius: 18,
              padding: 22,
              maxHeight: "90%",
            }}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={{ alignItems: "center", marginBottom: 14 }}>
                <Pressable onPress={pickAvatar} hitSlop={6}>
                  <View
                    style={{
                      width: 96,
                      height: 96,
                      borderRadius: 48,
                      backgroundColor: `${accent}22`,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 2,
                      borderColor: accent,
                      overflow: "hidden",
                    }}
                  >
                    {avatar ? (
                      <RNImage
                        source={{ uri: avatar }}
                        style={{ width: 96, height: 96 }}
                      />
                    ) : (
                      <Text
                        style={{
                          color: accent,
                          fontSize: 40,
                          fontWeight: "800",
                        }}
                      >
                        {currentUsername[0]?.toUpperCase() || currentHandle[0]?.toUpperCase() || "?"}
                      </Text>
                    )}
                  </View>
                  <View
                    style={{
                      position: "absolute",
                      bottom: -4,
                      right: -4,
                      backgroundColor: accent,
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 2,
                      borderColor: bg,
                    }}
                  >
                    <Ionicons name="camera" size={16} color="#fff" />
                  </View>
                </Pressable>
                <Text
                  style={{
                    color: text,
                    fontWeight: "800",
                    fontSize: 17,
                    marginTop: 14,
                  }}
                >
                  Edit profile
                </Text>
                <Text
                  style={{
                    color: sub,
                    fontSize: 12,
                    marginTop: 4,
                    textAlign: "center",
                  }}
                >
                  Tap photo to change. Your handle has no spaces.
                </Text>
              </View>

              <Text
                style={{
                  color: sub,
                  fontSize: 11,
                  fontWeight: "700",
                  letterSpacing: 1,
                  marginBottom: 6,
                }}
              >
                USERNAME
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: surface,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: error ? "#FF3B30" : border,
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                }}
              >
                <TextInput
                  value={username}
                  onChangeText={(t) => {
                    setUsername(t);
                    if (error) setError(null);
                  }}
                  placeholder="Kevin Lasenberry"
                  placeholderTextColor={sub}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={36}
                  returnKeyType="done"
                  style={{
                    flex: 1,
                    color: text,
                    paddingVertical: 12,
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                />
                {username.length > 0 && (
                  <Pressable onPress={() => setUsername("")} hitSlop={10}>
                    <Ionicons name="close-circle" size={18} color={sub} />
                  </Pressable>
                )}
              </View>

              <Text
                style={{
                  color: sub,
                  fontSize: 11,
                  fontWeight: "700",
                  letterSpacing: 1,
                  marginTop: 14,
                  marginBottom: 6,
                }}
              >
                @ HANDLE
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: surface,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: error ? "#FF3B30" : border,
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ color: sub, fontWeight: "700", marginRight: 4 }}>
                  @
                </Text>
                <TextInput
                  value={handleValue}
                  onChangeText={(t) => {
                    setHandleValue(normalizeHandle(t, ""));
                    if (error) setError(null);
                  }}
                  placeholder="kevinlasenberry"
                  placeholderTextColor={sub}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={24}
                  returnKeyType="done"
                  style={{
                    flex: 1,
                    color: text,
                    paddingVertical: 12,
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                />
                {handleValue.length > 0 && (
                  <Pressable onPress={() => setHandleValue("")} hitSlop={10}>
                    <Ionicons name="close-circle" size={18} color={sub} />
                  </Pressable>
                )}
              </View>

              <Text
                style={{
                  color: handleChanged ? "#F59E0B" : sub,
                  fontSize: 11,
                  lineHeight: 15,
                  marginTop: 6,
                  marginBottom: 2,
                  fontWeight: handleChanged ? "700" : "600",
                }}
              >
                Handles can only be changed once every 90 days. Your username and bio can still be edited anytime.
              </Text>

              <Text
                style={{
                  color: sub,
                  fontSize: 11,
                  fontWeight: "700",
                  letterSpacing: 1,
                  marginTop: 14,
                  marginBottom: 6,
                }}
              >
                BIO
              </Text>
              <View
                style={{
                  backgroundColor: surface,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: border,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Add a short bio..."
                  placeholderTextColor={sub}
                  multiline
                  maxLength={160}
                  style={{
                    color: text,
                    fontSize: 14,
                    minHeight: 60,
                    textAlignVertical: "top",
                  }}
                />
                <Text
                  style={{
                    color: sub,
                    fontSize: 10,
                    textAlign: "right",
                    marginTop: 4,
                  }}
                >
                  {bio.length}/160
                </Text>
              </View>

              {error && (
                <Text style={{ color: "#FF3B30", fontSize: 12, marginTop: 8 }}>
                  {error}
                </Text>
              )}
              {success && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 8,
                  }}
                >
                  <Ionicons name="checkmark-circle" size={14} color={accent} />
                  <Text style={{ color: accent, fontSize: 12, marginLeft: 6 }}>
                    Saved
                  </Text>
                </View>
              )}

              <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
                <Pressable
                  onPress={onClose}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 10,
                    backgroundColor: surface,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: text, fontWeight: "700" }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSave}
                  disabled={saving}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 10,
                    backgroundColor: saving ? `${accent}66` : accent,
                    alignItems: "center",
                  }}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: "#fff", fontWeight: "800" }}>
                      Save
                    </Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

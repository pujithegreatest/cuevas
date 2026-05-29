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
import { updateUsernameOnWix } from "../api/update-username";

interface EditUsernameModalProps {
  visible: boolean;
  onClose: () => void;
  currentHandle: string;
}

export default function EditUsernameModal({
  visible,
  onClose,
  currentHandle,
}: EditUsernameModalProps) {
  const isDarkMode = useAppStore((s) => s.isDarkMode);
  const userEmail = useAppStore((s) => s.userEmail);
  const setDisplayName = useAppStore((s) => s.setDisplayName);
  const userAvatar = useAppStore((s) => s.userAvatar);
  const setUserAvatar = useAppStore((s) => s.setUserAvatar);
  const userBio = useAppStore((s) => s.userBio);
  const setUserBio = useAppStore((s) => s.setUserBio);

  const [value, setValue] = useState(currentHandle);
  const [bio, setBio] = useState(userBio || "");
  const [avatar, setAvatar] = useState<string | null>(userAvatar);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (visible) {
      setValue(currentHandle);
      setBio(userBio || "");
      setAvatar(userAvatar);
      setError(null);
      setSuccess(false);
      setSaving(false);
    }
  }, [visible, currentHandle, userBio, userAvatar]);

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
    const trimmedHandle = value.trim();
    if (trimmedHandle && trimmedHandle !== currentHandle) {
      if (!userEmail) {
        setError("You must be signed in to change your username.");
        setSaving(false);
        return;
      }
      const result = await updateUsernameOnWix(userEmail, trimmedHandle);
      if (result.success && result.username) {
        setDisplayName(result.username);
      } else {
        setSaving(false);
        setError(result.error || "Could not update username.");
        return;
      }
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
                        {currentHandle[0]?.toUpperCase() || "?"}
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
                  Tap photo to change. Handle is synced to ecothot.com.
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
                <Text style={{ color: sub, fontWeight: "700", marginRight: 4 }}>
                  @
                </Text>
                <TextInput
                  value={value}
                  onChangeText={(t) => {
                    setValue(t);
                    if (error) setError(null);
                  }}
                  placeholder="new_handle"
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
                {value.length > 0 && (
                  <Pressable onPress={() => setValue("")} hitSlop={10}>
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

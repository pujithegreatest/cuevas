import React, { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import {
  CreateMissionInput,
  CuevasMission,
  createCuevasMission,
  fetchCuevasMissions,
} from "../api/cuevas-missions";
import { useAppStore } from "../state/appStore";
import { Ionicons } from "./Ionicons";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const typeOptions: CreateMissionInput["type"][] = ["One time", "Recurring", "Weekly", "Monthly"];
const difficultyOptions: CreateMissionInput["difficulty"][] = ["Easy", "Medium", "High impact"];

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: "default" | "number-pad";
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: "#9CA3AF", fontSize: 11, fontWeight: "900", letterSpacing: 1, marginBottom: 6 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#5F6B73"
        multiline={multiline}
        keyboardType={keyboardType}
        style={{
          minHeight: multiline ? 82 : 46,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "rgba(6,167,161,0.32)",
          backgroundColor: "rgba(255,255,255,0.06)",
          color: "#CFEFEC",
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontWeight: "800",
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}

function OptionRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: "#9CA3AF", fontSize: 11, fontWeight: "900", letterSpacing: 1, marginBottom: 6 }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((option) => {
          const active = value === option;
          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 9,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: active ? "#06A7A1" : "rgba(255,255,255,0.16)",
                backgroundColor: active ? "rgba(6,167,161,0.20)" : "rgba(255,255,255,0.05)",
              }}
            >
              <Text style={{ color: active ? "#CFEFEC" : "#9CA3AF", fontWeight: "900", fontSize: 12 }}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function BusinessProfileModal({ visible, onClose }: Props) {
  const userEmail = useAppStore((state) => state.userEmail);
  const displayName = useAppStore((state) => state.displayName);
  const handle = displayName || userEmail?.split("@")[0] || "cuevas-partner";
  const [permission, requestPermission] = useCameraPermissions();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState(`${handle} Lab`);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [points, setPoints] = useState("100");
  const [peopleNeeded, setPeopleNeeded] = useState("4 ppl");
  const [materialsNote, setMaterialsNote] = useState("Materials provided on site.");
  const [type, setType] = useState<CreateMissionInput["type"]>("One time");
  const [difficulty, setDifficulty] = useState<CreateMissionInput["difficulty"]>("Easy");
  const [gearProvided, setGearProvided] = useState(true);
  const [missions, setMissions] = useState<CuevasMission[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredMissions = useMemo(
    () =>
      missions.filter((mission) => {
        const businessHandle = (mission.businessHandle || "").toLowerCase();
        const businessTitle = (mission.businessName || "").toLowerCase();
        return businessHandle === handle.toLowerCase() || businessTitle === businessName.toLowerCase();
      }),
    [businessName, handle, missions]
  );

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    fetchCuevasMissions()
      .then((items) => {
        if (!cancelled) setMissions(items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const submitMission = async () => {
    if (!title.trim() || !description.trim() || !location.trim() || !eventDate.trim()) {
      setStatus("Fill event name, description, location, and date.");
      return;
    }
    setIsSubmitting(true);
    setStatus(null);
    try {
      const mission = await createCuevasMission({
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        eventDate: eventDate.trim(),
        type,
        difficulty,
        points: Number(points) || 100,
        peopleNeeded: peopleNeeded.trim() || "Open crew",
        gearProvided,
        materialsNote: materialsNote.trim(),
        businessName: businessName.trim() || `${handle} Lab`,
        businessHandle: handle,
        businessVerified: true,
        contactEmail: userEmail,
      });
      setMissions((current) => [mission, ...current]);
      setTitle("");
      setDescription("");
      setLocation("");
      setEventDate("");
      setPoints("100");
      setPeopleNeeded("4 ppl");
      setStatus("Mission published to the vendor grid.");
    } catch (error) {
      setStatus(`Publish failed: ${String((error as any)?.message || error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <LinearGradient colors={["#081920", "#0A0A0A"]} style={{ flex: 1 }}>
          <View
            style={{
              paddingTop: 18,
              paddingHorizontal: 16,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: "rgba(6,167,161,0.22)",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="log-out-outline" size={26} color="#CFEFEC" />
            </Pressable>
            <View style={{ alignItems: "center" }}>
              <Text style={{ color: "#CFEFEC", fontWeight: "900", fontSize: 18 }}>Business Profile</Text>
              <Text style={{ color: "#06A7A1", fontSize: 11, fontWeight: "900" }}>verified vendor console</Text>
            </View>
            <Pressable
              onPress={async () => {
                if (!permission?.granted) await requestPermission();
                setScannerOpen((current) => !current);
              }}
              hitSlop={10}
            >
              <Ionicons name="camera-outline" size={24} color="#06A7A1" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 34 }}>
            <LinearGradient
              colors={["rgba(6,167,161,0.20)", "rgba(255,255,255,0.04)"]}
              style={{
                borderRadius: 24,
                borderWidth: 1,
                borderColor: "rgba(6,167,161,0.30)",
                padding: 16,
                marginBottom: 14,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 18,
                    backgroundColor: "#06A7A1",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                  }}
                >
                  <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "900" }}>
                    {businessName[0]?.toUpperCase() || "B"}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ color: "#CFEFEC", fontWeight: "900", fontSize: 18 }} numberOfLines={1}>
                      {businessName || "Business Profile"}
                    </Text>
                    <Ionicons name="checkmark-circle" size={16} color="#06A7A1" style={{ marginLeft: 6 }} />
                  </View>
                  <Text style={{ color: "#9CA3AF", fontWeight: "800", marginTop: 2 }}>
                    @{handle} · {filteredMissions.length} mission{filteredMissions.length === 1 ? "" : "s"}
                  </Text>
                </View>
              </View>
            </LinearGradient>

            {scannerOpen ? (
              <View
                style={{
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: "rgba(6,167,161,0.35)",
                  overflow: "hidden",
                  marginBottom: 14,
                  height: 260,
                  backgroundColor: "#000",
                }}
              >
                {permission?.granted ? (
                  <CameraView
                    style={{ flex: 1 }}
                    barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                    onBarcodeScanned={(result) => setLastScan(result.data)}
                  />
                ) : (
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 18 }}>
                    <Ionicons name="camera-outline" size={42} color="#06A7A1" />
                    <Text style={{ color: "#CFEFEC", textAlign: "center", marginTop: 8, fontWeight: "800" }}>
                      Camera access is required to scan mission QR check-ins.
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            {lastScan ? (
              <View
                style={{
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: "rgba(6,167,161,0.30)",
                  padding: 12,
                  marginBottom: 14,
                  backgroundColor: "rgba(6,167,161,0.12)",
                }}
              >
                <Text style={{ color: "#06A7A1", fontWeight: "900", fontSize: 11 }}>LAST CHECK-IN SCAN</Text>
                <Text style={{ color: "#CFEFEC", marginTop: 4 }} numberOfLines={2}>{lastScan}</Text>
              </View>
            ) : null}

            <Field label="Business name" value={businessName} onChangeText={setBusinessName} placeholder="Cuevas Civic Lab" />
            <Field label="Event name" value={title} onChangeText={setTitle} placeholder="Community Cleanup" />
            <Field label="Description" value={description} onChangeText={setDescription} placeholder="Short mission preview for users." multiline />
            <Field label="Location" value={location} onChangeText={setLocation} placeholder="Downtown Trail Loop" />
            <Field label="Date / time" value={eventDate} onChangeText={setEventDate} placeholder="June 15, 2026 11:00 AM" />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="Cuevas points" value={points} onChangeText={setPoints} placeholder="120" keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="People needed" value={peopleNeeded} onChangeText={setPeopleNeeded} placeholder="4 ppl" />
              </View>
            </View>
            <OptionRow label="Mission type" options={typeOptions} value={type} onChange={setType} />
            <OptionRow label="Difficulty" options={difficultyOptions} value={difficulty} onChange={setDifficulty} />
            <Pressable
              onPress={() => setGearProvided((current) => !current)}
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: gearProvided ? "#06A7A1" : "rgba(255,255,255,0.16)",
                backgroundColor: gearProvided ? "rgba(6,167,161,0.18)" : "rgba(255,255,255,0.05)",
                padding: 13,
                marginBottom: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ color: "#CFEFEC", fontWeight: "900" }}>Organization provides gear</Text>
              <Ionicons name={gearProvided ? "checkmark-circle" : "close-circle"} size={20} color={gearProvided ? "#06A7A1" : "#9CA3AF"} />
            </Pressable>
            <Field label="Materials note" value={materialsNote} onChangeText={setMaterialsNote} placeholder="Bring gloves, water bottle, etc." />

            <Pressable
              onPress={submitMission}
              disabled={isSubmitting}
              style={({ pressed }) => ({
                borderRadius: 18,
                paddingVertical: 14,
                alignItems: "center",
                backgroundColor: "#06A7A1",
                opacity: pressed || isSubmitting ? 0.72 : 1,
              })}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "900" }}>
                {isSubmitting ? "Publishing..." : "Publish Mission"}
              </Text>
            </Pressable>

            {status ? (
              <Text style={{ color: status.includes("failed") || status.includes("Fill") ? "#EF4444" : "#06A7A1", fontWeight: "800", textAlign: "center", marginTop: 10 }}>
                {status}
              </Text>
            ) : null}

            <Text style={{ color: "#CFEFEC", fontSize: 18, fontWeight: "900", marginTop: 24, marginBottom: 10 }}>
              Business Page Events
            </Text>
            {filteredMissions.length ? (
              filteredMissions.map((mission) => (
                <View
                  key={mission.id}
                  style={{
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: "rgba(6,167,161,0.22)",
                    padding: 14,
                    marginBottom: 10,
                    backgroundColor: "rgba(255,255,255,0.05)",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ color: "#CFEFEC", fontWeight: "900", flex: 1 }}>{mission.title}</Text>
                    <Text style={{ color: "#06A7A1", fontWeight: "900" }}>{mission.goingCount || 0} going</Text>
                  </View>
                  <Text style={{ color: "#9CA3AF", marginTop: 4, fontSize: 12 }}>{mission.eventDate} · {mission.location}</Text>
                </View>
              ))
            ) : (
              <Text style={{ color: "#9CA3AF", lineHeight: 20 }}>
                Published missions from this business profile will appear here and in the user Missions tab.
              </Text>
            )}
          </ScrollView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </Modal>
  );
}

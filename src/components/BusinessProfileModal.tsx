import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
  MissionAttendee,
  checkInCuevasMission,
  createCuevasMission,
  fetchCuevasMissions,
  fetchMissionAttendees,
  upsertCuevasBusinessProfile,
} from "../api/cuevas-missions";
import { useAppStore } from "../state/appStore";
import { Ionicons } from "./Ionicons";

interface Props {
  visible: boolean;
  onClose: () => void;
}

type BusinessTab = "profile" | "create" | "active" | "submissions";

const typeOptions: CreateMissionInput["type"][] = ["One time", "Recurring", "Weekly", "Monthly"];
const difficultyOptions: CreateMissionInput["difficulty"][] = ["Easy", "Medium", "High impact"];
const durationOptions = [1, 2, 3, 4];

function slugHandle(value: string) {
  return String(value || "cuevas-business")
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "cuevas-business";
}

function extractEmail(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    const fromJson = parsed?.email || parsed?.userEmail || parsed?.memberEmail || parsed?.id;
    if (fromJson) return String(fromJson).trim().toLowerCase();
  } catch {}
  const match = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return (match?.[0] || raw).trim().toLowerCase();
}

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
  keyboardType?: "default" | "number-pad" | "email-address";
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: "#9CA3AF", fontSize: 11, fontWeight: "900", letterSpacing: 1.3, marginBottom: 6 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#5F6B73"
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
        style={{
          minHeight: multiline ? 88 : 48,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: "rgba(6,167,161,0.34)",
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
      <Text style={{ color: "#9CA3AF", fontSize: 11, fontWeight: "900", letterSpacing: 1.3, marginBottom: 6 }}>
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
                paddingHorizontal: 13,
                paddingVertical: 9,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: active ? "#06A7A1" : "rgba(255,255,255,0.18)",
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
  const isBusinessAccount = useAppStore((state) => state.isBusinessAccount);
  const storedBusinessName = useAppStore((state) => state.businessName);
  const setBusinessProfile = useAppStore((state) => state.setBusinessProfile);
  const handle = slugHandle(displayName || userEmail?.split("@")[0] || "cuevas-partner");
  const [permission, requestPermission] = useCameraPermissions();
  const [activeTab, setActiveTab] = useState<BusinessTab>("profile");
  const [businessNameDraft, setBusinessNameDraft] = useState(storedBusinessName || `${handle} Lab`);
  const [missions, setMissions] = useState<CuevasMission[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [scannerMissionId, setScannerMissionId] = useState<string | null>(null);
  const [manualEmail, setManualEmail] = useState<Record<string, string>>({});
  const [attendees, setAttendees] = useState<Record<string, MissionAttendee[]>>({});
  const [checkInStatus, setCheckInStatus] = useState<Record<string, string>>({});

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [durationHours, setDurationHours] = useState(1);
  const [peopleNeeded, setPeopleNeeded] = useState("4 ppl");
  const [materialsNote, setMaterialsNote] = useState("Materials provided on site.");
  const [type, setType] = useState<CreateMissionInput["type"]>("One time");
  const [difficulty, setDifficulty] = useState<CreateMissionInput["difficulty"]>("Easy");
  const [gearProvided, setGearProvided] = useState(true);

  const businessName = storedBusinessName || businessNameDraft;

  const filteredMissions = useMemo(
    () =>
      missions.filter((mission) => {
        const businessHandle = slugHandle(mission.businessHandle || "");
        const businessTitle = String(mission.businessName || "").trim().toLowerCase();
        return businessHandle === handle || businessTitle === businessName.trim().toLowerCase();
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
      .catch((error) => console.log("[BUSINESS] mission sync failed", String(error)));
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const loadAttendees = async (missionId: string) => {
    try {
      const list = await fetchMissionAttendees(missionId);
      setAttendees((current) => ({ ...current, [missionId]: list }));
    } catch (error) {
      setCheckInStatus((current) => ({
        ...current,
        [missionId]: `Could not load attendee list: ${String((error as any)?.message || error)}`,
      }));
    }
  };

  useEffect(() => {
    filteredMissions.slice(0, 4).forEach((mission) => {
      if (!attendees[mission.id]) loadAttendees(mission.id);
    });
  }, [filteredMissions.map((mission) => mission.id).join("|")]);

  const saveBusinessProfile = async () => {
    const nextName = businessNameDraft.trim();
    if (!nextName) {
      setStatus("Enter your business or organization name.");
      return;
    }
    setIsSavingProfile(true);
    setStatus(null);
    try {
      await upsertCuevasBusinessProfile({
        businessName: nextName,
        businessHandle: handle,
        ownerEmail: userEmail,
      });
      setBusinessProfile(nextName);
      setActiveTab("create");
      setStatus("Business profile saved. You can publish your first event.");
    } catch (error) {
      setStatus(`Business profile saved locally. Wix sync failed: ${String((error as any)?.message || error)}`);
      setBusinessProfile(nextName);
      setActiveTab("create");
    } finally {
      setIsSavingProfile(false);
    }
  };

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
        durationHours,
        type,
        difficulty,
        points: durationHours * 100,
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
      setDurationHours(1);
      setPeopleNeeded("4 ppl");
      setStatus("Mission published to the Cuevas civic grid.");
      setActiveTab("active");
    } catch (error) {
      setStatus(`Publish failed: ${String((error as any)?.message || error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const checkInEmail = async (mission: CuevasMission, emailInput: string) => {
    const email = extractEmail(emailInput);
    if (!email.includes("@")) {
      setCheckInStatus((current) => ({ ...current, [mission.id]: "Enter or scan a valid email." }));
      return;
    }
    setCheckInStatus((current) => ({ ...current, [mission.id]: "Checking in attendee..." }));
    try {
      const result = await checkInCuevasMission({
        missionId: mission.id,
        userEmail: email,
        userHandle: email.split("@")[0],
        businessHandle: handle,
      });
      setCheckInStatus((current) => ({
        ...current,
        [mission.id]:
          result.awardedPoints > 0
            ? `${result.email} awarded ${result.awardedPoints} Cuevas.`
            : `${result.email} was already checked in.`,
      }));
      setManualEmail((current) => ({ ...current, [mission.id]: "" }));
      await loadAttendees(mission.id);
    } catch (error) {
      setCheckInStatus((current) => ({
        ...current,
        [mission.id]: `Check-in failed: ${String((error as any)?.message || error)}`,
      }));
    }
  };

  const renderHeader = () => (
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
        <Ionicons name="log-out-outline" size={27} color="#CFEFEC" />
      </Pressable>
      <View style={{ alignItems: "center" }}>
        <Text style={{ color: "#CFEFEC", fontWeight: "900", fontSize: 18 }}>Business Profile</Text>
        <Text style={{ color: "#06A7A1", fontSize: 11, fontWeight: "900" }}>verified vendor console</Text>
      </View>
      <Pressable
        onPress={() => setActiveTab("profile")}
        hitSlop={10}
        style={{ opacity: isBusinessAccount ? 1 : 0.35 }}
      >
        <Ionicons name="business-outline" size={24} color="#06A7A1" />
      </Pressable>
    </View>
  );

  const renderBusinessBadge = () => (
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
            width: 58,
            height: 58,
            borderRadius: 18,
            backgroundColor: "#06A7A1",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 24, fontWeight: "900" }}>
            {businessName[0]?.toUpperCase() || "B"}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ color: "#CFEFEC", fontWeight: "900", fontSize: 18, flex: 1 }} numberOfLines={1}>
              {businessName || "Business Profile"}
            </Text>
            <Ionicons name="checkmark-circle" size={18} color="#06A7A1" style={{ marginLeft: 6 }} />
          </View>
          <Text style={{ color: "#9CA3AF", fontWeight: "800", marginTop: 2 }}>
            @{handle} · {filteredMissions.length} active mission{filteredMissions.length === 1 ? "" : "s"}
          </Text>
        </View>
      </View>
    </LinearGradient>
  );

  const renderOnboarding = () => (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 34 }}>
      <LinearGradient
        colors={["rgba(6,167,161,0.22)", "rgba(128,23,31,0.18)"]}
        style={{
          borderRadius: 28,
          borderWidth: 1,
          borderColor: "rgba(6,167,161,0.34)",
          padding: 18,
          marginBottom: 16,
        }}
      >
        <Ionicons name="business-outline" size={42} color="#06A7A1" />
        <Text style={{ color: "#CFEFEC", fontSize: 22, fontWeight: "900", marginTop: 12 }}>
          Sign up as a business
        </Text>
        <Text style={{ color: "#9CA3AF", lineHeight: 20, marginTop: 8 }}>
          Create a verified organizer profile, publish community service missions, scan attendee QR codes, and award Cuevas points.
        </Text>
      </LinearGradient>
      <Field
        label="Business or organization name"
        value={businessNameDraft}
        onChangeText={setBusinessNameDraft}
        placeholder="Cuevas Civic Lab"
      />
      <Pressable
        onPress={saveBusinessProfile}
        disabled={isSavingProfile}
        style={({ pressed }) => ({
          borderRadius: 18,
          paddingVertical: 14,
          alignItems: "center",
          backgroundColor: "#06A7A1",
          opacity: pressed || isSavingProfile ? 0.72 : 1,
        })}
      >
        <Text style={{ color: "#FFFFFF", fontWeight: "900" }}>
          {isSavingProfile ? "Creating..." : "Create Verified Business Profile"}
        </Text>
      </Pressable>
      {status ? <Text style={{ color: "#06A7A1", marginTop: 12, fontWeight: "800" }}>{status}</Text> : null}
    </ScrollView>
  );

  const renderTabs = () => (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
      {([
        ["profile", "Profile"],
        ["create", "Create Event"],
        ["active", "Active Missions"],
        ["submissions", "Submissions"],
      ] as [BusinessTab, string][]).map(([id, label]) => {
        const active = activeTab === id;
        return (
          <Pressable
            key={id}
            onPress={() => setActiveTab(id)}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: active ? "#06A7A1" : "rgba(255,255,255,0.14)",
              backgroundColor: active ? "rgba(6,167,161,0.18)" : "rgba(255,255,255,0.05)",
              alignItems: "center",
            }}
          >
            <Text style={{ color: active ? "#CFEFEC" : "#9CA3AF", fontSize: 10, fontWeight: "900" }}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderCreateEvent = () => (
    <>
      <Text style={{ color: "#CFEFEC", fontSize: 18, fontWeight: "900", marginBottom: 10 }}>Create Event</Text>
      <Field label="Event name" value={title} onChangeText={setTitle} placeholder="Community Cleanup" />
      <Field label="Description" value={description} onChangeText={setDescription} placeholder="Short mission preview for users." multiline />
      <Field label="Location" value={location} onChangeText={setLocation} placeholder="Downtown Trail Loop" />
      <Field label="Date / time" value={eventDate} onChangeText={setEventDate} placeholder="June 15, 2026 11:00 AM" />
      <View style={{ marginBottom: 12 }}>
        <Text style={{ color: "#9CA3AF", fontSize: 11, fontWeight: "900", letterSpacing: 1.3, marginBottom: 6 }}>
          Service duration · 100 Cuevas per hour
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {durationOptions.map((hours) => {
            const active = durationHours === hours;
            return (
              <Pressable
                key={hours}
                onPress={() => setDurationHours(hours)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: active ? "#06A7A1" : "rgba(255,255,255,0.18)",
                  backgroundColor: active ? "rgba(6,167,161,0.20)" : "rgba(255,255,255,0.05)",
                }}
              >
                <Text style={{ color: active ? "#CFEFEC" : "#9CA3AF", fontWeight: "900" }}>
                  {hours} hr · {hours * 100} ₡
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Field label="People needed" value={peopleNeeded} onChangeText={setPeopleNeeded} placeholder="4 ppl" />
      <OptionRow label="Mission type" options={typeOptions} value={type} onChange={setType} />
      <OptionRow label="Difficulty" options={difficultyOptions} value={difficulty} onChange={setDifficulty} />
      <Pressable
        onPress={() => setGearProvided((current) => !current)}
        style={{
          borderRadius: 18,
          borderWidth: 1,
          borderColor: gearProvided ? "#06A7A1" : "rgba(255,255,255,0.16)",
          backgroundColor: gearProvided ? "rgba(6,167,161,0.18)" : "rgba(255,255,255,0.05)",
          padding: 14,
          marginBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ color: "#CFEFEC", fontWeight: "900" }}>Organization provides gear</Text>
        <Ionicons name={gearProvided ? "checkmark-circle" : "close-circle"} size={21} color={gearProvided ? "#06A7A1" : "#9CA3AF"} />
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
    </>
  );

  const renderMissionScanner = (mission: CuevasMission) => {
    const isScanning = scannerMissionId === mission.id;
    const attendeeList = attendees[mission.id] || [];
    return (
      <View
        key={mission.id}
        style={{
          borderRadius: 22,
          borderWidth: 1,
          borderColor: "rgba(6,167,161,0.28)",
          padding: 14,
          marginBottom: 12,
          backgroundColor: "rgba(255,255,255,0.05)",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#CFEFEC", fontWeight: "900", fontSize: 16 }}>{mission.title}</Text>
            <Text style={{ color: "#9CA3AF", marginTop: 4, fontSize: 12 }}>
              {mission.eventDate} · {mission.location} · {mission.durationHours || 1} hr
            </Text>
          </View>
          <Text style={{ color: "#06A7A1", fontWeight: "900" }}>{mission.goingCount || attendeeList.length} going</Text>
        </View>
        <Text style={{ color: "#9CA3AF", fontSize: 12, marginTop: 10 }}>
          Scan QR to award {mission.points} Cuevas, or type an attendee email manually.
        </Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          <TextInput
            value={manualEmail[mission.id] || ""}
            onChangeText={(value) => setManualEmail((current) => ({ ...current, [mission.id]: value }))}
            placeholder="attendee@email.com"
            placeholderTextColor="#5F6B73"
            autoCapitalize="none"
            keyboardType="email-address"
            style={{
              flex: 1,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "rgba(6,167,161,0.28)",
              backgroundColor: "rgba(0,0,0,0.18)",
              color: "#CFEFEC",
              paddingHorizontal: 12,
              fontWeight: "800",
            }}
          />
          <Pressable
            onPress={() => checkInEmail(mission, manualEmail[mission.id] || "")}
            style={{
              borderRadius: 16,
              backgroundColor: "#06A7A1",
              paddingHorizontal: 14,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "900" }}>Check in</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={async () => {
            if (!permission?.granted) {
              const next = await requestPermission();
              if (!next.granted) return;
            }
            setScannerMissionId(isScanning ? null : mission.id);
          }}
          style={{
            marginTop: 10,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "rgba(6,167,161,0.45)",
            paddingVertical: 12,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Ionicons name="qr-code-outline" size={18} color="#06A7A1" />
          <Text style={{ color: "#06A7A1", fontWeight: "900" }}>{isScanning ? "Close scanner" : "Scan QR"}</Text>
        </Pressable>
        {isScanning ? (
          <View style={{ height: 250, borderRadius: 18, overflow: "hidden", marginTop: 10, backgroundColor: "#000" }}>
            {permission?.granted ? (
              <CameraView
                style={{ flex: 1 }}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={(result) => {
                  setScannerMissionId(null);
                  checkInEmail(mission, result.data);
                }}
              />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#CFEFEC", fontWeight: "800" }}>Camera permission required.</Text>
              </View>
            )}
          </View>
        ) : null}
        {checkInStatus[mission.id] ? (
          <Text
            style={{
              color: checkInStatus[mission.id].includes("failed") || checkInStatus[mission.id].includes("valid") ? "#EF4444" : "#06A7A1",
              marginTop: 10,
              fontSize: 12,
              fontWeight: "800",
            }}
          >
            {checkInStatus[mission.id]}
          </Text>
        ) : null}
        <View style={{ marginTop: 12 }}>
          <Text style={{ color: "#CFEFEC", fontWeight: "900", marginBottom: 6 }}>Registered emails</Text>
          {attendeeList.length ? (
            attendeeList.slice(0, 8).map((item) => (
              <View key={`${mission.id}-${item.email}`} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
                <Text style={{ color: "#9CA3AF", fontSize: 12 }}>{item.email}</Text>
                <Text style={{ color: item.checkedIn ? "#06A7A1" : "#9CA3AF", fontSize: 12, fontWeight: "800" }}>
                  {item.checkedIn ? `+${item.awardedPoints || mission.points} ₡` : item.status || "going"}
                </Text>
              </View>
            ))
          ) : (
            <Text style={{ color: "#5F6B73", fontSize: 12 }}>No registered attendees yet.</Text>
          )}
        </View>
      </View>
    );
  };

  const renderActiveMissions = () => (
    <>
      <Text style={{ color: "#CFEFEC", fontSize: 18, fontWeight: "900", marginBottom: 6 }}>Active Missions</Text>
      <Text style={{ color: "#9CA3AF", lineHeight: 19, marginBottom: 12 }}>
        Use this station at the event table. Scan QR codes or manually enter emails to award points.
      </Text>
      {filteredMissions.length ? (
        filteredMissions.map(renderMissionScanner)
      ) : (
        <View style={{ borderRadius: 22, padding: 16, borderWidth: 1, borderColor: "rgba(6,167,161,0.22)", backgroundColor: "rgba(255,255,255,0.05)" }}>
          <Text style={{ color: "#9CA3AF" }}>No active missions yet. Create an event first.</Text>
        </View>
      )}
    </>
  );

  const renderProfile = () => (
    <>
      <Text style={{ color: "#CFEFEC", fontSize: 18, fontWeight: "900", marginBottom: 10 }}>Organizer Console</Text>
      {[
        ["Profile Posts", "Share updates, recaps, and event media from this organization profile."],
        ["Event List", "Users can view this business page and see active missions."],
        ["Verified Business Badge", "Your missions display a verified check next to the organizer handle."],
      ].map(([titleText, body]) => (
        <View
          key={titleText}
          style={{
            borderRadius: 18,
            borderWidth: 1,
            borderColor: "rgba(6,167,161,0.20)",
            padding: 14,
            marginBottom: 10,
            backgroundColor: "rgba(255,255,255,0.05)",
          }}
        >
          <Text style={{ color: "#CFEFEC", fontWeight: "900" }}>{titleText}</Text>
          <Text style={{ color: "#9CA3AF", marginTop: 4, lineHeight: 18 }}>{body}</Text>
        </View>
      ))}
    </>
  );

  const renderSubmissions = () => (
    <>
      <Text style={{ color: "#CFEFEC", fontSize: 18, fontWeight: "900", marginBottom: 8 }}>Mission Proof Submissions</Text>
      <Text style={{ color: "#9CA3AF", lineHeight: 19, marginBottom: 12 }}>
        User photos and videos submitted after completed missions will show here for organizer review.
      </Text>
      <View style={{ borderRadius: 22, borderWidth: 1, borderColor: "rgba(6,167,161,0.22)", padding: 16, backgroundColor: "rgba(255,255,255,0.05)" }}>
        <Text style={{ color: "#06A7A1", fontWeight: "900" }}>Demo queue ready</Text>
        <Text style={{ color: "#9CA3AF", marginTop: 6 }}>Backend review workflow can attach uploads to mission IDs next.</Text>
      </View>
    </>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <LinearGradient colors={["#081920", "#0A0A0A"]} style={{ flex: 1 }}>
          {renderHeader()}
          {!isBusinessAccount ? (
            renderOnboarding()
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 34 }}>
              {renderBusinessBadge()}
              {renderTabs()}
              {status ? (
                <Text
                  style={{
                    color: status.includes("failed") || status.includes("Fill") ? "#EF4444" : "#06A7A1",
                    fontWeight: "800",
                    textAlign: "center",
                    marginBottom: 12,
                  }}
                >
                  {status}
                </Text>
              ) : null}
              {isSubmitting ? <ActivityIndicator color="#06A7A1" style={{ marginBottom: 12 }} /> : null}
              {activeTab === "profile" && renderProfile()}
              {activeTab === "create" && renderCreateEvent()}
              {activeTab === "active" && renderActiveMissions()}
              {activeTab === "submissions" && renderSubmissions()}
            </ScrollView>
          )}
        </LinearGradient>
      </KeyboardAvoidingView>
    </Modal>
  );
}

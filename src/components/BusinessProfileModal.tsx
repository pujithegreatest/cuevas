import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Video, ResizeMode } from "expo-av";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import {
  CreateMissionInput,
  CuevasMission,
  MissionAttendee,
  MissionProof,
  checkInCuevasMission,
  completeCuevasMission,
  createCuevasMission,
  deleteCuevasMission,
  fetchCuevasMissions,
  fetchMissionAttendees,
  fetchMissionProofs,
  upsertCuevasBusinessProfile,
} from "../api/cuevas-missions";
import { useAppStore } from "../state/appStore";
import { Ionicons } from "./Ionicons";
import MissionChatModal from "./MissionChatModal";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const QRCodeLib = require("qrcode-terminal/vendor/QRCode");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const QRErrorCorrectLevel = require("qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel");

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildQrSvg(data: string, size = 380): string {
  const qr = new QRCodeLib(-1, QRErrorCorrectLevel.M);
  qr.addData(data);
  qr.make();
  const modules = qr.modules as boolean[][];
  const count = modules.length;
  const cell = size / count;
  const rects: string[] = [];
  modules.forEach((row, rowIndex) => {
    row.forEach((dark, colIndex) => {
      if (dark) {
        rects.push(`<rect x="${(colIndex * cell).toFixed(3)}" y="${(rowIndex * cell).toFixed(3)}" width="${cell.toFixed(3)}" height="${cell.toFixed(3)}" fill="#000000"/>`);
      }
    });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#ffffff"/>${rects.join("")}</svg>`;
}


interface Props {
  visible: boolean;
  onClose: () => void;
}

type BusinessTab = "profile" | "create" | "active" | "submissions";

const typeOptions: CreateMissionInput["type"][] = ["One time", "Recurring", "Weekly", "Monthly"];
const difficultyOptions: CreateMissionInput["difficulty"][] = ["Easy", "Medium", "High impact"];
const durationOptions = [1, 2, 3, 4];

function defaultMissionDate() {
  const next = new Date();
  next.setDate(next.getDate() + 7);
  next.setHours(12, 0, 0, 0);
  return next;
}

function formatDatePart(date: Date) {
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function formatTimePart(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatBusinessMissionDate(mission: CuevasMission) {
  const rawDate = mission.eventDateISO || mission.eventDate;
  const parsed = rawDate ? new Date(rawDate) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  }
  return mission.eventDate || "Date TBD";
}

function normalizedPeopleNeeded(value: string) {
  const count = Number(String(value || "").replace(/[^\d]/g, ""));
  return Number.isFinite(count) && count > 0 ? count : 1;
}

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
  const setRewardsBalance = useAppStore((state) => state.setRewardsBalance);
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
  const [chatMission, setChatMission] = useState<CuevasMission | null>(null);
  const [missionProofs, setMissionProofs] = useState<MissionProof[]>([]);
  const [proofsStatus, setProofsStatus] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [eventUrl, setEventUrl] = useState("");
  const [eventDateTime, setEventDateTime] = useState<Date>(() => defaultMissionDate());
  const [datePickerMode, setDatePickerMode] = useState<"date" | "time" | null>(null);
  const [durationHours, setDurationHours] = useState(1);
  const [peopleNeeded, setPeopleNeeded] = useState("4");
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
  const activeMissions = useMemo(
    () => filteredMissions.filter((mission) => !["completed", "deleted"].includes(String(mission.status || "active").toLowerCase())),
    [filteredMissions]
  );
  const pastMissions = useMemo(
    () => filteredMissions.filter((mission) => String(mission.status || "active").toLowerCase() === "completed"),
    [filteredMissions]
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
    activeMissions.slice(0, 4).forEach((mission) => {
      if (!attendees[mission.id]) loadAttendees(mission.id);
    });
  }, [activeMissions.map((mission) => mission.id).join("|")]);

  const loadProofs = async () => {
    setProofsStatus("Loading mission submissions...");
    try {
      const list = await fetchMissionProofs({ businessHandle: handle });
      setMissionProofs(list);
      setProofsStatus(list.length ? null : "No user submissions yet.");
    } catch (error) {
      setProofsStatus(`Could not load submissions: ${String((error as any)?.message || error)}`);
    }
  };

  useEffect(() => {
    if (visible && isBusinessAccount && activeTab === "submissions") {
      loadProofs();
    }
  }, [activeTab, handle, isBusinessAccount, visible]);

  useEffect(() => {
    if (!visible || !isBusinessAccount || !filteredMissions.length) return;
    filteredMissions.forEach((mission) => {
      if (!attendees[mission.id]) {
        loadAttendees(mission.id);
      }
    });
  }, [filteredMissions, isBusinessAccount, visible]);

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
    if (!title.trim() || !description.trim() || !location.trim()) {
      setStatus("Fill event name, description, and location.");
      return;
    }
    setIsSubmitting(true);
    setStatus(null);
    try {
      const mission = await createCuevasMission({
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        eventDate: eventDateTime.toISOString(),
        durationHours,
        type,
        difficulty,
        points: durationHours * 100,
        peopleNeeded: normalizedPeopleNeeded(peopleNeeded),
        gearProvided,
        materialsNote: materialsNote.trim(),
        eventUrl: eventUrl.trim(),
        businessName: businessName.trim() || `${handle} Lab`,
        businessHandle: handle,
        businessVerified: true,
        contactEmail: userEmail,
      });
      setMissions((current) => [mission, ...current]);
      setTitle("");
      setDescription("");
      setLocation("");
      setEventUrl("");
      setEventDateTime(defaultMissionDate());
      setDurationHours(1);
      setPeopleNeeded("4");
      setStatus("Mission published to the Cuevas civic grid.");
      setActiveTab("active");
    } catch (error) {
      setStatus(`Publish failed: ${String((error as any)?.message || error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDateTimeChange = (_event: unknown, selectedDate?: Date) => {
    const mode = datePickerMode;
    if (Platform.OS !== "ios") setDatePickerMode(null);
    if (!mode || !selectedDate) return;
    setEventDateTime((current) => {
      const next = new Date(current);
      if (mode === "date") {
        next.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      } else {
        next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
      }
      return next;
    });
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
      setAttendees((current) => {
        const nextAttendee: MissionAttendee = {
          missionId: mission.id,
          email: result.email,
          handle: result.email.split("@")[0],
          status: "checked-in",
          checkedIn: true,
          awardedPoints: result.awardedPoints || mission.points,
          checkedInAt: new Date().toISOString(),
          missionTitle: mission.title,
          missionLocation: mission.location,
          missionEventDate: mission.eventDate,
          missionEventDateISO: mission.eventDateISO,
          missionBusinessName: mission.businessName,
          missionBusinessHandle: mission.businessHandle,
          missionPoints: mission.points,
          missionDurationHours: mission.durationHours,
        };
        const currentList = current[mission.id] || [];
        return {
          ...current,
          [mission.id]: [
            nextAttendee,
            ...currentList.filter((item) => item.email.toLowerCase() !== result.email.toLowerCase()),
          ],
        };
      });
      setCheckInStatus((current) => ({
        ...current,
        [mission.id]:
          result.awardedPoints > 0
            ? `${result.email} awarded ${result.awardedPoints} Cuevas.`
            : `${result.email} was already checked in.`,
      }));
      if (userEmail && result.email.toLowerCase() === userEmail.toLowerCase() && typeof result.loyaltyPoints === "number") {
        setRewardsBalance(result.loyaltyPoints);
      }
      setManualEmail((current) => ({ ...current, [mission.id]: "" }));
      await loadAttendees(mission.id);
    } catch (error) {
      setCheckInStatus((current) => ({
        ...current,
        [mission.id]: `Check-in failed: ${String((error as any)?.message || error)}`,
      }));
    }
  };

  const missionQrPayload = (mission: CuevasMission) =>
    JSON.stringify({
      type: "cuevas-mission-checkin",
      missionId: mission.id,
      title: mission.title,
      businessHandle: mission.businessHandle || handle,
    });

  const generateMissionQrPdf = async (mission: CuevasMission) => {
    setCheckInStatus((current) => ({ ...current, [mission.id]: "Generating check-in QR PDF..." }));
    try {
      const qrSvg = buildQrSvg(missionQrPayload(mission), 380);
      const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { margin: 0; padding: 42px; background: #081920; color: #CFEFEC; font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif; }
      .sheet { border: 3px solid #06A7A1; border-radius: 28px; padding: 36px; text-align: center; }
      h1 { margin: 0; font-size: 42px; letter-spacing: 1px; }
      h2 { color: #06A7A1; margin: 12px 0 0; font-size: 28px; }
      p { font-size: 20px; color: #9CA3AF; line-height: 1.45; }
      .qr { width: 380px; height: 380px; margin: 28px auto; display: block; background: white; padding: 18px; border-radius: 24px; }
      .points { display: inline-block; margin-top: 8px; padding: 14px 24px; border-radius: 999px; background: #06A7A1; color: white; font-size: 24px; font-weight: 800; }
    </style>
  </head>
  <body>
    <div class="sheet">
      <h1>Scan to Check In</h1>
      <h2>${escapeHtml(mission.title)}</h2>
      <p>${escapeHtml(mission.location)}<br />${escapeHtml(mission.eventDate)}<br />Hosted by ${escapeHtml(mission.businessName || businessName)}</p>
      <div class="qr">${qrSvg}</div>
      <div class="points">+${escapeHtml(mission.points)} Cuevas</div>
      <p>Open Cuevas → Missions → Scan QR.</p>
    </div>
  </body>
</html>`;
      const printed = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(printed.uri, {
          mimeType: "application/pdf",
          dialogTitle: `${mission.title} check-in QR`,
          UTI: "com.adobe.pdf",
        });
      }
      setCheckInStatus((current) => ({ ...current, [mission.id]: "Check-in QR PDF ready." }));
    } catch (error) {
      setCheckInStatus((current) => ({
        ...current,
        [mission.id]: `QR PDF failed: ${String((error as any)?.message || error)}`,
      }));
    }
  };

  const completeMission = async (mission: CuevasMission) => {
    setCheckInStatus((current) => ({ ...current, [mission.id]: "Completing mission..." }));
    try {
      const updated = await completeCuevasMission({ missionId: mission.id, businessHandle: handle });
      setMissions((current) => current.map((item) => (item.id === mission.id ? updated : item)));
      setCheckInStatus((current) => ({ ...current, [mission.id]: "Mission completed." }));
    } catch (error) {
      setCheckInStatus((current) => ({
        ...current,
        [mission.id]: `Complete failed: ${String((error as any)?.message || error)}`,
      }));
    }
  };

  const confirmDeleteMission = (mission: CuevasMission) => {
    Alert.alert("Delete mission?", `Remove "${mission.title}" from the civic grid?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setCheckInStatus((current) => ({ ...current, [mission.id]: "Deleting mission..." }));
          try {
            await deleteCuevasMission({ missionId: mission.id, businessHandle: handle });
            setMissions((current) => current.filter((item) => item.id !== mission.id));
          } catch (error) {
            setCheckInStatus((current) => ({
              ...current,
              [mission.id]: `Delete failed: ${String((error as any)?.message || error)}`,
            }));
          }
        },
      },
    ]);
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
            @{handle} · {activeMissions.length} active mission{activeMissions.length === 1 ? "" : "s"}
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
          borderWidth: 1,
          borderColor: "#39D8D0",
          shadowColor: "#06A7A1",
          shadowOpacity: 0.22,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 3,
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
      <Field label="Event URL (optional)" value={eventUrl} onChangeText={setEventUrl} placeholder="https://example.org/event" />
      <View style={{ marginBottom: 12 }}>
        <Text style={{ color: "#9CA3AF", fontSize: 11, fontWeight: "900", letterSpacing: 1.3, marginBottom: 6 }}>
          Date / time
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[
            { mode: "date" as const, icon: "calendar-outline" as const, label: formatDatePart(eventDateTime) },
            { mode: "time" as const, icon: "time-outline" as const, label: formatTimePart(eventDateTime) },
          ].map((item) => (
            <Pressable
              key={item.mode}
              onPress={() => setDatePickerMode(item.mode)}
              style={{
                flex: 1,
                minHeight: 48,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: datePickerMode === item.mode ? "#06A7A1" : "rgba(6,167,161,0.34)",
                backgroundColor: "rgba(255,255,255,0.06)",
                paddingHorizontal: 14,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Ionicons name={item.icon} size={17} color="#06A7A1" />
              <Text style={{ color: "#CFEFEC", fontWeight: "900", fontSize: 12, marginLeft: 8, flex: 1 }}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {datePickerMode ? (
          <View style={{ marginTop: 8 }}>
            <DateTimePicker
              value={eventDateTime}
              mode={datePickerMode}
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={handleDateTimeChange}
              themeVariant="dark"
            />
            {Platform.OS === "ios" ? (
              <Pressable
                onPress={() => setDatePickerMode(null)}
                style={{
                  alignSelf: "flex-end",
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: "rgba(6,167,161,0.45)",
                  backgroundColor: "rgba(6,167,161,0.12)",
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                }}
              >
                <Text style={{ color: "#06A7A1", fontWeight: "900" }}>Done</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
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
      <Field label="People needed" value={peopleNeeded} onChangeText={setPeopleNeeded} placeholder="4" keyboardType="number-pad" />
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
          minHeight: 56,
          paddingVertical: 14,
          paddingHorizontal: 16,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          backgroundColor: "#06A7A1",
          borderWidth: 2,
          borderColor: "#B7FFFA",
          shadowColor: "#06A7A1",
          shadowOpacity: 0.3,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
          elevation: 5,
          opacity: pressed || isSubmitting ? 0.72 : 1,
        })}
      >
        <Ionicons name={isSubmitting ? "hourglass-outline" : "send"} size={18} color="#FFFFFF" />
        <Text style={{ color: "#FFFFFF", fontWeight: "900", marginLeft: 8 }}>
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
        {mission.eventUrl ? (
          <Pressable
            onPress={() => Linking.openURL(mission.eventUrl || "").catch(() => null)}
            style={{
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              marginTop: 10,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: "rgba(6,167,161,0.42)",
              backgroundColor: "rgba(6,167,161,0.10)",
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Ionicons name="globe-outline" size={16} color="#06A7A1" />
            <Text style={{ color: "#06A7A1", fontSize: 12, fontWeight: "900", marginLeft: 6 }}>Open event page</Text>
          </Pressable>
        ) : null}
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
        <Pressable
          onPress={() => setChatMission(mission)}
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
            backgroundColor: "rgba(6,167,161,0.08)",
          }}
        >
          <Ionicons name="chatbubbles-outline" size={18} color="#06A7A1" />
          <Text style={{ color: "#06A7A1", fontWeight: "900" }}>Open Mission Chat</Text>
        </Pressable>
        <Pressable
          onPress={() => generateMissionQrPdf(mission)}
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
            backgroundColor: "rgba(6,167,161,0.08)",
          }}
        >
          <Ionicons name="download-outline" size={18} color="#06A7A1" />
          <Text style={{ color: "#06A7A1", fontWeight: "900" }}>Generate QR PDF</Text>
        </Pressable>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          <Pressable
            onPress={() => completeMission(mission)}
            style={{
              flex: 1,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "rgba(6,167,161,0.45)",
              paddingVertical: 12,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 7,
            }}
          >
            <Ionicons name="checkmark-circle" size={17} color="#06A7A1" />
            <Text style={{ color: "#06A7A1", fontWeight: "900" }}>Complete</Text>
          </Pressable>
          <Pressable
            onPress={() => confirmDeleteMission(mission)}
            style={{
              flex: 1,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "rgba(239,68,68,0.45)",
              paddingVertical: 12,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 7,
            }}
          >
            <Ionicons name="trash-outline" size={17} color="#EF4444" />
            <Text style={{ color: "#EF4444", fontWeight: "900" }}>Delete</Text>
          </Pressable>
        </View>
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
          <Text style={{ color: "#CFEFEC", fontWeight: "900", marginBottom: 6 }}>Attendee emails</Text>
          {attendeeList.length ? (
            attendeeList.slice(0, 8).map((item) => (
              <View
                key={`${mission.id}-${item.email}`}
                style={{
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: item.checkedIn ? "rgba(6,167,161,0.42)" : "rgba(255,255,255,0.10)",
                  backgroundColor: item.checkedIn ? "rgba(6,167,161,0.10)" : "rgba(255,255,255,0.04)",
                  padding: 10,
                  marginBottom: 7,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ color: "#CFEFEC", fontSize: 12, fontWeight: "900", flex: 1 }} numberOfLines={1}>
                    {item.email || "No email recorded"}
                  </Text>
                  <Text style={{ color: item.checkedIn ? "#06A7A1" : "#9CA3AF", fontSize: 12, fontWeight: "900", marginLeft: 8 }}>
                    {item.checkedIn ? `+${item.awardedPoints || mission.points} ₡` : item.status || "going"}
                  </Text>
                </View>
                <Text style={{ color: "#9CA3AF", fontSize: 11, marginTop: 3 }}>
                  @{item.handle || item.email?.split("@")[0] || "attendee"}
                  {item.checkedInAt ? ` · ${new Date(item.checkedInAt).toLocaleString()}` : ""}
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
      {activeMissions.length ? (
        activeMissions.map(renderMissionScanner)
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
      <Text style={{ color: "#CFEFEC", fontSize: 18, fontWeight: "900", marginTop: 8, marginBottom: 8 }}>Past Event History</Text>
      {pastMissions.length ? (
        pastMissions.map((mission) => {
          const attendeeList = attendees[mission.id] || [];
          const checkedInCount = attendeeList.filter((item) => item.checkedIn).length;
          const proofCount = missionProofs.filter((proof) => proof.missionId === mission.id).length;
          return (
            <View
              key={`past-${mission.id}`}
              style={{
                borderRadius: 18,
                borderWidth: 1,
                borderColor: "rgba(6,167,161,0.24)",
                padding: 14,
                marginBottom: 10,
                backgroundColor: "rgba(6,167,161,0.07)",
              }}
            >
              <Text style={{ color: "#CFEFEC", fontSize: 16, fontWeight: "900" }}>{mission.title}</Text>
              <Text style={{ color: "#9CA3AF", marginTop: 4, lineHeight: 18 }}>{mission.location || "Location TBD"} · {formatBusinessMissionDate(mission)}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                <Text style={{ color: "#06A7A1", fontWeight: "900" }}>{checkedInCount} checked in</Text>
                <Text style={{ color: "#06A7A1", fontWeight: "900" }}>{attendeeList.length} registered</Text>
                <Text style={{ color: "#06A7A1", fontWeight: "900" }}>{proofCount} submissions loaded</Text>
              </View>
              {mission.description ? <Text style={{ color: "#9CA3AF", marginTop: 8, lineHeight: 18 }}>{mission.description}</Text> : null}
            </View>
          );
        })
      ) : (
        <View style={{ borderRadius: 18, borderWidth: 1, borderColor: "rgba(6,167,161,0.18)", padding: 14, backgroundColor: "rgba(255,255,255,0.05)" }}>
          <Text style={{ color: "#9CA3AF", lineHeight: 18 }}>Completed events will appear here after a mission is marked complete.</Text>
        </View>
      )}
    </>
  );

  const renderSubmissions = () => (
    <>
      <Text style={{ color: "#CFEFEC", fontSize: 18, fontWeight: "900", marginBottom: 8 }}>Mission Proof Submissions</Text>
      <Text style={{ color: "#9CA3AF", lineHeight: 19, marginBottom: 12 }}>
        User photos and videos submitted after check-in or mission completion show here for organizer review.
      </Text>
      <Pressable
        onPress={loadProofs}
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "rgba(6,167,161,0.35)",
          backgroundColor: "rgba(6,167,161,0.08)",
          paddingVertical: 11,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <Text style={{ color: "#06A7A1", fontWeight: "900" }}>Refresh Submissions</Text>
      </Pressable>
      {proofsStatus ? (
        <Text style={{ color: proofsStatus.includes("Could not") ? "#EF4444" : "#9CA3AF", fontWeight: "800", marginBottom: 10 }}>
          {proofsStatus}
        </Text>
      ) : null}
      {missionProofs.length ? (
        missionProofs.map((proof) => (
          <View
            key={proof.id || `${proof.missionId}-${proof.mediaUrl}`}
            style={{
              borderRadius: 22,
              borderWidth: 1,
              borderColor: "rgba(6,167,161,0.22)",
              padding: 12,
              marginBottom: 12,
              backgroundColor: "rgba(255,255,255,0.05)",
            }}
          >
            <View style={{ height: 180, borderRadius: 18, overflow: "hidden", backgroundColor: "#000", marginBottom: 10 }}>
              {proof.mediaType === "video" ? (
                <Video source={{ uri: proof.mediaUrl }} style={{ flex: 1 }} resizeMode={ResizeMode.COVER} useNativeControls />
              ) : (
                <Image source={{ uri: proof.mediaUrl }} style={{ flex: 1 }} contentFit="cover" />
              )}
            </View>
            <Text style={{ color: "#CFEFEC", fontWeight: "900" }}>{proof.missionTitle || proof.missionId}</Text>
            <Text style={{ color: "#9CA3AF", marginTop: 3, fontSize: 12 }}>
              @{proof.userHandle || proof.userEmail || "volunteer"} · {proof.submittedAt ? new Date(proof.submittedAt).toLocaleString() : "submitted"}
            </Text>
          </View>
        ))
      ) : null}
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
      <MissionChatModal
        visible={!!chatMission}
        mission={chatMission}
        userEmail={userEmail}
        userHandle={handle}
        authorRole="vendor"
        businessHandle={handle}
        isDarkMode
        onClose={() => setChatMission(null)}
      />
    </Modal>
  );
}

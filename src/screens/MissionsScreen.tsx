import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { Image } from "expo-image";
import { Video, ResizeMode } from "expo-av";
import * as Calendar from "expo-calendar";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CuevasMission,
  fetchCuevasMissions,
  joinCuevasMission,
} from "../api/cuevas-missions";
import { Ionicons } from "../components/Ionicons";
import { useAppStore } from "../state/appStore";
import { MainTabParamList } from "../types/navigation";
import { encodeUploadUri, uploadMediaFile } from "../utils/uploadMedia";

type Props = BottomTabScreenProps<MainTabParamList, "Missions">;

type ProofMedia = {
  id: string;
  uri: string;
  type: "image" | "video";
  name: string;
  mime: string;
  uploadedUrl?: string;
};

const fallbackMissions: CuevasMission[] = [
  {
    id: "community-service-day",
    title: "Community Service Day",
    points: 100,
    location: "Cuevas HQ + Local Park",
    eventDate: "June 8, 2026",
    eventDateISO: "2026-06-08T14:00:00.000Z",
    type: "One time",
    description: "Join the Cuevas crew for a neighborhood reset: supplies, sorting, park support, and positive energy.",
    difficulty: "Easy",
    peopleNeeded: "12 ppl",
    gearProvided: true,
    materialsNote: "Cleanup kits provided.",
    businessName: "Cuevas Civic Lab",
    businessHandle: "cuevas-civic-lab",
    businessVerified: true,
    goingCount: 8,
  },
  {
    id: "community-cleanup",
    title: "Community Cleanup",
    points: 120,
    location: "Downtown Trail Loop",
    eventDate: "June 15, 2026",
    eventDateISO: "2026-06-15T15:00:00.000Z",
    type: "Recurring",
    description: "Scan in, grab a cleanup kit, and help restore high-traffic blocks with the weekly eco squad.",
    difficulty: "Medium",
    peopleNeeded: "20 ppl",
    gearProvided: true,
    materialsNote: "Gloves and bags provided.",
    businessName: "Downtown Green Grid",
    businessHandle: "green-grid",
    businessVerified: true,
    goingCount: 14,
  },
  {
    id: "soup-kitchen",
    title: "Soup Kitchen Shift",
    points: 150,
    location: "Hope Table Kitchen",
    eventDate: "June 22, 2026",
    eventDateISO: "2026-06-22T21:00:00.000Z",
    type: "Weekly",
    description: "Assist with meal prep, packing, and guest service during a high-impact community dinner window.",
    difficulty: "High impact",
    peopleNeeded: "6 ppl",
    gearProvided: false,
    materialsNote: "Bring closed-toe shoes.",
    businessName: "Hope Table",
    businessHandle: "hope-table",
    businessVerified: true,
    goingCount: 4,
  },
  {
    id: "race-for-a-cure",
    title: "Race for a Cure",
    points: 175,
    location: "Riverfront Start Line",
    eventDate: "July 4, 2026",
    eventDateISO: "2026-07-04T12:00:00.000Z",
    type: "One time",
    description: "Volunteer at water stations, check-in, or finish-line support for a charity race activation.",
    difficulty: "Medium",
    peopleNeeded: "18 ppl",
    gearProvided: true,
    materialsNote: "Volunteer shirt provided.",
    businessName: "Riverfront Cure Run",
    businessHandle: "cure-run",
    businessVerified: true,
    goingCount: 23,
  },
  {
    id: "food-pantry-sort",
    title: "Food Pantry Sort",
    points: 90,
    location: "Northside Pantry",
    eventDate: "July 11, 2026",
    eventDateISO: "2026-07-11T16:00:00.000Z",
    type: "Monthly",
    description: "Sort donated food, prepare shelf zones, and help make pickup smoother for local families.",
    difficulty: "Easy",
    peopleNeeded: "8 ppl",
    gearProvided: true,
    materialsNote: "All materials on site.",
    businessName: "Northside Pantry",
    businessHandle: "northside-pantry",
    businessVerified: false,
    goingCount: 3,
  },
  {
    id: "senior-tech-hour",
    title: "Senior Tech Hour",
    points: 110,
    location: "Community Library",
    eventDate: "July 18, 2026",
    eventDateISO: "2026-07-18T18:00:00.000Z",
    type: "Recurring",
    description: "Help neighbors with phone setup, email basics, and safe app usage in a friendly drop-in session.",
    difficulty: "Medium",
    peopleNeeded: "5 ppl",
    gearProvided: false,
    materialsNote: "Bring your own laptop if possible.",
    businessName: "Community Library",
    businessHandle: "library-lab",
    businessVerified: true,
    goingCount: 6,
  },
];

const completedMissions: CuevasMission[] = [
  {
    id: "demo-completed",
    title: "Park Supply Drop",
    points: 80,
    location: "West Garden Block",
    eventDate: "Completed May 12, 2026",
    type: "One time",
    description: "Delivered cleanup supplies and logged the first Cuevas service checkpoint for the demo profile.",
    difficulty: "Easy",
    peopleNeeded: "3 ppl",
    gearProvided: true,
    materialsNote: "Proof upload demo.",
    businessName: "Cuevas Civic Lab",
    businessHandle: "cuevas-civic-lab",
    businessVerified: true,
    goingCount: 3,
  },
];

function parseMissionStart(mission: CuevasMission) {
  const rawDate = mission.eventDateISO || mission.eventDate;
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    const fallback = new Date();
    fallback.setHours(fallback.getHours() + 2, 0, 0, 0);
    return fallback;
  }
  return parsed;
}

async function getWritableCuevasCalendarId() {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writableCalendar = calendars.find((calendar) => calendar.allowsModifications);
  if (writableCalendar?.id) return writableCalendar.id;

  const defaultCalendar = await Calendar.getDefaultCalendarAsync().catch(() => null);
  if (defaultCalendar?.allowsModifications && defaultCalendar.id) return defaultCalendar.id;

  const defaultSource =
    Platform.OS === "ios"
      ? defaultCalendar?.source
      : { isLocalAccount: true, name: "Cuevas Missions" };
  if (!defaultSource) return null;

  return Calendar.createCalendarAsync({
    title: "Cuevas Missions",
    color: "#06A7A1",
    entityType: Calendar.EntityTypes.EVENT,
    sourceId: (defaultSource as any).id,
    source: defaultSource as any,
    name: "Cuevas Missions",
    ownerAccount: "Cuevas",
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });
}

function MissionCard({
  mission,
  isDarkMode,
  isQueued,
  isCompleted,
  onToggle,
  onAddCalendar,
  proofMedia,
  isUploadingProof,
  proofError,
  onPickProof,
  onRemoveProof,
  onSubmitProof,
}: {
  mission: CuevasMission;
  isDarkMode: boolean;
  isQueued?: boolean;
  isCompleted?: boolean;
  onToggle?: () => void;
  onAddCalendar?: () => void;
  proofMedia?: ProofMedia[];
  isUploadingProof?: boolean;
  proofError?: string;
  onPickProof?: () => void;
  onRemoveProof?: (proofId: string) => void;
  onSubmitProof?: () => void;
}) {
  const cardBg = isDarkMode ? "rgba(15, 28, 34, 0.94)" : "rgba(255,255,255,0.94)";
  const text = isDarkMode ? "#CFEFEC" : "#1F2937";
  const muted = isDarkMode ? "#9CA3AF" : "#5F6B73";
  const border = isQueued ? "#06A7A1" : isDarkMode ? "rgba(6,167,161,0.22)" : "rgba(8,25,32,0.10)";
  const pendingProofCount = (proofMedia || []).filter((item) => !item.uploadedUrl).length;

  return (
    <View
      style={{
        backgroundColor: cardBg,
        borderRadius: 24,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: border,
        shadowColor: "#000",
        shadowOpacity: isDarkMode ? 0.28 : 0.12,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          position: "absolute",
          right: -30,
          top: -30,
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: "rgba(6,167,161,0.10)",
        }}
      />

      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <LinearGradient
          colors={["#062B31", "#06A7A1"]}
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Image
            source={require("../../assets/coin.gif")}
            style={{ width: 44, height: 44 }}
            contentFit="contain"
          />
        </LinearGradient>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
            <Text style={{ color: "#06A7A1", fontSize: 11, fontWeight: "900" }} numberOfLines={1}>
              @{mission.businessHandle || "cuevas-partner"}
            </Text>
            {mission.businessVerified ? (
              <Ionicons name="checkmark-circle" size={13} color="#06A7A1" style={{ marginLeft: 4 }} />
            ) : null}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Text style={{ color: text, fontSize: 18, fontWeight: "900", flex: 1, paddingRight: 8 }}>
              {mission.title}
            </Text>
            <View
              style={{
                backgroundColor: isDarkMode ? "rgba(6,167,161,0.18)" : "#E8FFFC",
                borderColor: "#06A7A1",
                borderWidth: 1,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: "#06A7A1", fontWeight: "900", fontSize: 12 }}>
                +{mission.points} ₡
              </Text>
            </View>
          </View>

          <Text style={{ color: muted, fontSize: 13, lineHeight: 19, marginTop: 8 }}>
            {mission.description}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 14 }}>
        {[
          { icon: "location-outline", label: mission.location },
          { icon: "calendar-outline", label: mission.eventDate },
          { icon: "hourglass-outline", label: `${Math.max(1, Number(mission.durationHours || mission.points / 100 || 1))} hr` },
          { icon: mission.type === "Recurring" ? "repeat-outline" : "radio-button-on-outline", label: mission.type },
          { icon: "shield-check", label: mission.difficulty },
          { icon: "people-outline", label: `${mission.goingCount || 0} going` },
          { icon: "person-add-outline", label: mission.peopleNeeded || "Open crew" },
          { icon: mission.gearProvided ? "checkmark-circle" : "briefcase", label: mission.gearProvided ? "Gear provided" : "Bring gear" },
        ].map((item) => (
          <View
            key={`${mission.id}-${item.label}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 10,
              paddingVertical: 7,
              borderRadius: 999,
              backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(8,25,32,0.05)",
              marginRight: 8,
              marginBottom: 8,
            }}
          >
            <Ionicons name={item.icon} size={13} color="#06A7A1" />
            <Text style={{ color: muted, fontSize: 11, fontWeight: "700", marginLeft: 5 }}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>

      {mission.materialsNote ? (
        <Text style={{ color: muted, fontSize: 11, lineHeight: 16, marginTop: 2 }}>
          Materials: {mission.materialsNote}
        </Text>
      ) : null}

      {!isCompleted && onToggle ? (
        <>
          <Pressable
            onPress={onToggle}
            style={({ pressed }) => ({
              marginTop: 10,
              borderRadius: 16,
              paddingVertical: 12,
              alignItems: "center",
              backgroundColor: isQueued ? "rgba(6,167,161,0.12)" : "#06A7A1",
              borderWidth: 1,
              borderColor: "#06A7A1",
              opacity: pressed ? 0.78 : 1,
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons
                name={isQueued ? "checkmark-circle" : "add"}
                size={18}
                color={isQueued ? "#06A7A1" : "#FFFFFF"}
              />
              <Text
                style={{
                  color: isQueued ? "#06A7A1" : "#FFFFFF",
                  fontWeight: "900",
                  marginLeft: 8,
                }}
              >
                {isQueued ? "Added to My Missions" : "Add to My Missions"}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={onAddCalendar}
            style={({ pressed }) => ({
              marginTop: 12,
              borderRadius: 16,
              paddingVertical: 12,
              alignItems: "center",
              backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(8,25,32,0.05)",
              borderWidth: 1,
              borderColor: "rgba(6,167,161,0.35)",
              opacity: pressed ? 0.78 : 1,
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="calendar-outline" size={18} color="#06A7A1" />
              <Text style={{ color: "#06A7A1", fontWeight: "900", marginLeft: 8 }}>
                Add to Calendar
              </Text>
            </View>
          </Pressable>
        </>
      ) : null}

      {isCompleted ? (
        <View style={{ marginTop: 10 }}>
          {(proofMedia || []).length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              {(proofMedia || []).map((proof) => (
                <View
                  key={proof.id}
                  style={{
                    width: 92,
                    height: 92,
                    borderRadius: 16,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: proof.uploadedUrl ? "#06A7A1" : "rgba(6,167,161,0.35)",
                  }}
                >
                  {proof.type === "video" ? (
                    <Video
                      source={{ uri: proof.uri }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode={ResizeMode.COVER}
                      isMuted
                      shouldPlay={false}
                    />
                  ) : (
                    <Image source={{ uri: proof.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  )}
                  <Pressable
                    onPress={() => onRemoveProof?.(proof.id)}
                    style={{
                      position: "absolute",
                      top: 5,
                      right: 5,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: "rgba(0,0,0,0.6)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </Pressable>
                  {proof.uploadedUrl ? (
                    <View
                      style={{
                        position: "absolute",
                        left: 5,
                        bottom: 5,
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: "rgba(6,167,161,0.92)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          <Pressable
            onPress={onPickProof}
            style={({ pressed }) => ({
              borderRadius: 16,
              paddingVertical: 12,
              alignItems: "center",
              backgroundColor: "#06A7A1",
              borderWidth: 1,
              borderColor: "#06A7A1",
              opacity: pressed ? 0.78 : 1,
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="images-outline" size={18} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontWeight: "900", marginLeft: 8 }}>
                Add Proof Media
              </Text>
            </View>
          </Pressable>

          {pendingProofCount > 0 ? (
            <Pressable
              onPress={onSubmitProof}
              disabled={isUploadingProof}
              style={({ pressed }) => ({
                marginTop: 10,
                borderRadius: 16,
                paddingVertical: 12,
                alignItems: "center",
                backgroundColor: "#80171F",
                opacity: pressed || isUploadingProof ? 0.72 : 1,
              })}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontWeight: "900", marginLeft: 8 }}>
                  {isUploadingProof ? "Uploading Proof..." : `Submit ${pendingProofCount} Upload${pendingProofCount === 1 ? "" : "s"}`}
                </Text>
              </View>
            </Pressable>
          ) : null}

          <Text style={{ color: muted, fontSize: 11, marginTop: 8, textAlign: "center" }}>
            Upload multiple photos or videos for mission proof.
          </Text>
          {proofError ? (
            <Text style={{ color: "#EF4444", fontSize: 11, fontWeight: "800", marginTop: 6, textAlign: "center" }}>
              {proofError}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function SectionHeader({
  title,
  subtitle,
  icon,
  isDarkMode,
}: {
  title: string;
  subtitle: string;
  icon: string;
  isDarkMode: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 22, marginBottom: 10 }}>
      <View>
        <Text style={{ color: isDarkMode ? "#CFEFEC" : "#1F2937", fontSize: 18, fontWeight: "900" }}>
          {title}
        </Text>
        <Text style={{ color: isDarkMode ? "#9CA3AF" : "#5F6B73", fontSize: 12, marginTop: 2 }}>
          {subtitle}
        </Text>
      </View>
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isDarkMode ? "rgba(6,167,161,0.16)" : "#E8FFFC",
          borderWidth: 1,
          borderColor: "rgba(6,167,161,0.35)",
        }}
      >
        <Ionicons name={icon} size={18} color="#06A7A1" />
      </View>
    </View>
  );
}

export default function MissionsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const isDarkMode = useAppStore((state) => state.isDarkMode);
  const rewardsBalance = useAppStore((state) => state.rewardsBalance);
  const userEmail = useAppStore((state) => state.userEmail);
  const displayName = useAppStore((state) => state.displayName);
  const [missions, setMissions] = useState<CuevasMission[]>(fallbackMissions);
  const [isLoadingMissions, setIsLoadingMissions] = useState(false);
  const [missionError, setMissionError] = useState<string | null>(null);
  const [queuedMissionIds, setQueuedMissionIds] = useState<string[]>(["community-cleanup"]);
  const [proofMedia, setProofMedia] = useState<Record<string, ProofMedia[]>>({});
  const [uploadingProofIds, setUploadingProofIds] = useState<Record<string, boolean>>({});
  const [proofErrors, setProofErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    setIsLoadingMissions(true);
    fetchCuevasMissions()
      .then((nextMissions) => {
        if (!cancelled && nextMissions.length > 0) {
          setMissions(nextMissions);
          setMissionError(null);
        }
      })
    .catch((error) => {
      if (!cancelled) {
          console.log("[MISSIONS] sync failed", String((error as any)?.message || error));
          setMissionError("Using demo missions while Wix syncs.");
      }
    })
      .finally(() => {
        if (!cancelled) setIsLoadingMissions(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const queuedMissions = useMemo(
    () => missions.filter((mission) => queuedMissionIds.includes(mission.id)),
    [missions, queuedMissionIds]
  );

  const updateGoingCount = (missionId: string, goingCount: number) => {
    setMissions((current) =>
      current.map((mission) =>
        mission.id === missionId
          ? { ...mission, goingCount: Math.max(goingCount, mission.goingCount || 0) }
          : mission
      )
    );
  };

  const toggleMission = async (mission: CuevasMission) => {
    if (queuedMissionIds.includes(mission.id)) {
      setQueuedMissionIds((current) => current.filter((missionId) => missionId !== mission.id));
      return;
    }

    setQueuedMissionIds((current) => [...current, mission.id]);
    setMissions((current) =>
      current.map((item) =>
        item.id === mission.id ? { ...item, goingCount: (item.goingCount || 0) + 1 } : item
      )
    );
    try {
      const result = await joinCuevasMission({
        missionId: mission.id,
        userEmail,
        userHandle: displayName || userEmail?.split("@")[0] || "anonymous",
      });
      updateGoingCount(mission.id, result.goingCount);
    } catch (error) {
      console.log("[MISSIONS] signup failed", String(error));
    }
  };

  const addMissionToCalendar = async (mission: CuevasMission) => {
    try {
      const permission = await Calendar.requestCalendarPermissionsAsync();
      if (!permission.granted) {
        setMissionError("Calendar permission is required.");
        return;
      }
      const calendarId = await getWritableCuevasCalendarId();
      if (!calendarId) {
        setMissionError("No writable calendar found.");
        return;
      }
      const startDate = parseMissionStart(mission);
      const durationHours = Math.max(1, Number(mission.durationHours || mission.points / 100 || 1));
      const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);
      await Calendar.createEventAsync(calendarId, {
        title: `Cuevas Mission: ${mission.title}`,
        location: mission.location,
        notes: `${mission.description}\n\nHost: ${mission.businessName || "Cuevas Partner"}\nDuration: ${durationHours} hour${durationHours === 1 ? "" : "s"}\nPoints: ${mission.points} Cuevas`,
        startDate,
        endDate,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setMissionError("Mission added to calendar.");
    } catch (error) {
      setMissionError(`Calendar add failed: ${String((error as any)?.message || error)}`);
    }
  };

  const pickProofMedia = async (missionId: string) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.82,
      videoMaxDuration: 60,
      selectionLimit: 8,
    });
    if (result.canceled) return;

    const selected = (result.assets || [])
      .filter((asset) => !!asset.uri)
      .map((asset) => {
        const isVideo = asset.type === "video" || /\.(mp4|mov|m4v)$/i.test(asset.uri);
        const mime =
          (asset as any).mimeType ||
          (isVideo
            ? asset.uri.toLowerCase().endsWith(".mov")
              ? "video/quicktime"
              : "video/mp4"
            : "image/jpeg");
        const extension = mime === "video/quicktime" ? "mov" : mime.startsWith("video/") ? "mp4" : "jpg";
        return {
          id: `proof-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          uri: asset.uri,
          type: isVideo ? "video" : "image",
          name: (asset as any).fileName || `mission-proof-${Date.now()}.${extension}`,
          mime,
        } as ProofMedia;
      });

    if (selected.length > 0) {
      setProofMedia((current) => ({
        ...current,
        [missionId]: [...(current[missionId] || []), ...selected],
      }));
      setProofErrors((current) => ({ ...current, [missionId]: "" }));
    }
  };

  const removeProofMedia = (missionId: string, proofId: string) => {
    setProofMedia((current) => ({
      ...current,
      [missionId]: (current[missionId] || []).filter((proof) => proof.id !== proofId),
    }));
  };

  const submitProofMedia = async (missionId: string) => {
    const pendingMedia = (proofMedia[missionId] || []).filter((item) => !item.uploadedUrl);
    if (!pendingMedia.length) {
      setProofErrors((current) => ({ ...current, [missionId]: "Choose proof media first." }));
      return;
    }

    setUploadingProofIds((current) => ({ ...current, [missionId]: true }));
    setProofErrors((current) => ({ ...current, [missionId]: "" }));
    try {
      const uploadedItems: ProofMedia[] = [];
      for (const proof of pendingMedia) {
        let uploadUri = proof.uri;
        let fileName = proof.name;
        let mimeType = proof.mime;

        if (proof.type === "image") {
          const compressed = await ImageManipulator.manipulateAsync(
            proof.uri,
            [{ resize: { width: 1080 } }],
            { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG }
          );
          uploadUri = compressed.uri;
          fileName = `mission-proof-${missionId}-${Date.now()}.jpg`;
          mimeType = "image/jpeg";
        }

        const encodedUri = encodeUploadUri(
          uploadUri,
          fileName,
          mimeType,
          proof.type,
          "mission-proof"
        );
        const uploadedUrl = await uploadMediaFile(encodedUri, "mission-proof");
        uploadedItems.push({ ...proof, uri: uploadedUrl, uploadedUrl });
      }

      setProofMedia((current) => ({
        ...current,
        [missionId]: (current[missionId] || []).map((proof) => {
          const uploaded = uploadedItems.find((item) => item.id === proof.id);
          return uploaded || proof;
        }),
      }));
    } catch (error) {
      setProofErrors((current) => ({
        ...current,
        [missionId]: `Upload failed: ${String((error as any)?.message || error)}`,
      }));
    } finally {
      setUploadingProofIds((current) => ({ ...current, [missionId]: false }));
    }
  };

  return (
    <LinearGradient
      colors={isDarkMode ? ["#081920", "#0A0A0A"] : ["#CFEFEC", "#F7FFFF"]}
      style={{ flex: 1, paddingTop: insets.top }}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 34 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 16 }}>
          <View>
            <Text style={{ color: isDarkMode ? "#CFEFEC" : "#1F2937", fontSize: 30, fontWeight: "900" }}>
              Missions
            </Text>
            <Text style={{ color: isDarkMode ? "#9CA3AF" : "#5F6B73", marginTop: 4 }}>
              Dynamic partner events from the Cuevas civic grid.
            </Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate("RewardsBalance")}
            style={({ pressed }) => ({
              opacity: pressed ? 0.75 : 1,
              alignItems: "center",
              justifyContent: "center",
              width: 58,
              height: 58,
              borderRadius: 20,
              backgroundColor: isDarkMode ? "rgba(6,167,161,0.16)" : "#FFFFFF",
              borderWidth: 1,
              borderColor: "rgba(6,167,161,0.35)",
            })}
          >
            <Image source={require("../../assets/coin.gif")} style={{ width: 32, height: 32 }} contentFit="contain" />
            <Text style={{ color: "#06A7A1", fontSize: 10, fontWeight: "900" }}>{rewardsBalance} ₡</Text>
          </Pressable>
        </View>

        <LinearGradient
          colors={isDarkMode ? ["rgba(6,167,161,0.24)", "rgba(128,23,31,0.20)"] : ["#FFFFFF", "#E8FFFC"]}
          style={{
            borderRadius: 28,
            marginTop: 18,
            padding: 18,
            borderWidth: 1,
            borderColor: "rgba(6,167,161,0.28)",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 18,
                backgroundColor: "#06A7A1",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <Ionicons name="radio-button-on" size={26} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: isDarkMode ? "#CFEFEC" : "#1F2937", fontSize: 17, fontWeight: "900" }}>
                Cuevas Civic Grid
              </Text>
              <Text style={{ color: isDarkMode ? "#9CA3AF" : "#5F6B73", fontSize: 12, lineHeight: 18, marginTop: 2 }}>
                Businesses publish missions, users join, calendars sync, and attendance counts update live.
              </Text>
              {missionError ? (
              <Text style={{ color: missionError.includes("added") || missionError.includes("Using") ? "#06A7A1" : "#EF4444", fontSize: 11, fontWeight: "800", marginTop: 8 }}>
                  {missionError}
                </Text>
              ) : null}
            </View>
          </View>
        </LinearGradient>

        <SectionHeader
          title="My Mission Queue"
          subtitle={`${queuedMissions.length} selected for your custom list`}
          icon="list-checks"
          isDarkMode={isDarkMode}
        />
        {queuedMissions.length ? (
          queuedMissions.map((mission) => (
            <MissionCard
              key={`queued-${mission.id}`}
              mission={mission}
              isDarkMode={isDarkMode}
              isQueued
              onToggle={() => toggleMission(mission)}
              onAddCalendar={() => addMissionToCalendar(mission)}
            />
          ))
        ) : (
          <View
            style={{
              borderRadius: 22,
              padding: 18,
              backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "#FFFFFF",
              borderWidth: 1,
              borderColor: isDarkMode ? "rgba(255,255,255,0.10)" : "rgba(8,25,32,0.08)",
            }}
          >
            <Text style={{ color: isDarkMode ? "#9CA3AF" : "#5F6B73" }}>
              Add missions below to build your custom service list.
            </Text>
          </View>
        )}

        <SectionHeader
          title="Available Missions"
          subtitle={isLoadingMissions ? "Syncing from Wix mission collection..." : "Live partner missions and demo fallbacks"}
          icon="radio-button-on"
          isDarkMode={isDarkMode}
        />
        {missions.map((mission) => (
          <MissionCard
            key={mission.id}
            mission={mission}
            isDarkMode={isDarkMode}
            isQueued={queuedMissionIds.includes(mission.id)}
            onToggle={() => toggleMission(mission)}
            onAddCalendar={() => addMissionToCalendar(mission)}
          />
        ))}

        <SectionHeader
          title="Completed"
          subtitle="Proof uploads support multiple photos and videos"
          icon="shield-check"
          isDarkMode={isDarkMode}
        />
        {completedMissions.map((mission) => (
          <MissionCard
            key={mission.id}
            mission={mission}
            isDarkMode={isDarkMode}
            isCompleted
            proofMedia={proofMedia[mission.id] || []}
            isUploadingProof={!!uploadingProofIds[mission.id]}
            proofError={proofErrors[mission.id]}
            onPickProof={() => pickProofMedia(mission.id)}
            onRemoveProof={(proofId) => removeProofMedia(mission.id, proofId)}
            onSubmitProof={() => submitProofMedia(mission.id)}
          />
        ))}
      </ScrollView>
    </LinearGradient>
  );
}

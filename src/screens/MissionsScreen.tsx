import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "../components/Ionicons";
import { useAppStore } from "../state/appStore";
import { MainTabParamList } from "../types/navigation";
import { encodeUploadUri, uploadMediaFile } from "../utils/uploadMedia";

type Props = BottomTabScreenProps<MainTabParamList, "Missions">;

type Mission = {
  id: string;
  title: string;
  points: number;
  location: string;
  eventDate: string;
  type: "One time" | "Recurring" | "Weekly" | "Monthly";
  description: string;
  difficulty: "Easy" | "Medium" | "High impact";
};

const availableMissions: Mission[] = [
  {
    id: "community-service-day",
    title: "Community Service Day",
    points: 100,
    location: "Cuevas HQ + Local Park",
    eventDate: "June 8, 2026",
    type: "One time",
    description: "Join the Cuevas crew for a neighborhood reset: supplies, sorting, park support, and positive energy.",
    difficulty: "Easy",
  },
  {
    id: "community-cleanup",
    title: "Community Cleanup",
    points: 120,
    location: "Downtown Trail Loop",
    eventDate: "June 15, 2026",
    type: "Recurring",
    description: "Scan in, grab a cleanup kit, and help restore high-traffic blocks with the weekly eco squad.",
    difficulty: "Medium",
  },
  {
    id: "soup-kitchen",
    title: "Soup Kitchen Shift",
    points: 150,
    location: "Hope Table Kitchen",
    eventDate: "June 22, 2026",
    type: "Weekly",
    description: "Assist with meal prep, packing, and guest service during a high-impact community dinner window.",
    difficulty: "High impact",
  },
  {
    id: "race-for-a-cure",
    title: "Race for a Cure",
    points: 175,
    location: "Riverfront Start Line",
    eventDate: "July 4, 2026",
    type: "One time",
    description: "Volunteer at water stations, check-in, or finish-line support for a charity race activation.",
    difficulty: "Medium",
  },
  {
    id: "food-pantry-sort",
    title: "Food Pantry Sort",
    points: 90,
    location: "Northside Pantry",
    eventDate: "July 11, 2026",
    type: "Monthly",
    description: "Sort donated food, prepare shelf zones, and help make pickup smoother for local families.",
    difficulty: "Easy",
  },
  {
    id: "senior-tech-hour",
    title: "Senior Tech Hour",
    points: 110,
    location: "Community Library",
    eventDate: "July 18, 2026",
    type: "Recurring",
    description: "Help neighbors with phone setup, email basics, and safe app usage in a friendly drop-in session.",
    difficulty: "Medium",
  },
];

const completedMissions: Mission[] = [
  {
    id: "demo-completed",
    title: "Park Supply Drop",
    points: 80,
    location: "West Garden Block",
    eventDate: "Completed May 12, 2026",
    type: "One time",
    description: "Delivered cleanup supplies and logged the first Cuevas service checkpoint for the demo profile.",
    difficulty: "Easy",
  },
];

function MissionCard({
  mission,
  isDarkMode,
  isQueued,
  isCompleted,
  onToggle,
  proofUri,
  uploadedProofUrl,
  isUploadingProof,
  proofError,
  onPickProof,
  onSubmitProof,
}: {
  mission: Mission;
  isDarkMode: boolean;
  isQueued?: boolean;
  isCompleted?: boolean;
  onToggle?: () => void;
  proofUri?: string;
  uploadedProofUrl?: string;
  isUploadingProof?: boolean;
  proofError?: string;
  onPickProof?: () => void;
  onSubmitProof?: () => void;
}) {
  const cardBg = isDarkMode ? "rgba(15, 28, 34, 0.94)" : "rgba(255,255,255,0.94)";
  const text = isDarkMode ? "#CFEFEC" : "#1F2937";
  const muted = isDarkMode ? "#9CA3AF" : "#5F6B73";
  const border = isQueued ? "#06A7A1" : isDarkMode ? "rgba(6,167,161,0.22)" : "rgba(8,25,32,0.10)";

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
          { icon: mission.type === "Recurring" ? "repeat-outline" : "radio-button-on-outline", label: mission.type },
          { icon: "shield-check", label: mission.difficulty },
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

      {!isCompleted && onToggle ? (
        <Pressable
          onPress={onToggle}
          style={({ pressed }) => ({
            marginTop: 4,
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
      ) : null}

      {isCompleted ? (
        <View style={{ marginTop: 6 }}>
          {proofUri ? (
            <View
              style={{
                borderRadius: 18,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: "rgba(6,167,161,0.35)",
                marginBottom: 10,
              }}
            >
              <Image source={{ uri: uploadedProofUrl || proofUri }} style={{ width: "100%", height: 150 }} contentFit="cover" />
            </View>
          ) : null}
          <Pressable
            onPress={onPickProof}
            style={({ pressed }) => ({
              borderRadius: 16,
              paddingVertical: 12,
              alignItems: "center",
              backgroundColor: proofUri ? "rgba(6,167,161,0.12)" : "#06A7A1",
              borderWidth: 1,
              borderColor: "#06A7A1",
              opacity: pressed ? 0.78 : 1,
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name={proofUri ? "image" : "camera-outline"} size={18} color={proofUri ? "#06A7A1" : "#FFFFFF"} />
              <Text
                style={{
                  color: proofUri ? "#06A7A1" : "#FFFFFF",
                  fontWeight: "900",
                  marginLeft: 8,
                }}
              >
                {proofUri ? "Replace Proof Photo" : "Choose Proof Photo"}
              </Text>
            </View>
          </Pressable>
          {proofUri && !uploadedProofUrl ? (
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
                  {isUploadingProof ? "Uploading Proof..." : "Submit Proof Upload"}
                </Text>
              </View>
            </Pressable>
          ) : null}
          {uploadedProofUrl ? (
            <Text style={{ color: "#06A7A1", fontSize: 11, fontWeight: "900", marginTop: 8, textAlign: "center" }}>
              Proof uploaded for demo.
            </Text>
          ) : (
            <Text style={{ color: muted, fontSize: 11, marginTop: 8, textAlign: "center" }}>
              Pick a photo, then submit it to upload.
            </Text>
          )}
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
  const isDarkMode = useAppStore((s) => s.isDarkMode);
  const rewardsBalance = useAppStore((s) => s.rewardsBalance);
  const [queuedMissionIds, setQueuedMissionIds] = useState<string[]>(["community-cleanup"]);
  const [proofPhotos, setProofPhotos] = useState<Record<string, string>>({});
  const [uploadedProofUrls, setUploadedProofUrls] = useState<Record<string, string>>({});
  const [uploadingProofIds, setUploadingProofIds] = useState<Record<string, boolean>>({});
  const [proofErrors, setProofErrors] = useState<Record<string, string>>({});

  const queuedMissions = useMemo(
    () => availableMissions.filter((mission) => queuedMissionIds.includes(mission.id)),
    [queuedMissionIds]
  );

  const toggleMission = (id: string) => {
    setQueuedMissionIds((current) =>
      current.includes(id) ? current.filter((missionId) => missionId !== id) : [...current, id]
    );
  };

  const pickProofPhoto = async (missionId: string) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.82,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setProofPhotos((current) => ({ ...current, [missionId]: result.assets[0].uri }));
      setUploadedProofUrls((current) => {
        const next = { ...current };
        delete next[missionId];
        return next;
      });
      setProofErrors((current) => ({ ...current, [missionId]: "" }));
    }
  };

  const submitProofPhoto = async (missionId: string) => {
    const proofUri = proofPhotos[missionId];
    if (!proofUri) {
      setProofErrors((current) => ({ ...current, [missionId]: "Choose a proof photo first." }));
      return;
    }

    setUploadingProofIds((current) => ({ ...current, [missionId]: true }));
    setProofErrors((current) => ({ ...current, [missionId]: "" }));
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        proofUri,
        [{ resize: { width: 1080 } }],
        { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG }
      );
      const uploadUri = encodeUploadUri(
        compressed.uri,
        `mission-proof-${missionId}-${Date.now()}.jpg`,
        "image/jpeg",
        "image",
        "mission-proof"
      );
      const uploadedUrl = await uploadMediaFile(uploadUri, "mission-proof");
      setUploadedProofUrls((current) => ({ ...current, [missionId]: uploadedUrl }));
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
              Earn Cuevas by helping the community.
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
                Pick missions, show up, scan in, and turn real-world service into rewards.
              </Text>
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
              onToggle={() => toggleMission(mission.id)}
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
          subtitle="Placeholder demo tasks ready to claim"
          icon="radio-button-on"
          isDarkMode={isDarkMode}
        />
        {availableMissions.map((mission) => (
          <MissionCard
            key={mission.id}
            mission={mission}
            isDarkMode={isDarkMode}
            isQueued={queuedMissionIds.includes(mission.id)}
            onToggle={() => toggleMission(mission.id)}
          />
        ))}

        <SectionHeader
          title="Completed"
          subtitle="Demo completed task for profile proof"
          icon="shield-check"
          isDarkMode={isDarkMode}
        />
        {completedMissions.map((mission) => (
          <MissionCard
            key={mission.id}
            mission={mission}
            isDarkMode={isDarkMode}
            isCompleted
            proofUri={proofPhotos[mission.id]}
            uploadedProofUrl={uploadedProofUrls[mission.id]}
            isUploadingProof={!!uploadingProofIds[mission.id]}
            proofError={proofErrors[mission.id]}
            onPickProof={() => pickProofPhoto(mission.id)}
            onSubmitProof={() => submitProofPhoto(mission.id)}
          />
        ))}
      </ScrollView>
    </LinearGradient>
  );
}

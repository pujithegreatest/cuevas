import React, { useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import {
  Canvas,
  Image as SkiaImage,
  ColorMatrix,
  useImage,
} from "@shopify/react-native-skia";
import { StoryFilter } from "../types/story";

interface StoryFilterCanvasProps {
  uri: string;
  filter: StoryFilter;
  width: number;
  height: number;
  contentFit?: "cover" | "contain";
  mediaType?: "image" | "video";
  videoShouldPlay?: boolean;
  videoLooping?: boolean;
  videoMuted?: boolean;
  videoStartMs?: number;
  videoEndMs?: number;
  onVideoLoad?: (durationMs: number) => void;
  onVideoTrimComplete?: () => void;
}

const HEATWAVE_ASSETS = {
  heatBar: require("../../assets/filters/heatwave/ir-heat-bar.png"),
  pcIcon: require("../../assets/filters/heatwave/pc-icon.png"),
  batteryIcon: require("../../assets/filters/heatwave/battery-icon.png"),
  sdIcon: require("../../assets/filters/heatwave/sd-card.png"),
};

// 4x5 ColorMatrix tables per filter
const MATRICES: Record<StoryFilter, number[] | null> = {
  none: null,

  heatwave: [
    1.55, -0.45, 0.75, 0, -0.12,
    0.15, 0.45, 0.18, 0, -0.04,
    -0.45, 0.65, 1.65, 0, 0.08,
    0, 0, 0, 1, 0,
  ],

  hologram: [
    0.2, 0.4, 0.5, 0, 0,
    0.1, 1.1, 0.5, 0, 0.02,
    0.2, 0.45, 1.3, 0, 0.04,
    0, 0, 0, 1, 0,
  ],

  vaporwave: [
    1.2, 0.1, 0.5, 0, 0.04,
    0.2, 0.7, 0.4, 0, 0,
    0.6, 0.2, 1.1, 0, 0.04,
    0, 0, 0, 1, 0,
  ],

  infrared: [
    1.5, 0.6, 0.2, 0, -0.1,
    0.0, 1.2, 0.4, 0, -0.15,
    0.8, 0.2, 0.0, 0, 0.05,
    0, 0, 0, 1, 0,
  ],

  matrix: [
    0.0, 0.4, 0.0, 0, 0,
    0.1, 1.4, 0.2, 0, 0.04,
    0.0, 0.3, 0.0, 0, 0,
    0, 0, 0, 1, 0,
  ],

  void: [
    0.9, 0.9, 0.9, 0, -0.35,
    0.9, 0.9, 0.9, 0, -0.35,
    0.95, 0.95, 0.95, 0, -0.3,
    0, 0, 0, 1, 0,
  ],

  glitch: [
    1.05, 0.0, 0.0, 0, 0,
    0.0, 1.05, 0.0, 0, 0,
    0.0, 0.0, 1.1, 0, 0,
    0, 0, 0, 1, 0,
  ],

  noir: [
    0.5, 0.5, 0.5, 0, -0.1,
    0.5, 0.5, 0.5, 0, -0.1,
    0.5, 0.5, 0.5, 0, -0.1,
    0, 0, 0, 1, 0,
  ],

  sepia: [
    0.393, 0.769, 0.189, 0, 0,
    0.349, 0.686, 0.168, 0, 0,
    0.272, 0.534, 0.131, 0, 0,
    0, 0, 0, 1, 0,
  ],

  acid: [
    0.6, 1.0, 0.0, 0, 0,
    0.2, 1.4, 0.2, 0, 0.04,
    0.0, 0.6, 0.1, 0, 0,
    0, 0, 0, 1, 0,
  ],

  arctic: [
    0.6, 0.2, 0.4, 0, 0.1,
    0.2, 0.9, 0.6, 0, 0.12,
    0.4, 0.6, 1.4, 0, 0.18,
    0, 0, 0, 1, 0,
  ],

  dream: [
    1.0, 0.2, 0.1, 0, 0.12,
    0.1, 0.95, 0.25, 0, 0.12,
    0.2, 0.2, 1.0, 0, 0.18,
    0, 0, 0, 1, 0,
  ],

  neon: [
    1.6, 0.0, 0.4, 0, 0,
    0.0, 1.1, 0.3, 0, 0,
    0.6, 0.0, 1.6, 0, 0.05,
    0, 0, 0, 1, 0,
  ],

  xray: [
    -1, 0, 0, 0, 1,
    0, -1, 0, 0, 1,
    0, 0, -1, 0, 1,
    0, 0, 0, 1, 0,
  ],

  thermal: [
    1.8, 0.4, 0.0, 0, -0.15,
    0.0, 0.6, 1.0, 0, -0.05,
    1.4, 0.0, 0.5, 0, -0.1,
    0, 0, 0, 1, 0,
  ],

  predator: [
    0.0, 1.2, 0.0, 0, 0.1,
    1.6, 0.0, 0.0, 0, -0.05,
    0.0, 0.0, 0.4, 0, -0.05,
    0, 0, 0, 1, 0,
  ],

  scanner: [
    0.0, 0.3, 0.6, 0, 0,
    0.1, 1.3, 1.1, 0, 0.05,
    0.0, 1.0, 0.4, 0, 0,
    0, 0, 0, 1, 0,
  ],

  chrome: [
    0.6, 0.7, 0.7, 0, 0.05,
    0.6, 0.7, 0.7, 0, 0.05,
    0.7, 0.8, 0.9, 0, 0.08,
    0, 0, 0, 1, 0,
  ],

  radioactive: [
    0.4, 1.4, 0.2, 0, 0.04,
    0.6, 1.2, 0.0, 0, 0,
    0.0, 0.3, 0.1, 0, 0,
    0, 0, 0, 1, 0,
  ],
};

function ScanlineOverlay({ width, height }: { width: number; height: number }) {
  const lines: React.ReactElement[] = [];
  const step = 3;
  for (let y = 0; y < height; y += step) {
    lines.push(
      <View
        key={y}
        style={{
          position: "absolute",
          top: y,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: "rgba(0,0,0,0.18)",
        }}
      />
    );
  }
  return <>{lines}</>;
}

// Color-tint overlays approximate the look of each filter when applied to video,
// since Skia color matrix only runs on the still-image branch.
const VIDEO_TINTS: Record<StoryFilter, string | null> = {
  none: null,
  heatwave: "rgba(126,0,210,0.24)",
  hologram: "rgba(0,200,255,0.25)",
  vaporwave: "rgba(255,0,200,0.18)",
  infrared: "rgba(200,0,80,0.28)",
  matrix: "rgba(0,200,0,0.22)",
  void: "rgba(0,0,0,0.4)",
  glitch: "rgba(0,220,255,0.18)",
  noir: "rgba(0,0,0,0.35)",
  sepia: "rgba(112,66,20,0.4)",
  acid: "rgba(150,255,0,0.28)",
  arctic: "rgba(60,160,255,0.32)",
  dream: "rgba(255,180,230,0.28)",
  neon: "rgba(255,0,180,0.28)",
  xray: "rgba(255,255,255,0.5)",
  thermal: "rgba(255,80,0,0.35)",
  predator: "rgba(180,0,30,0.32)",
  scanner: "rgba(0,220,180,0.28)",
  chrome: "rgba(180,200,220,0.3)",
  radioactive: "rgba(120,255,0,0.32)",
};

function HeatwaveGrid({ width, height }: { width: number; height: number }) {
  const lines: React.ReactElement[] = [];
  const verticalStep = Math.max(18, Math.round(width / 18));
  const horizontalStep = Math.max(18, Math.round(height / 28));
  for (let x = 0; x <= width; x += verticalStep) {
    lines.push(
      <View
        key={`v-${x}`}
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: x,
          width: 1,
          backgroundColor: "rgba(0,255,255,0.055)",
        }}
      />
    );
  }
  for (let y = 0; y <= height; y += horizontalStep) {
    lines.push(
      <View
        key={`h-${y}`}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: y,
          height: 1,
          backgroundColor: "rgba(255,255,255,0.045)",
        }}
      />
    );
  }
  return <>{lines}</>;
}

function formatHeatwaveClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function HeatwaveHud({ width, height }: { width: number; height: number }) {
  const focusX = 0.528;
  const focusY = 0.417;
  const temp = 36.5 + ((Math.round(width + height) % 8) / 10);
  const centerX = width * focusX;
  const centerY = height * focusY;

  return (
    <>
      <HeatwaveGrid width={width} height={height} />
      <ScanlineOverlay width={width} height={height} />
      <View
        style={{
          position: "absolute",
          top: Math.max(8, height * 0.025),
          left: Math.max(8, width * 0.035),
          right: Math.max(8, width * 0.035),
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
        pointerEvents="none"
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Image
            source={HEATWAVE_ASSETS.pcIcon}
            style={{ width: 22, height: 15, tintColor: "#d9ffff" }}
            contentFit="contain"
          />
          <Text
            style={{
              color: "#e9ffff",
              fontSize: 12,
              fontWeight: "900",
              letterSpacing: 1.5,
            }}
          >
            CAM 5
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text
            style={{
              color: "#e9ffff",
              fontSize: 11,
              fontWeight: "900",
              letterSpacing: 1.2,
              textShadowColor: "#00d5ff",
              textShadowRadius: 6,
            }}
          >
            {formatHeatwaveClock()}
          </Text>
          <Image
            source={HEATWAVE_ASSETS.batteryIcon}
            style={{ width: 11, height: 18, tintColor: "#d9ffff" }}
            contentFit="contain"
          />
        </View>
      </View>

      <View
        style={{
          position: "absolute",
          right: Math.max(6, width * 0.025),
          top: height * 0.18,
          height: height * 0.48,
          width: Math.max(24, width * 0.075),
          alignItems: "center",
        }}
        pointerEvents="none"
      >
        <Text style={styles.heatwaveScaleLabel}>{(temp + 5.8).toFixed(1)}</Text>
        <Image
          source={HEATWAVE_ASSETS.heatBar}
          style={{ width: "100%", flex: 1 }}
          contentFit="contain"
        />
        <Text style={styles.heatwaveScaleLabel}>{(temp - 18.4).toFixed(1)}</Text>
      </View>

      <View
        style={[
          styles.heatwaveTargetBox,
          {
            left: centerX - width * 0.12,
            top: centerY - height * 0.07,
            width: width * 0.24,
            height: height * 0.14,
          },
        ]}
        pointerEvents="none"
      />
      <View
        style={{
          position: "absolute",
          left: centerX - 22,
          top: centerY - 0.5,
          width: 44,
          height: 1,
          backgroundColor: "rgba(180,255,255,0.8)",
        }}
        pointerEvents="none"
      />
      <View
        style={{
          position: "absolute",
          left: centerX - 0.5,
          top: centerY - 22,
          width: 1,
          height: 44,
          backgroundColor: "rgba(180,255,255,0.8)",
        }}
        pointerEvents="none"
      />
      <View
        style={[
          styles.heatwaveTempBadge,
          {
            left: Math.min(width - 138, centerX + width * 0.08),
            top: Math.max(18, centerY - height * 0.07),
          },
        ]}
        pointerEvents="none"
      >
        <Text style={styles.heatwaveId}>ID : 758426592</Text>
        <Text style={styles.heatwaveTemp}>{temp.toFixed(1)} °C</Text>
      </View>

      <View
        style={{
          position: "absolute",
          left: Math.max(8, width * 0.04),
          bottom: Math.max(10, height * 0.025),
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
        pointerEvents="none"
      >
        <Image
          source={HEATWAVE_ASSETS.sdIcon}
          style={{ width: 18, height: 18, tintColor: "#d9ffff" }}
          contentFit="contain"
        />
        <Text style={styles.heatwaveFooter}>BIOMETRIC IDENTIFICATION : ON</Text>
      </View>
      <Text
        style={[
          styles.heatwaveFooter,
          {
            position: "absolute",
            right: Math.max(8, width * 0.04),
            bottom: Math.max(10, height * 0.025),
          },
        ]}
        pointerEvents="none"
      >
        BODY TEMP DETECTION : ON
      </Text>
    </>
  );
}

function FilterEffects({
  filter,
  width,
  height,
}: {
  filter: StoryFilter;
  width: number;
  height: number;
}) {
  switch (filter) {
    case "heatwave":
      return (
        <>
          <LinearGradient
            colors={[
              "rgba(5,8,75,0.48)",
              "rgba(98,0,170,0.28)",
              "rgba(255,122,0,0.16)",
              "rgba(0,216,255,0.12)",
            ]}
            locations={[0, 0.42, 0.7, 1]}
            style={[StyleSheet.absoluteFill]}
          />
          <HeatwaveHud width={width} height={height} />
        </>
      );
    case "hologram":
      return (
        <>
          <LinearGradient
            colors={["rgba(0,255,240,0.15)", "rgba(0,100,255,0.1)"]}
            style={[StyleSheet.absoluteFill]}
          />
          <ScanlineOverlay width={width} height={height} />
        </>
      );
    case "vaporwave":
      return (
        <LinearGradient
          colors={["rgba(255,0,200,0.18)", "rgba(0,200,255,0.18)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill]}
        />
      );
    case "infrared":
      return (
        <LinearGradient
          colors={[
            "rgba(40,0,80,0.25)",
            "rgba(0,0,0,0)",
            "rgba(255,180,0,0.18)",
          ]}
          style={[StyleSheet.absoluteFill]}
        />
      );
    case "matrix":
      return (
        <>
          <LinearGradient
            colors={["rgba(0,80,0,0.15)", "rgba(0,30,0,0.25)"]}
            style={[StyleSheet.absoluteFill]}
          />
          <ScanlineOverlay width={width} height={height} />
        </>
      );
    case "void":
      return (
        <LinearGradient
          colors={["rgba(0,0,0,0.35)", "rgba(0,0,0,0)", "rgba(0,0,0,0.45)"]}
          style={[StyleSheet.absoluteFill]}
        />
      );
    case "glitch":
      return (
        <>
          <View
            style={{
              position: "absolute",
              top: 0,
              left: -3,
              right: 3,
              bottom: 0,
              backgroundColor: "rgba(255,0,40,0.18)",
            }}
          />
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 3,
              right: -3,
              bottom: 0,
              backgroundColor: "rgba(0,220,255,0.15)",
            }}
          />
          <ScanlineOverlay width={width} height={height} />
        </>
      );
    case "noir":
      return (
        <LinearGradient
          colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0.1)", "rgba(0,0,0,0.6)"]}
          style={[StyleSheet.absoluteFill]}
        />
      );
    case "sepia":
      return (
        <LinearGradient
          colors={["rgba(112,66,20,0.18)", "rgba(196,164,132,0.12)"]}
          style={[StyleSheet.absoluteFill]}
        />
      );
    case "acid":
      return (
        <>
          <LinearGradient
            colors={["rgba(150,255,0,0.18)", "rgba(255,255,0,0.12)"]}
            style={[StyleSheet.absoluteFill]}
          />
          <ScanlineOverlay width={width} height={height} />
        </>
      );
    case "arctic":
      return (
        <LinearGradient
          colors={["rgba(220,240,255,0.25)", "rgba(60,160,255,0.18)"]}
          style={[StyleSheet.absoluteFill]}
        />
      );
    case "dream":
      return (
        <LinearGradient
          colors={["rgba(255,180,230,0.18)", "rgba(180,220,255,0.18)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill]}
        />
      );
    case "neon":
      return (
        <>
          <LinearGradient
            colors={["rgba(255,0,180,0.18)", "rgba(0,220,255,0.18)"]}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={[StyleSheet.absoluteFill]}
          />
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: height * 0.18,
              height: 1.5,
              backgroundColor: "rgba(255,0,180,0.45)",
            }}
          />
        </>
      );
    case "xray":
      return (
        <LinearGradient
          colors={["rgba(0,255,255,0.18)", "rgba(255,255,255,0.1)"]}
          style={[StyleSheet.absoluteFill]}
        />
      );
    case "thermal":
      return (
        <>
          <LinearGradient
            colors={[
              "rgba(255,0,0,0.22)",
              "rgba(255,150,0,0.15)",
              "rgba(255,255,0,0.18)",
              "rgba(0,80,255,0.18)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[StyleSheet.absoluteFill]}
          />
          <View
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              paddingHorizontal: 6,
              paddingVertical: 2,
              backgroundColor: "rgba(0,0,0,0.55)",
              borderRadius: 4,
            }}
            pointerEvents="none"
          >
            <Text
              style={{
                color: "#FF3B00",
                fontSize: 9,
                fontWeight: "800",
                letterSpacing: 1,
              }}
            >
              ●  REC  THERM
            </Text>
          </View>
        </>
      );
    case "predator":
      return (
        <>
          <LinearGradient
            colors={["rgba(120,0,0,0.45)", "rgba(255,80,0,0.18)", "rgba(0,0,0,0.45)"]}
            style={[StyleSheet.absoluteFill]}
          />
          <ScanlineOverlay width={width} height={height} />
          <View
            style={{
              position: "absolute",
              left: width / 2 - 0.5,
              top: 0,
              bottom: 0,
              width: 1,
              backgroundColor: "rgba(255,80,0,0.35)",
            }}
            pointerEvents="none"
          />
          <View
            style={{
              position: "absolute",
              top: height / 2 - 0.5,
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: "rgba(255,80,0,0.35)",
            }}
            pointerEvents="none"
          />
        </>
      );
    case "scanner":
      return (
        <>
          <LinearGradient
            colors={["rgba(0,255,200,0.15)", "rgba(0,80,140,0.18)"]}
            style={[StyleSheet.absoluteFill]}
          />
          <ScanlineOverlay width={width} height={height} />
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: height * 0.38,
              height: 2,
              backgroundColor: "rgba(0,255,200,0.55)",
            }}
            pointerEvents="none"
          />
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: height * 0.42,
              height: 14,
              backgroundColor: "rgba(0,255,200,0.08)",
            }}
            pointerEvents="none"
          />
        </>
      );
    case "chrome":
      return (
        <LinearGradient
          colors={[
            "rgba(255,255,255,0.18)",
            "rgba(180,200,230,0.08)",
            "rgba(80,90,110,0.18)",
            "rgba(255,255,255,0.18)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill]}
        />
      );
    case "radioactive":
      return (
        <>
          <LinearGradient
            colors={["rgba(120,255,0,0.22)", "rgba(0,40,0,0.32)"]}
            style={[StyleSheet.absoluteFill]}
          />
          <ScanlineOverlay width={width} height={height} />
        </>
      );
    default:
      return null;
  }
}

export default function StoryFilterCanvas({
  uri,
  filter,
  width,
  height,
  contentFit = "cover",
  mediaType = "image",
  videoShouldPlay = false,
  videoLooping = false,
  videoMuted = true,
  videoStartMs,
  videoEndMs,
  onVideoLoad,
  onVideoTrimComplete,
}: StoryFilterCanvasProps) {
  const skImage = useImage(mediaType === "image" ? uri : null);
  const matrix = MATRICES[filter];
  const videoTint = VIDEO_TINTS[filter];
  const videoRef = useRef<Video | null>(null);
  const didSeekRef = useRef(false);
  const completedRef = useRef(false);

  if (mediaType === "video") {
    const handleStatus = (status: AVPlaybackStatus) => {
      if (!status.isLoaded) return;
      if (typeof videoEndMs === "number" && videoEndMs > 0) {
        const pos = status.positionMillis || 0;
        if (pos >= videoEndMs - 30) {
          if (videoLooping) {
            const startTarget = videoStartMs || 0;
            videoRef.current?.setPositionAsync(startTarget).catch(() => {});
          } else if (!completedRef.current) {
            completedRef.current = true;
            videoRef.current?.pauseAsync().catch(() => {});
            if (onVideoTrimComplete) onVideoTrimComplete();
          }
        }
      }
    };

    return (
      <View style={{ width, height, overflow: "hidden", backgroundColor: "#000" }}>
        <Video
          ref={videoRef}
          source={{ uri }}
          style={{ width, height }}
          resizeMode={
            contentFit === "cover" ? ResizeMode.COVER : ResizeMode.CONTAIN
          }
          shouldPlay={videoShouldPlay}
          isLooping={videoLooping && !videoEndMs}
          isMuted={videoMuted}
          onLoad={(status: any) => {
            if (status?.durationMillis && onVideoLoad) {
              onVideoLoad(status.durationMillis);
            }
            if (
              !didSeekRef.current &&
              typeof videoStartMs === "number" &&
              videoStartMs > 0
            ) {
              didSeekRef.current = true;
              videoRef.current
                ?.setPositionAsync(videoStartMs)
                .catch(() => {});
            }
          }}
          onPlaybackStatusUpdate={handleStatus}
          progressUpdateIntervalMillis={50}
        />
        {videoTint && (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: videoTint },
            ]}
            pointerEvents="none"
          />
        )}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <FilterEffects filter={filter} width={width} height={height} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ width, height, overflow: "hidden", backgroundColor: "#000" }}>
      {skImage && matrix ? (
        <Canvas style={{ width, height }}>
          <SkiaImage
            image={skImage}
            x={0}
            y={0}
            width={width}
            height={height}
            fit={contentFit}
          >
            <ColorMatrix matrix={matrix} />
          </SkiaImage>
        </Canvas>
      ) : skImage ? (
        <Canvas style={{ width, height }}>
          <SkiaImage
            image={skImage}
            x={0}
            y={0}
            width={width}
            height={height}
            fit={contentFit}
          />
        </Canvas>
      ) : (
        <Image
          source={{ uri }}
          style={{ width, height }}
          contentFit={contentFit}
        />
      )}

      <FilterEffects filter={filter} width={width} height={height} />
    </View>
  );
}

const styles = StyleSheet.create({
  heatwaveScaleLabel: {
    color: "#e9ffff",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    textShadowColor: "#00d5ff",
    textShadowRadius: 5,
  },
  heatwaveTargetBox: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: "rgba(170,255,255,0.82)",
    borderStyle: "dashed",
    backgroundColor: "rgba(0,255,255,0.05)",
  },
  heatwaveTempBadge: {
    position: "absolute",
    minWidth: 112,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(164,255,255,0.35)",
    backgroundColor: "rgba(10,20,55,0.46)",
  },
  heatwaveId: {
    color: "#d9ffff",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  heatwaveTemp: {
    color: "#43ff34",
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: 0.7,
    textShadowColor: "#00ff9d",
    textShadowRadius: 8,
  },
  heatwaveFooter: {
    color: "#d9ffff",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.8,
    textShadowColor: "#00d5ff",
    textShadowRadius: 5,
  },
});

import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
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
  heatwaveAnimated?: boolean;
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
    0.35, 0.1, 1.35, 0, -0.04,
    0.58, 0.18, 0.64, 0, -0.02,
    1.25, -0.12, 0.22, 0, 0.02,
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
  heatwave: "rgba(13,0,140,0.26)",
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

function getHeatwaveTelemetry(tick: number, width: number, height: number) {
  const wave = Math.sin(tick * 0.62);
  const jitter = Math.sin((tick + width) * 1.37) * 0.12 + Math.cos((tick + height) * 0.71) * 0.08;
  return {
    temp: 36.7 + wave * 0.52 + jitter,
    focusX: 0.5 + Math.sin(tick * 0.31) * 0.045,
    focusY: 0.41 + Math.cos(tick * 0.24) * 0.03,
  };
}

function HeatwaveThermalMap({ width, height, tick, animated = true }: { width: number; height: number; tick: number; animated?: boolean }) {
  const phase = animated ? tick : 8;
  const drift = Math.sin(phase * 0.32) * width * 0.018;
  const scanY = height * (0.18 + ((phase % 24) / 24) * 0.62);
  const bands = Array.from({ length: 9 }).map((_, index) => {
    const y = height * (0.08 + index * 0.105) + Math.sin(phase * 0.2 + index) * 8;
    const warm = index % 3 === 1;
    return { y, warm };
  });

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <SvgLinearGradient id="heatBase" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#2d006e" stopOpacity="0.62" />
          <Stop offset="0.28" stopColor="#2636ff" stopOpacity="0.46" />
          <Stop offset="0.56" stopColor="#00a7ff" stopOpacity="0.34" />
          <Stop offset="0.76" stopColor="#ff4c00" stopOpacity="0.26" />
          <Stop offset="1" stopColor="#fff1b0" stopOpacity="0.20" />
        </SvgLinearGradient>
        <SvgLinearGradient id="thermalBand" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#1437ff" stopOpacity="0.08" />
          <Stop offset="0.24" stopColor="#006dff" stopOpacity="0.18" />
          <Stop offset="0.5" stopColor="#19ffd5" stopOpacity="0.16" />
          <Stop offset="0.72" stopColor="#ffdb35" stopOpacity="0.14" />
          <Stop offset="1" stopColor="#ff3b00" stopOpacity="0.12" />
        </SvgLinearGradient>
        <SvgLinearGradient id="warmEdge" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#fff6c7" stopOpacity="0.22" />
          <Stop offset="0.45" stopColor="#ff6f00" stopOpacity="0.18" />
          <Stop offset="1" stopColor="#00e5ff" stopOpacity="0.12" />
        </SvgLinearGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill="url(#heatBase)" />
      {bands.map((band, index) => (
        <Path
          key={`heat-band-${index}`}
          d={`M ${-width * 0.1} ${band.y} C ${width * 0.18 + drift} ${band.y - 42}, ${width * 0.48 - drift} ${band.y + 46}, ${width * 1.1} ${band.y - 24} L ${width * 1.1} ${band.y + 62} C ${width * 0.62} ${band.y + 90}, ${width * 0.32} ${band.y + 26}, ${-width * 0.1} ${band.y + 82} Z`}
          fill={band.warm ? "url(#warmEdge)" : "url(#thermalBand)"}
          opacity={band.warm ? 0.55 : 0.42}
        />
      ))}
      <Rect x="0" y={scanY} width={width} height="2" fill="#caffff" opacity="0.18" />
      <Path
        d={`M ${width * 0.02} ${height * 0.86} C ${width * 0.22} ${height * 0.76}, ${width * 0.44} ${height * 0.85}, ${width * 0.62} ${height * 0.72} L ${width} ${height * 0.78} L ${width} ${height} L 0 ${height} Z`}
        fill="#002fff"
        opacity="0.18"
      />
    </Svg>
  );
}

function HeatwaveThermoGun({
  width,
  height,
  centerX,
  centerY,
  tick,
}: {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  tick: number;
}) {
  const phase = (tick % 18) / 18;
  const arcOpacity = 0.35 + Math.sin(tick * 0.8) * 0.12;

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path
        d={`M ${centerX - width * 0.5} ${centerY + height * 0.24} C ${centerX - width * 0.26} ${centerY - height * 0.28}, ${centerX + width * 0.26} ${centerY - height * 0.28}, ${centerX + width * 0.5} ${centerY + height * 0.24}`}
        stroke="#00c8ff"
        strokeWidth="5"
        strokeOpacity={arcOpacity}
        fill="none"
      />
      <Path
        d={`M ${centerX - width * 0.37} ${centerY + height * 0.18} C ${centerX - width * 0.18} ${centerY - height * 0.14}, ${centerX + width * 0.18} ${centerY - height * 0.14}, ${centerX + width * 0.37} ${centerY + height * 0.18}`}
        stroke="#2ef0ff"
        strokeWidth="4"
        strokeOpacity="0.28"
        fill="none"
      />
      <Path
        d={`M ${centerX - width * 0.23} ${centerY + height * 0.1} C ${centerX - width * 0.1} ${centerY - height * 0.04}, ${centerX + width * 0.1} ${centerY - height * 0.04}, ${centerX + width * 0.23} ${centerY + height * 0.1}`}
        stroke="#82faff"
        strokeWidth="2.5"
        strokeOpacity="0.32"
        fill="none"
      />
      <Rect
        x={centerX - width * 0.16}
        y={centerY - height * 0.17}
        width={width * 0.32}
        height={height * 0.2}
        stroke="#8afcff"
        strokeWidth="1.6"
        strokeOpacity="0.72"
        strokeDasharray="6 5"
        fill="rgba(0,255,255,0.025)"
      />
      <Rect
        x={centerX - width * 0.26}
        y={centerY - height * 0.01}
        width={width * 0.52}
        height={height * 0.3}
        stroke="#00d8ff"
        strokeWidth="1.2"
        strokeOpacity="0.44"
        strokeDasharray="8 7"
        fill="rgba(0,110,255,0.025)"
      />
      <Path
        d={`M ${width * 0.08} ${centerY + height * 0.23} L ${centerX - width * 0.08} ${centerY + height * 0.02} L ${centerX - width * 0.02} ${centerY - height * 0.02}`}
        stroke="#00eaff"
        strokeWidth="2.2"
        strokeOpacity="0.78"
        fill="none"
      />
      <Path
        d={`M ${width * 0.07} ${centerY + height * 0.23} L ${width * 0.14} ${centerY + height * 0.29} L ${width * 0.2} ${centerY + height * 0.2}`}
        stroke="#d9ffff"
        strokeWidth="2"
        strokeOpacity="0.72"
        fill="none"
      />
      <Rect
        x={centerX - 11 - phase * 14}
        y={centerY - 11 - phase * 14}
        width={22 + phase * 28}
        height={22 + phase * 28}
        stroke="#8afcff"
        strokeWidth="1.4"
        strokeOpacity={0.62 - phase * 0.36}
        fill="none"
      />
      <Path d={`M ${centerX - 24} ${centerY} L ${centerX + 24} ${centerY} M ${centerX} ${centerY - 24} L ${centerX} ${centerY + 24}`} stroke="#aaffff" strokeWidth="1.5" strokeOpacity="0.86" />
    </Svg>
  );
}

export function HeatwaveHud({
  width,
  height,
  animated = true,
  topInset = 0,
  bottomInset = 0,
}: {
  width: number;
  height: number;
  animated?: boolean;
  topInset?: number;
  bottomInset?: number;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!animated) return;
    const id = setInterval(() => setTick((value) => value + 1), 550);
    return () => clearInterval(id);
  }, [animated]);

  const telemetry = getHeatwaveTelemetry(tick, width, height);
  const focusX = telemetry.focusX;
  const focusY = telemetry.focusY;
  const temp = telemetry.temp;
  const centerX = width * focusX;
  const centerY = height * focusY;
  const tempF = temp * 1.8 + 32;
  const idSuffix = String(758426592 + (tick % 91)).padStart(9, "0");

  return (
    <>
      <HeatwaveThermalMap width={width} height={height} tick={tick} animated={animated} />
      <HeatwaveThermoGun width={width} height={height} centerX={centerX} centerY={centerY} tick={tick} />
      <HeatwaveGrid width={width} height={height} />
      <ScanlineOverlay width={width} height={height} />
      <View
        style={{
          position: "absolute",
          top: topInset + Math.max(8, height * 0.025),
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
          left: Math.max(8, width * 0.04),
          top: height * 0.13,
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderWidth: 1,
          borderColor: "rgba(138,252,255,0.45)",
          backgroundColor: "rgba(0,10,24,0.28)",
        }}
        pointerEvents="none"
      >
        <Text style={styles.heatwaveTelemetrySmall}>THERMO CAM ONLINE</Text>
        <Text style={styles.heatwaveStatLine}>CORE {temp.toFixed(1)} °C / {tempF.toFixed(1)} °F</Text>
        <Text style={styles.heatwaveStatLine}>X {focusX.toFixed(3)}  Y {focusY.toFixed(3)}</Text>
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
        <Text style={styles.heatwaveId}>ID : {idSuffix}</Text>
        <Text style={styles.heatwaveTemp}>{temp.toFixed(1)} °C</Text>
        <Text style={styles.heatwaveLock}>THERMO LOCK</Text>
      </View>

      <View
        style={[
          styles.heatwaveGunBadge,
          {
            left: Math.max(8, width * 0.06),
            top: Math.min(height - 92, centerY + height * 0.25),
          },
        ]}
        pointerEvents="none"
      >
        <Text style={styles.heatwaveGunLabel}>THERMO GUN</Text>
        <Text style={styles.heatwaveGunValue}>SCAN PULSE {String(tick % 100).padStart(2, "0")}</Text>
      </View>

      <View
        style={{
          position: "absolute",
          left: Math.max(8, width * 0.04),
          right: Math.max(8, width * 0.04),
          bottom: bottomInset + Math.max(10, height * 0.025),
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
        pointerEvents="none"
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          <Image
            source={HEATWAVE_ASSETS.sdIcon}
            style={{ width: 18, height: 18, tintColor: "#d9ffff" }}
            contentFit="contain"
          />
          <Text style={styles.heatwaveFooter} numberOfLines={1}>BIOMETRIC ID : ON</Text>
        </View>
        <Text style={[styles.heatwaveFooter, { flex: 1, textAlign: "right" }]} numberOfLines={1}>BODY TEMP : ON</Text>
      </View>
    </>
  );
}

function useHudTick(enabled = true, intervalMs = 500) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setTick((value) => value + 1), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);
  return tick;
}

function HudBadge({
  label,
  value,
  accent,
  style,
}: {
  label: string;
  value?: string;
  accent: string;
  style?: any;
}) {
  return (
    <View
      style={[
        styles.hudBadge,
        { borderColor: `${accent}77`, backgroundColor: "rgba(0,8,18,0.56)" },
        style,
      ]}
      pointerEvents="none"
    >
      <Text style={[styles.hudBadgeLabel, { color: accent }]}>{label}</Text>
      {value ? <Text style={styles.hudBadgeValue}>{value}</Text> : null}
    </View>
  );
}

function FaceRecognitionHud({
  width,
  height,
  accent = "#00ffc8",
  label = "FACE LOCK",
  value = "MATCH 98.7%",
}: {
  width: number;
  height: number;
  accent?: string;
  label?: string;
  value?: string;
}) {
  const tick = useHudTick(true, 430);
  const faceW = width * 0.48;
  const faceH = height * 0.28;
  const faceX = width * 0.5 - faceW / 2 + Math.sin(tick * 0.55) * 5;
  const faceY = height * 0.25 + Math.cos(tick * 0.38) * 4;
  const scanY = faceY + (((tick % 12) + 1) / 13) * faceH;
  const dot = [
    [0.31, 0.34],
    [0.44, 0.32],
    [0.56, 0.32],
    [0.69, 0.34],
    [0.5, 0.47],
    [0.38, 0.62],
    [0.5, 0.68],
    [0.62, 0.62],
  ];

  return (
    <>
      <LinearGradient
        colors={["rgba(0,0,0,0.06)", `${accent}16`, "rgba(0,0,0,0.18)"]}
        style={StyleSheet.absoluteFill}
      />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Rect
          x={faceX}
          y={faceY}
          width={faceW}
          height={faceH}
          rx={18}
          stroke={accent}
          strokeWidth={2}
          strokeOpacity={0.78}
          strokeDasharray="12 8"
          fill="rgba(0,0,0,0.02)"
        />
        <Rect
          x={faceX + faceW * 0.09}
          y={faceY + faceH * 0.17}
          width={faceW * 0.82}
          height={faceH * 0.66}
          rx={14}
          stroke="#e9ffff"
          strokeWidth={1}
          strokeOpacity={0.34}
          fill="none"
        />
        <Line x1={faceX - 18} y1={scanY} x2={faceX + faceW + 18} y2={scanY} stroke={accent} strokeWidth={3} strokeOpacity={0.7} />
        <Line x1={faceX + faceW * 0.5} y1={faceY - 18} x2={faceX + faceW * 0.5} y2={faceY + faceH + 18} stroke={accent} strokeWidth={1} strokeOpacity={0.35} />
        <Line x1={faceX - 12} y1={faceY + faceH * 0.5} x2={faceX + faceW + 12} y2={faceY + faceH * 0.5} stroke={accent} strokeWidth={1} strokeOpacity={0.35} />
        {dot.map(([x, y], index) => (
          <Circle
            key={`face-dot-${index}`}
            cx={faceX + faceW * x}
            cy={faceY + faceH * y}
            r={index === 4 ? 4 : 3}
            fill={accent}
            opacity={index === tick % dot.length ? 0.95 : 0.55}
          />
        ))}
        <Path
          d={`M ${faceX + faceW * 0.34} ${faceY + faceH * 0.71} C ${faceX + faceW * 0.43} ${faceY + faceH * 0.82}, ${faceX + faceW * 0.57} ${faceY + faceH * 0.82}, ${faceX + faceW * 0.66} ${faceY + faceH * 0.71}`}
          stroke={accent}
          strokeWidth={2}
          strokeOpacity={0.72}
          fill="none"
        />
        <SvgText x={faceX + 10} y={faceY - 12} fill={accent} fontSize="11" fontWeight="900">
          {label}
        </SvgText>
        <SvgText x={faceX + faceW - 102} y={faceY + faceH + 22} fill="#e9ffff" fontSize="10" fontWeight="900">
          {value}
        </SvgText>
      </Svg>
      <HudBadge label="BIOMETRIC SCAN" value="SUBJECT ACQUIRED" accent={accent} style={{ left: width * 0.06, top: height * 0.14 }} />
      <HudBadge label="DEPTH" value={`${String(44 + (tick % 9)).padStart(2, "0")}m`} accent={accent} style={{ right: width * 0.06, top: height * 0.56 }} />
    </>
  );
}

function ThermalScannerHud({
  width,
  height,
  accent = "#ff6a00",
  infrared = false,
}: {
  width: number;
  height: number;
  accent?: string;
  infrared?: boolean;
}) {
  const tick = useHudTick(true, 520);
  const phase = tick * 0.34;
  const blobs = [
    { x: 0.26, y: 0.34, rx: 0.17, ry: 0.1, color: "#fff263" },
    { x: 0.63, y: 0.28, rx: 0.2, ry: 0.12, color: infrared ? "#ff2d55" : "#ff5b00" },
    { x: 0.49, y: 0.57, rx: 0.28, ry: 0.16, color: infrared ? "#7a00ff" : "#00c8ff" },
  ];

  return (
    <>
      <LinearGradient
        colors={
          infrared
            ? ["rgba(20,0,48,0.3)", "rgba(255,45,85,0.18)", "rgba(255,180,0,0.12)"]
            : ["rgba(0,38,88,0.22)", "rgba(255,91,0,0.18)", "rgba(255,242,99,0.14)"]
        }
        style={StyleSheet.absoluteFill}
      />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <SvgLinearGradient id="thermalSweep" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={accent} stopOpacity="0.0" />
            <Stop offset="0.5" stopColor={accent} stopOpacity="0.62" />
            <Stop offset="1" stopColor={accent} stopOpacity="0.0" />
          </SvgLinearGradient>
        </Defs>
        {blobs.map((blob, index) => (
          <Path
            key={`thermal-blob-${index}`}
            d={`M ${width * (blob.x - blob.rx)} ${height * blob.y}
              C ${width * (blob.x - blob.rx * 0.7)} ${height * (blob.y - blob.ry - Math.sin(phase + index) * 0.018)},
                ${width * (blob.x + blob.rx * 0.7)} ${height * (blob.y - blob.ry + Math.cos(phase + index) * 0.014)},
                ${width * (blob.x + blob.rx)} ${height * blob.y}
              C ${width * (blob.x + blob.rx * 0.7)} ${height * (blob.y + blob.ry)},
                ${width * (blob.x - blob.rx * 0.8)} ${height * (blob.y + blob.ry * 0.8)},
                ${width * (blob.x - blob.rx)} ${height * blob.y} Z`}
            fill={blob.color}
            opacity={index === 0 ? 0.25 : 0.2}
          />
        ))}
        <Rect x="0" y={height * (0.22 + ((tick % 16) / 16) * 0.48)} width={width} height="18" fill="url(#thermalSweep)" opacity="0.22" />
        <Rect x={width * 0.08} y={height * 0.18} width={width * 0.84} height={height * 0.46} rx={18} stroke={accent} strokeWidth={1.4} strokeOpacity={0.46} fill="none" />
        <Line x1={width * 0.08} y1={height * 0.41} x2={width * 0.92} y2={height * 0.41} stroke="#e9ffff" strokeWidth={1} strokeOpacity={0.24} />
        <Line x1={width * 0.5} y1={height * 0.18} x2={width * 0.5} y2={height * 0.64} stroke="#e9ffff" strokeWidth={1} strokeOpacity={0.24} />
        <SvgText x={width * 0.1} y={height * 0.17} fill={accent} fontSize="10" fontWeight="900">
          {infrared ? "IR SIGNATURE MAP" : "THERMAL FIELD"}
        </SvgText>
      </Svg>
      <HudBadge label={infrared ? "IR LOCK" : "HEAT INDEX"} value={`${91 + (tick % 7)}.${tick % 10}F`} accent={accent} style={{ left: width * 0.07, top: height * 0.66 }} />
    </>
  );
}

function NeonCircuitHud({ width, height }: { width: number; height: number }) {
  const tick = useHudTick(true, 360);
  const accent = "#00f5ff";
  const pink = "#ff39d8";
  const nodes = [
    [0.15, 0.26],
    [0.32, 0.2],
    [0.5, 0.31],
    [0.69, 0.22],
    [0.84, 0.34],
    [0.7, 0.55],
    [0.48, 0.62],
    [0.28, 0.52],
  ];
  return (
    <>
      <LinearGradient
        colors={["rgba(0,245,255,0.1)", "rgba(255,57,216,0.13)", "rgba(0,0,0,0.18)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        {nodes.map((node, index) => {
          const next = nodes[(index + 1) % nodes.length];
          return (
            <Line
              key={`neon-line-${index}`}
              x1={width * node[0]}
              y1={height * node[1]}
              x2={width * next[0]}
              y2={height * next[1]}
              stroke={index % 2 ? pink : accent}
              strokeWidth={2}
              strokeOpacity={0.42}
            />
          );
        })}
        {nodes.map((node, index) => (
          <Circle
            key={`neon-node-${index}`}
            cx={width * node[0]}
            cy={height * node[1]}
            r={index === tick % nodes.length ? 8 : 4}
            fill={index % 2 ? pink : accent}
            opacity={index === tick % nodes.length ? 0.8 : 0.5}
          />
        ))}
        <Circle cx={width * 0.5} cy={height * 0.42} r={width * 0.18} stroke={accent} strokeWidth={2} strokeOpacity={0.45} fill="none" />
        <Circle cx={width * 0.5} cy={height * 0.42} r={width * 0.1} stroke={pink} strokeWidth={2} strokeOpacity={0.55} fill="none" />
        <Line x1={width * 0.36} y1={height * 0.42} x2={width * 0.64} y2={height * 0.42} stroke="#e9ffff" strokeWidth={1} strokeOpacity={0.42} />
        <Line x1={width * 0.5} y1={height * 0.3} x2={width * 0.5} y2={height * 0.54} stroke="#e9ffff" strokeWidth={1} strokeOpacity={0.42} />
      </Svg>
      <HudBadge label="NEON CIRCUIT" value="ENERGY ROUTED" accent={accent} style={{ left: width * 0.07, top: height * 0.16 }} />
    </>
  );
}

function SynthLawHud({ width, height }: { width: number; height: number }) {
  const tick = useHudTick(true, 480);
  const accent = "#ff4dff";
  return (
    <>
      <LinearGradient
        colors={["rgba(255,77,255,0.14)", "rgba(0,234,255,0.12)", "rgba(20,0,48,0.24)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path
          d={`M ${width * 0.08} ${height * 0.61} L ${width * 0.27} ${height * 0.39} L ${width * 0.48} ${height * 0.58} L ${width * 0.72} ${height * 0.35} L ${width * 0.92} ${height * 0.57}`}
          stroke="#00eaff"
          strokeWidth={2}
          strokeOpacity={0.6}
          fill="none"
        />
        {Array.from({ length: 7 }).map((_, index) => (
          <Line
            key={`synth-horizon-${index}`}
            x1={width * (0.04 + index * 0.15)}
            y1={height * 0.74}
            x2={width * (0.22 + index * 0.09)}
            y2={height * 0.52}
            stroke={accent}
            strokeWidth={1}
            strokeOpacity={0.24}
          />
        ))}
        {Array.from({ length: 4 }).map((_, index) => (
          <Rect
            key={`synth-card-${index}`}
            x={width * (0.18 + index * 0.16)}
            y={height * (0.22 + Math.sin(tick * 0.4 + index) * 0.015)}
            width={width * 0.12}
            height={height * 0.08}
            rx={8}
            stroke={index % 2 ? "#00eaff" : accent}
            strokeWidth={1.5}
            strokeOpacity={0.58}
            fill="rgba(0,0,0,0.12)"
          />
        ))}
        <SvgText x={width * 0.2} y={height * 0.2} fill={accent} fontSize="12" fontWeight="900">
          SYNTH AUTH PASS
        </SvgText>
      </Svg>
      <HudBadge label="PROFILE" value="VERIFIED" accent={accent} style={{ right: width * 0.07, top: height * 0.62 }} />
    </>
  );
}

function XraySkeletonHud({ width, height }: { width: number; height: number }) {
  const accent = "#cfefff";
  return (
    <>
      <LinearGradient
        colors={["rgba(0,255,255,0.12)", "rgba(255,255,255,0.08)", "rgba(0,28,60,0.22)"]}
        style={StyleSheet.absoluteFill}
      />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={width * 0.5} cy={height * 0.28} r={width * 0.11} stroke={accent} strokeWidth={2} strokeOpacity={0.55} fill="rgba(255,255,255,0.04)" />
        <Line x1={width * 0.5} y1={height * 0.39} x2={width * 0.5} y2={height * 0.62} stroke={accent} strokeWidth={2} strokeOpacity={0.45} />
        {Array.from({ length: 6 }).map((_, index) => {
          const y = height * (0.42 + index * 0.032);
          return (
            <Path
              key={`xray-rib-${index}`}
              d={`M ${width * 0.5} ${y} C ${width * 0.39} ${y - 10}, ${width * 0.33} ${y + 8}, ${width * 0.28} ${y + 18} M ${width * 0.5} ${y} C ${width * 0.61} ${y - 10}, ${width * 0.67} ${y + 8}, ${width * 0.72} ${y + 18}`}
              stroke={accent}
              strokeWidth={1.5}
              strokeOpacity={0.38}
              fill="none"
            />
          );
        })}
        <Rect x={width * 0.22} y={height * 0.18} width={width * 0.56} height={height * 0.5} rx={20} stroke="#00eaff" strokeWidth={1.4} strokeOpacity={0.38} fill="none" />
      </Svg>
      <HudBadge label="X-RAY" value="STRUCTURE MAP" accent="#cfefff" style={{ left: width * 0.07, top: height * 0.67 }} />
    </>
  );
}

function MatrixIdentityHud({ width, height }: { width: number; height: number }) {
  const tick = useHudTick(true, 360);
  const accent = "#58ff39";
  return (
    <>
      <LinearGradient colors={["rgba(0,80,0,0.16)", "rgba(0,0,0,0.18)"]} style={StyleSheet.absoluteFill} />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        {Array.from({ length: 8 }).map((_, index) => (
          <SvgText
            key={`matrix-code-${index}`}
            x={width * (0.08 + index * 0.11)}
            y={height * (0.16 + ((tick + index * 3) % 15) * 0.035)}
            fill={accent}
            fontSize="9"
            fontWeight="900"
            opacity={0.28 + (index % 3) * 0.12}
          >
            {index % 2 ? "01 10 11" : "ID 74 A9"}
          </SvgText>
        ))}
        <Rect x={width * 0.24} y={height * 0.24} width={width * 0.52} height={height * 0.34} rx={16} stroke={accent} strokeWidth={2} strokeOpacity={0.62} fill="rgba(0,40,0,0.06)" />
        <Line x1={width * 0.24} y1={height * 0.41} x2={width * 0.76} y2={height * 0.41} stroke={accent} strokeWidth={1} strokeOpacity={0.5} />
        <Line x1={width * 0.5} y1={height * 0.24} x2={width * 0.5} y2={height * 0.58} stroke={accent} strokeWidth={1} strokeOpacity={0.5} />
      </Svg>
      <HudBadge label="MATRIX ID" value="DECODED" accent={accent} style={{ right: width * 0.07, top: height * 0.62 }} />
    </>
  );
}

function ScannerGateHud({ width, height }: { width: number; height: number }) {
  const tick = useHudTick(true, 420);
  const accent = "#00ffc8";
  const gateY = height * (0.2 + ((tick % 14) / 14) * 0.42);
  return (
    <>
      <LinearGradient colors={["rgba(0,255,200,0.12)", "rgba(0,80,140,0.18)"]} style={StyleSheet.absoluteFill} />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Rect x={width * 0.13} y={height * 0.17} width={width * 0.74} height={height * 0.5} rx={12} stroke={accent} strokeWidth={1.6} strokeOpacity={0.48} fill="none" />
        <Rect x={width * 0.18} y={gateY} width={width * 0.64} height={24} fill={accent} opacity={0.12} />
        <Line x1={width * 0.13} y1={gateY} x2={width * 0.87} y2={gateY} stroke={accent} strokeWidth={3} strokeOpacity={0.72} />
        {Array.from({ length: 5 }).map((_, index) => (
          <Rect
            key={`scan-target-${index}`}
            x={width * (0.22 + index * 0.12)}
            y={height * (0.28 + (index % 2) * 0.18)}
            width={width * 0.08}
            height={height * 0.07}
            rx={6}
            stroke="#e9ffff"
            strokeWidth={1.2}
            strokeOpacity={0.36}
            fill="none"
          />
        ))}
      </Svg>
      <HudBadge label="SCANNER" value="SWEEP ACTIVE" accent={accent} style={{ left: width * 0.07, top: height * 0.69 }} />
    </>
  );
}

function GlitchArHud({ width, height }: { width: number; height: number }) {
  const tick = useHudTick(true, 250);
  const bands = [
    { y: 0.22, h: 0.035, c: "rgba(255,0,64,0.24)", dx: -10 },
    { y: 0.39, h: 0.022, c: "rgba(0,220,255,0.24)", dx: 8 },
    { y: 0.57, h: 0.03, c: "rgba(255,255,255,0.18)", dx: -5 },
  ];
  return (
    <>
      {bands.map((band, index) => (
        <View
          key={`glitch-band-${index}`}
          style={{
            position: "absolute",
            left: band.dx + Math.sin(tick + index) * 6,
            right: -band.dx,
            top: height * band.y,
            height: height * band.h,
            backgroundColor: band.c,
          }}
          pointerEvents="none"
        />
      ))}
      <FaceRecognitionHud width={width} height={height} accent="#ff3bd4" label="SIGNAL TEAR" value="TRACK LOST" />
    </>
  );
}

function LidarDepthHud({ width, height }: { width: number; height: number }) {
  const tick = useHudTick(true, 440);
  const accent = "#dbeafe";
  return (
    <>
      <LinearGradient
        colors={["rgba(255,255,255,0.12)", "rgba(140,165,190,0.12)", "rgba(10,16,26,0.18)"]}
        style={StyleSheet.absoluteFill}
      />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        {Array.from({ length: 7 }).map((_, index) => {
          const scale = 0.12 + index * 0.075;
          return (
            <Rect
              key={`lidar-box-${index}`}
              x={width * (0.5 - scale)}
              y={height * (0.37 - scale * 0.55)}
              width={width * scale * 2}
              height={height * scale}
              rx={8}
              stroke={index === tick % 7 ? "#00eaff" : accent}
              strokeWidth={1.2}
              strokeOpacity={0.18 + index * 0.055}
              fill="none"
            />
          );
        })}
        {Array.from({ length: 18 }).map((_, index) => (
          <Circle
            key={`lidar-dot-${index}`}
            cx={width * (0.12 + ((index * 37) % 76) / 100)}
            cy={height * (0.2 + ((index * 23) % 46) / 100)}
            r={index % 4 === tick % 4 ? 3.5 : 2}
            fill={index % 3 ? accent : "#00eaff"}
            opacity={0.38}
          />
        ))}
      </Svg>
      <HudBadge label="CHROME LIDAR" value="DEPTH MAPPED" accent="#dbeafe" style={{ left: width * 0.07, top: height * 0.65 }} />
    </>
  );
}

function RadSensorHud({ width, height }: { width: number; height: number }) {
  const tick = useHudTick(true, 420);
  const accent = "#b6ff00";
  const cx = width * 0.5;
  const cy = height * 0.4;
  return (
    <>
      <LinearGradient colors={["rgba(182,255,0,0.15)", "rgba(0,40,0,0.24)"]} style={StyleSheet.absoluteFill} />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        {[0.12, 0.2, 0.29].map((radius, index) => (
          <Circle
            key={`rad-ring-${index}`}
            cx={cx}
            cy={cy}
            r={width * radius + (tick % 3) * 2}
            stroke={accent}
            strokeWidth={2}
            strokeOpacity={0.5 - index * 0.11}
            fill="none"
          />
        ))}
        {Array.from({ length: 3 }).map((_, index) => {
          const angle = -90 + index * 120;
          const x = cx + Math.cos((angle * Math.PI) / 180) * width * 0.17;
          const y = cy + Math.sin((angle * Math.PI) / 180) * width * 0.17;
          return (
            <Path
              key={`rad-blade-${index}`}
              d={`M ${cx} ${cy} L ${x - 18} ${y + 32} L ${x + 18} ${y + 32} Z`}
              fill={accent}
              opacity={0.18}
            />
          );
        })}
        <Line x1={width * 0.16} y1={height * 0.62} x2={width * 0.84} y2={height * 0.62} stroke={accent} strokeWidth={1.5} strokeOpacity={0.44} />
      </Svg>
      <HudBadge label="RAD SENSOR" value={`ION ${82 + (tick % 11)}%`} accent={accent} style={{ right: width * 0.07, top: height * 0.64 }} />
    </>
  );
}

function VoidPortalHud({ width, height }: { width: number; height: number }) {
  const tick = useHudTick(true, 520);
  const accent = "#9b87ff";
  const cx = width * 0.5;
  const cy = height * 0.38;
  return (
    <>
      <LinearGradient colors={["rgba(0,0,0,0.46)", "rgba(76,29,149,0.18)", "rgba(0,0,0,0.52)"]} style={StyleSheet.absoluteFill} />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        {[0.08, 0.15, 0.24, 0.34].map((radius, index) => (
          <Circle
            key={`void-ring-${index}`}
            cx={cx + Math.sin(tick * 0.2 + index) * 4}
            cy={cy + Math.cos(tick * 0.18 + index) * 4}
            r={width * radius}
            stroke={index % 2 ? "#00eaff" : accent}
            strokeWidth={1.6}
            strokeOpacity={0.42 - index * 0.05}
            fill={index === 0 ? "rgba(0,0,0,0.22)" : "none"}
          />
        ))}
        {Array.from({ length: 20 }).map((_, index) => (
          <Circle
            key={`void-star-${index}`}
            cx={width * (0.08 + ((index * 29) % 84) / 100)}
            cy={height * (0.16 + ((index * 17) % 54) / 100)}
            r={index % 5 === tick % 5 ? 2.8 : 1.4}
            fill={index % 2 ? accent : "#00eaff"}
            opacity={0.25 + (index % 3) * 0.12}
          />
        ))}
      </Svg>
      <HudBadge label="VOID GATE" value="GRAVITY LOW" accent={accent} style={{ left: width * 0.07, top: height * 0.66 }} />
    </>
  );
}

export function FilterEffects({
  filter,
  width,
  height,
  heatwaveAnimated = true,
}: {
  filter: StoryFilter;
  width: number;
  height: number;
  heatwaveAnimated?: boolean;
}) {
  switch (filter) {
    case "heatwave":
      return <HeatwaveHud width={width} height={height} animated={heatwaveAnimated} />;
    case "hologram":
      return <FaceRecognitionHud width={width} height={height} accent="#00eaff" label="HOLO FACE ID" value="MESH STABLE" />;
    case "vaporwave":
      return <SynthLawHud width={width} height={height} />;
    case "infrared":
      return <ThermalScannerHud width={width} height={height} accent="#ff2d55" infrared />;
    case "matrix":
      return <MatrixIdentityHud width={width} height={height} />;
    case "void":
      return <VoidPortalHud width={width} height={height} />;
    case "glitch":
      return <GlitchArHud width={width} height={height} />;
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
      return <NeonCircuitHud width={width} height={height} />;
    case "xray":
      return <XraySkeletonHud width={width} height={height} />;
    case "thermal":
      return <ThermalScannerHud width={width} height={height} accent="#ff6a00" />;
    case "predator":
      return <FaceRecognitionHud width={width} height={height} accent="#ff4d26" label="SUBJECT TRACK" value="LOCKED" />;
    case "scanner":
      return <ScannerGateHud width={width} height={height} />;
    case "chrome":
      return <LidarDepthHud width={width} height={height} />;
    case "radioactive":
      return <RadSensorHud width={width} height={height} />;
    default:
      return null;
  }
}

export function LiveFilterHud({
  filter,
  width,
  height,
  animated = true,
  topInset = 0,
  bottomInset = 0,
}: {
  filter: StoryFilter;
  width: number;
  height: number;
  animated?: boolean;
  topInset?: number;
  bottomInset?: number;
}) {
  if (filter === "none") return null;
  if (filter === "heatwave") {
    return (
      <HeatwaveHud
        width={width}
        height={height}
        animated={animated}
        topInset={topInset}
        bottomInset={bottomInset}
      />
    );
  }
  return (
    <FilterEffects
      filter={filter}
      width={width}
      height={height}
      heatwaveAnimated={animated}
    />
  );
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
  heatwaveAnimated = mediaType === "video" && videoShouldPlay,
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
          <FilterEffects filter={filter} width={width} height={height} heatwaveAnimated={heatwaveAnimated} />
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

      <FilterEffects filter={filter} width={width} height={height} heatwaveAnimated={heatwaveAnimated} />
    </View>
  );
}

const styles = StyleSheet.create({
  hudBadge: {
    position: "absolute",
    minWidth: 118,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  hudBadgeLabel: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.1,
    textShadowColor: "rgba(0,255,255,0.6)",
    textShadowRadius: 6,
  },
  hudBadgeValue: {
    color: "#e9ffff",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.9,
    marginTop: 2,
  },
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
  heatwaveLock: {
    color: "#d9ffff",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1.1,
    marginTop: 1,
  },
  heatwaveGunBadge: {
    position: "absolute",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(0,216,255,0.42)",
    backgroundColor: "rgba(0,8,22,0.5)",
  },
  heatwaveGunLabel: {
    color: "#d9ffff",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1,
  },
  heatwaveGunValue: {
    color: "#43ff34",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.9,
    marginTop: 2,
  },
  heatwaveTelemetrySmall: {
    color: "#d9ffff",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 3,
  },
  heatwaveStatLine: {
    color: "#58ff39",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.9,
    textShadowColor: "#00ff9d",
    textShadowRadius: 5,
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

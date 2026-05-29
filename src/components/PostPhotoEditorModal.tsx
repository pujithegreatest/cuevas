import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ScrollView,
} from "react-native";
import { captureRef } from "react-native-view-shot";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "./Ionicons";
import { useAppStore } from "../state/appStore";
import {
  StoryFilter,
  StoryTextOverlay,
  StorySticker,
  StoryStickerPick,
  StoryStickerOverlay,
  DrawStroke,
} from "../types/story";
import StoryFilterCanvas from "./StoryFilterCanvas";
import DraggableStoryText from "./DraggableStoryText";
import DrawingCanvas from "./DrawingCanvas";
import DraggableSticker from "./DraggableSticker";
import StickerPickerModal from "./StickerPickerModal";

interface Props {
  visible: boolean;
  imageUri: string | null;
  onCancel: () => void;
  onConfirm: (capturedUri: string) => void;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const FILTERS: { id: StoryFilter; label: string }[] = [
  { id: "none", label: "Original" },
  { id: "neon", label: "Neon" },
  { id: "heatwave", label: "Heatwave" },
  { id: "hologram", label: "Hologram" },
  { id: "vaporwave", label: "Vaporwave" },
  { id: "infrared", label: "Infrared" },
  { id: "matrix", label: "Matrix" },
  { id: "glitch", label: "Glitch" },
  { id: "void", label: "Void" },
  { id: "noir", label: "Noir" },
  { id: "sepia", label: "Sepia" },
  { id: "acid", label: "Acid" },
  { id: "arctic", label: "Arctic" },
  { id: "dream", label: "Dream" },
  { id: "xray", label: "X-Ray" },
  { id: "thermal", label: "Thermal" },
  { id: "predator", label: "Predator" },
  { id: "scanner", label: "Scanner" },
  { id: "chrome", label: "Chrome" },
  { id: "radioactive", label: "Toxic" },
];

const TEXT_STYLES: StoryTextOverlay["style"][] = [
  "neon",
  "mono",
  "chrome",
  "blood",
  "ticker",
  "wave",
  "glitch",
];

const TEXT_COLORS = [
  "#ffffff",
  "#06A7A1",
  "#80171F",
  "#ff5e3a",
  "#00ffd5",
  "#ff00aa",
  "#39ff14",
  "#facc15",
];

const DRAW_COLORS = [
  "#ffffff",
  "#06A7A1",
  "#FF3B30",
  "#FACC15",
  "#39FF14",
  "#FF00AA",
  "#00FFD5",
  "#000000",
];

export default function PostPhotoEditorModal({
  visible,
  imageUri,
  onCancel,
  onConfirm,
}: Props) {
  const isDarkMode = useAppStore((s) => s.isDarkMode);
  const [filter, setFilter] = useState<StoryFilter>("none");
  const [overlays, setOverlays] = useState<StoryTextOverlay[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stickers, setStickers] = useState<StoryStickerOverlay[]>([]);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(
    null
  );
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const [drawMode, setDrawMode] = useState(false);
  const [drawColor, setDrawColor] = useState("#ffffff");
  const [drawWidth, setDrawWidth] = useState(4);
  const canvasRef = useRef<View>(null);

  const canvasW = SCREEN_W - 32;
  const canvasH = Math.min(SCREEN_H * 0.62, canvasW * (16 / 9));

  const reset = () => {
    setFilter("none");
    setOverlays([]);
    setSelectedId(null);
    setEditingId(null);
    setEditingText("");
    setIsCapturing(false);
    setBusy(false);
    setStickers([]);
    setSelectedStickerId(null);
    setShowStickerPicker(false);
    setStrokes([]);
    setDrawMode(false);
  };

  const addSticker = (sticker: StorySticker | StoryStickerPick) => {
    const stickerPick: StoryStickerPick =
      typeof sticker === "string" ? { kind: sticker } : sticker;
    const kind = stickerPick.kind;
    const id = `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const next: StoryStickerOverlay = {
      id,
      kind,
      x: 0.4,
      y: 0.4,
      scale: 1,
      rotation: 0,
      label: stickerPick.label,
      imageUri: stickerPick.imageUri,
      ...(kind === "timestamp"
        ? {
            text: (() => {
              const d = new Date();
              const h = d.getHours();
              const m = d.getMinutes().toString().padStart(2, "0");
              const ampm = h >= 12 ? "PM" : "AM";
              const h12 = h % 12 || 12;
              return `${h12}:${m} ${ampm}`;
            })(),
          }
        : stickerPick.text
        ? { text: stickerPick.text }
        : {}),
    };
    setStickers((p) => [...p, next]);
    setSelectedStickerId(id);
    setShowStickerPicker(false);
  };

  const updateSticker = (next: StoryStickerOverlay) => {
    setStickers((p) => p.map((s) => (s.id === next.id ? next : s)));
  };

  const deleteSticker = (id: string) => {
    setStickers((p) => p.filter((s) => s.id !== id));
    if (selectedStickerId === id) setSelectedStickerId(null);
  };

  const addTextOverlay = () => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const next: StoryTextOverlay = {
      id,
      text: "",
      x: 0.5 - 0.2,
      y: 0.45,
      scale: 1,
      rotation: 0,
      color: "#ffffff",
      style: "neon",
    };
    setOverlays((prev) => [...prev, next]);
    setSelectedId(id);
    setEditingId(id);
    setEditingText("");
  };

  const updateOverlay = (next: StoryTextOverlay) => {
    setOverlays((prev) => prev.map((o) => (o.id === next.id ? next : o)));
  };

  const deleteOverlay = (id: string) => {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const commitEdit = () => {
    if (!editingId) return;
    const trimmed = editingText.slice(0, 140);
    const id = editingId;
    if (trimmed.trim().length === 0) {
      setOverlays((prev) => prev.filter((o) => o.id !== id));
      if (selectedId === id) setSelectedId(null);
    } else {
      setOverlays((prev) =>
        prev.map((o) => (o.id === id ? { ...o, text: trimmed } : o))
      );
    }
    setEditingId(null);
    setEditingText("");
  };

  const cycleStyle = () => {
    if (!selectedId) return;
    setOverlays((prev) =>
      prev.map((o) => {
        if (o.id !== selectedId) return o;
        const idx = TEXT_STYLES.indexOf(o.style);
        const nextStyle = TEXT_STYLES[(idx + 1) % TEXT_STYLES.length];
        return { ...o, style: nextStyle };
      })
    );
  };

  const setSelectedColor = (color: string) => {
    if (!selectedId) return;
    setOverlays((prev) =>
      prev.map((o) => (o.id === selectedId ? { ...o, color } : o))
    );
  };

  const handleDone = async () => {
    if (!imageUri) return;
    setSelectedId(null);
    setEditingId(null);
    setBusy(true);
    setIsCapturing(true);
    try {
      await new Promise((r) => setTimeout(r, 100));
      const captured = await captureRef(canvasRef, {
        format: "jpg",
        quality: 0.9,
        result: "tmpfile",
      });
      setIsCapturing(false);
      setBusy(false);
      onConfirm(captured);
      reset();
    } catch {
      setIsCapturing(false);
      setBusy(false);
    }
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const selectedOverlay = overlays.find((o) => o.id === selectedId) || null;
  const editingOverlay = overlays.find((o) => o.id === editingId) || null;

  if (!visible || !imageUri) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
        style={{ flex: 1 }}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View
            style={{
              flex: 1,
              backgroundColor: isDarkMode ? "#0b1115" : "#ffffff",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: isDarkMode ? "#1f2937" : "#e5e7eb",
              }}
            >
              <Pressable onPress={handleCancel} hitSlop={10}>
                <Ionicons
                  name="close"
                  size={26}
                  color={isDarkMode ? "#CFEFEC" : "#80171F"}
                />
              </Pressable>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "800",
                  color: isDarkMode ? "#CFEFEC" : "#80171F",
                }}
              >
                Edit Photo
              </Text>
              <Pressable
                onPress={handleDone}
                disabled={busy}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: busy ? "#9ca3af" : "#06A7A1",
                }}
              >
                <Text style={{ color: "white", fontWeight: "800" }}>
                  {busy ? "Saving..." : "Done"}
                </Text>
              </Pressable>
            </View>

            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingTop: 12,
              }}
            >
              <View
                ref={canvasRef}
                collapsable={false}
                style={{
                  width: canvasW,
                  height: canvasH,
                  borderRadius: 18,
                  overflow: "hidden",
                  backgroundColor: "#000",
                }}
              >
                <StoryFilterCanvas
                  uri={imageUri}
                  filter={filter}
                  width={canvasW}
                  height={canvasH}
                  contentFit="cover"
                />
                <DrawingCanvas
                  width={canvasW}
                  height={canvasH}
                  enabled={drawMode && !isCapturing}
                  color={drawColor}
                  strokeWidth={drawWidth}
                  strokes={strokes}
                  onStrokeComplete={(s) =>
                    setStrokes((prev) => [...prev, s])
                  }
                />

                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: canvasW,
                    height: canvasH,
                  }}
                  pointerEvents={drawMode ? "none" : "box-none"}
                >
                  {overlays.map((o) => (
                    <DraggableStoryText
                      key={o.id}
                      overlay={o}
                      canvasWidth={canvasW}
                      canvasHeight={canvasH}
                      selected={selectedId === o.id}
                      onSelect={() => setSelectedId(o.id)}
                      onChange={updateOverlay}
                      onRequestEdit={() => {
                        setEditingId(o.id);
                        setEditingText(o.text);
                      }}
                      onRequestDelete={() => deleteOverlay(o.id)}
                    />
                  ))}
                </View>

                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: canvasW,
                    height: canvasH,
                  }}
                  pointerEvents={drawMode ? "none" : "box-none"}
                >
                  {stickers.map((s) => (
                    <DraggableSticker
                      key={s.id}
                      overlay={s}
                      canvasWidth={canvasW}
                      canvasHeight={canvasH}
                      selected={selectedStickerId === s.id}
                      onSelect={() => setSelectedStickerId(s.id)}
                      onChange={updateSticker}
                      onRequestDelete={() => deleteSticker(s.id)}
                    />
                  ))}
                </View>

                <View
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    gap: 10,
                    opacity: isCapturing ? 0 : 1,
                  }}
                  pointerEvents={isCapturing ? "none" : "auto"}
                >
                  <Pressable
                    onPress={addTextOverlay}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: "rgba(0,0,0,0.55)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: "white",
                        fontSize: 20,
                        fontWeight: "800",
                      }}
                    >
                      Aa
                    </Text>
                  </Pressable>
                  {selectedOverlay && (
                    <Pressable
                      onPress={cycleStyle}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: "rgba(0,0,0,0.55)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: "white",
                          fontSize: 12,
                          fontWeight: "700",
                        }}
                      >
                        STYL
                      </Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => setShowStickerPicker(true)}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: "rgba(0,0,0,0.55)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="happy-outline" size={22} color="#fff" />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setDrawMode((m) => !m);
                      setSelectedId(null);
                      setSelectedStickerId(null);
                    }}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: drawMode
                        ? "#06A7A1"
                        : "rgba(0,0,0,0.55)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="brush" size={20} color="#fff" />
                  </Pressable>
                  {drawMode && strokes.length > 0 && (
                    <Pressable
                      onPress={() => setStrokes((p) => p.slice(0, -1))}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: "rgba(0,0,0,0.55)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="arrow-undo" size={18} color="#fff" />
                    </Pressable>
                  )}
                  {drawMode && strokes.length > 0 && (
                    <Pressable
                      onPress={() => setStrokes([])}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: "rgba(128,23,31,0.85)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="trash" size={18} color="#fff" />
                    </Pressable>
                  )}
                </View>

                {drawMode && !isCapturing && (
                  <View
                    style={{
                      position: "absolute",
                      bottom: 12,
                      left: 12,
                      right: 12,
                      flexDirection: "row",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {DRAW_COLORS.map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => setDrawColor(c)}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: c,
                          borderWidth: drawColor === c ? 2 : 1,
                          borderColor:
                            drawColor === c
                              ? "#ffffff"
                              : "rgba(255,255,255,0.5)",
                        }}
                      />
                    ))}
                    <View style={{ width: 10 }} />
                    {[2, 4, 8].map((w) => (
                      <Pressable
                        key={w}
                        onPress={() => setDrawWidth(w)}
                        style={{
                          width: 28,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor:
                            drawWidth === w
                              ? "rgba(255,255,255,0.85)"
                              : "rgba(0,0,0,0.5)",
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.5)",
                        }}
                      >
                        <View
                          style={{
                            width: 14,
                            height: w,
                            backgroundColor:
                              drawWidth === w ? "#000" : "#fff",
                            borderRadius: w,
                          }}
                        />
                      </Pressable>
                    ))}
                  </View>
                )}

                {selectedOverlay && !drawMode && !isCapturing && (
                  <View
                    style={{
                      position: "absolute",
                      bottom: 12,
                      left: 12,
                      right: 12,
                      flexDirection: "row",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    {TEXT_COLORS.map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => setSelectedColor(c)}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: c,
                          borderWidth: selectedOverlay.color === c ? 2 : 1,
                          borderColor:
                            selectedOverlay.color === c
                              ? "#ffffff"
                              : "rgba(255,255,255,0.4)",
                        }}
                      />
                    ))}
                  </View>
                )}
              </View>
            </View>

            <View style={{ marginTop: 14 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  gap: 8,
                }}
              >
                {FILTERS.map((f) => (
                  <Pressable
                    key={f.id}
                    onPress={() => setFilter(f.id)}
                    style={{ alignItems: "center" }}
                  >
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        overflow: "hidden",
                        borderWidth: filter === f.id ? 2 : 1,
                        borderColor:
                          filter === f.id
                            ? "#06A7A1"
                            : isDarkMode
                            ? "#333"
                            : "#d1d5db",
                      }}
                    >
                      <StoryFilterCanvas
                        uri={imageUri}
                        filter={f.id}
                        width={56}
                        height={56}
                        contentFit="cover"
                      />
                    </View>
                    <Text
                      style={{
                        fontSize: 11,
                        marginTop: 4,
                        color:
                          filter === f.id
                            ? isDarkMode
                              ? "#06A7A1"
                              : "#06A7A1"
                            : isDarkMode
                            ? "#9ca3af"
                            : "#4b5563",
                      }}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View
              style={{
                marginTop: 8,
                paddingHorizontal: 16,
                paddingBottom: 16,
              }}
            >
              <Text
                style={{
                  textAlign: "center",
                  fontSize: 12,
                  color: isDarkMode ? "#9ca3af" : "#6b7280",
                }}
              >
                Tap Aa to add text. Drag, pinch, rotate. Double-tap text to
                edit.
              </Text>
            </View>

            <StickerPickerModal
              visible={showStickerPicker}
              isDarkMode={isDarkMode}
              onClose={() => setShowStickerPicker(false)}
              onPick={addSticker}
            />

            {editingId !== null && (
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(0,0,0,0.82)",
                  zIndex: 1000,
                }}
              >
                <Pressable onPress={commitEdit} style={{ flex: 1 }}>
                  <View
                    style={{ flex: 1, paddingTop: 60 }}
                    pointerEvents="box-none"
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "flex-end",
                        paddingHorizontal: 20,
                      }}
                    >
                      <Pressable
                        onPress={commitEdit}
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 22,
                          borderRadius: 999,
                          backgroundColor: "#06A7A1",
                        }}
                      >
                        <Text
                          style={{
                            color: "white",
                            fontWeight: "800",
                            fontSize: 15,
                          }}
                        >
                          Done
                        </Text>
                      </Pressable>
                    </View>
                    <View
                      style={{
                        flex: 1,
                        justifyContent: "center",
                        paddingHorizontal: 28,
                      }}
                      pointerEvents="box-none"
                    >
                      <TextInput
                        value={editingText}
                        onChangeText={setEditingText}
                        placeholder="Type something..."
                        placeholderTextColor="rgba(255,255,255,0.45)"
                        multiline
                        autoFocus
                        maxLength={140}
                        style={{
                          color: editingOverlay?.color || "#ffffff",
                          fontSize: 32,
                          fontWeight: "800",
                          textAlign: "center",
                          minHeight: 60,
                          textShadowColor: "rgba(0,0,0,0.5)",
                          textShadowOffset: { width: 0, height: 1 },
                          textShadowRadius: 4,
                        }}
                      />
                      <Text
                        style={{
                          color: "rgba(255,255,255,0.5)",
                          fontSize: 11,
                          textAlign: "center",
                          marginTop: 14,
                        }}
                      >
                        Tap anywhere or Done when finished
                      </Text>
                    </View>
                  </View>
                </Pressable>
              </KeyboardAvoidingView>
            )}
          </View>
        </GestureHandlerRootView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

import React, { useMemo, useRef } from "react";
import { View } from "react-native";
import {
  Canvas,
  Path,
  Skia,
  SkPath,
} from "@shopify/react-native-skia";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { DrawStroke } from "../types/story";

interface DrawingCanvasProps {
  width: number;
  height: number;
  enabled: boolean;
  color: string;
  strokeWidth: number;
  strokes: DrawStroke[];
  onStrokeComplete: (stroke: DrawStroke) => void;
}

interface CompiledPath {
  id: string;
  path: SkPath;
  color: string;
  width: number;
}

export default function DrawingCanvas({
  width,
  height,
  enabled,
  color,
  strokeWidth,
  strokes,
  onStrokeComplete,
}: DrawingCanvasProps) {
  const drawingPointsRef = useRef<{ x: number; y: number }[]>([]);

  const completedPaths = useMemo<CompiledPath[]>(() => {
    const out: CompiledPath[] = [];
    for (const s of strokes) {
      if (!s.points || s.points.length === 0) continue;
      const p = Skia.Path.Make();
      p.moveTo(s.points[0].x * width, s.points[0].y * height);
      for (let i = 1; i < s.points.length; i++) {
        p.lineTo(s.points[i].x * width, s.points[i].y * height);
      }
      out.push({ id: s.id, path: p, color: s.color, width: s.width });
    }
    return out;
  }, [strokes, width, height]);

  const commit = (points: { x: number; y: number }[]) => {
    if (points.length < 2) return;
    onStrokeComplete({
      id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      color,
      width: strokeWidth,
      points,
    });
  };

  const beginStroke = (x: number, y: number) => {
    drawingPointsRef.current = [{ x: x / width, y: y / height }];
  };

  const appendStroke = (x: number, y: number) => {
    const nx = Math.max(0, Math.min(1, x / width));
    const ny = Math.max(0, Math.min(1, y / height));
    drawingPointsRef.current.push({ x: nx, y: ny });
  };

  const endStroke = () => {
    const pts = drawingPointsRef.current;
    drawingPointsRef.current = [];
    if (pts.length >= 2) commit(pts);
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((e) => {
          runOnJS(beginStroke)(e.x, e.y);
        })
        .onUpdate((e) => {
          runOnJS(appendStroke)(e.x, e.y);
        })
        .onEnd(() => {
          runOnJS(endStroke)();
        })
        .onFinalize((_e, success) => {
          if (!success) {
            runOnJS(endStroke)();
          }
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, height, color, strokeWidth]
  );

  pan.enabled(enabled);

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height,
      }}
      pointerEvents={enabled ? "auto" : "none"}
    >
      <GestureDetector gesture={pan}>
        <View style={{ width, height }}>
          <Canvas style={{ width, height }} pointerEvents="none">
            {completedPaths.map((s) => (
              <Path
                key={s.id}
                path={s.path}
                color={s.color}
                style="stroke"
                strokeWidth={s.width}
                strokeJoin="round"
                strokeCap="round"
              />
            ))}
          </Canvas>
        </View>
      </GestureDetector>
    </View>
  );
}

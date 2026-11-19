import React, { useRef, useState } from "react";
import type { DrawingCanvasProps } from "./DrawingCanvas";
import type { DrawStroke } from "../types/story";

export default function DrawingCanvas({ width, height, enabled, color, strokeWidth, strokes, onStrokeComplete }: DrawingCanvasProps) {
  const active = useRef<{ pointerId: number; stroke: DrawStroke } | null>(null);
  const [draft, setDraft] = useState<DrawStroke | null>(null);
  const pointAt = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const clamp = (value: number) => Math.max(0, Math.min(1, value));
    return { x: clamp((event.clientX - rect.left) / rect.width),
      y: clamp((event.clientY - rect.top) / rect.height) };
  };

  return (
    <svg aria-hidden="true" width={width} height={height}
      style={{ position: "absolute", top: 0, left: 0, touchAction: enabled ? "none" : "auto",
        pointerEvents: enabled ? "auto" : "none" }}
      onPointerDown={event => {
        if (!enabled || active.current || event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        const stroke = {
          id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          color, width: strokeWidth, points: [pointAt(event)],
        };
        active.current = { pointerId: event.pointerId, stroke };
        setDraft(stroke);
      }}
      onPointerMove={event => {
        if (active.current?.pointerId !== event.pointerId) return;
        const stroke = active.current.stroke;
        stroke.points.push(pointAt(event));
        setDraft({ ...stroke });
      }}
      onPointerUp={event => {
        if (active.current?.pointerId !== event.pointerId) return;
        const { stroke } = active.current;
        active.current = null;
        setDraft(null);
        if (stroke.points.length > 1) onStrokeComplete(stroke);
      }}
      onLostPointerCapture={event => {
        if (active.current?.pointerId !== event.pointerId) return;
        active.current = null;
        setDraft(null);
      }}>
      {[...strokes, ...(enabled && draft ? [draft] : [])].map(stroke => (
        <polyline key={stroke.id} fill="none" stroke={stroke.color}
          strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round"
          points={stroke.points.map(point => `${point.x * width},${point.y * height}`).join(" ")} />
      ))}
    </svg>
  );
}

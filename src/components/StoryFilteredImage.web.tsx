import React, { useId } from "react";
import type { StoryFilteredImageProps } from "./StoryFilteredImage";

export default function StoryFilteredImage({ uri, width, height, contentFit, matrix }: StoryFilteredImageProps) {
  const id = `story-matrix-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <div style={{ width, height, position: "relative" }}>
      {matrix && (
        <svg width={0} height={0} aria-hidden="true" style={{ position: "absolute" }}>
          <defs>
            <filter id={id} colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values={matrix.join(" ")} />
            </filter>
          </defs>
        </svg>
      )}
      <img src={uri} alt="" draggable={false} style={{
        display: "block", width, height, objectFit: contentFit,
        filter: matrix ? `url(#${id})` : undefined,
      }} />
    </div>
  );
}

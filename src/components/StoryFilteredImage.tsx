import React from "react";
import { Canvas, ColorMatrix, Image as SkiaImage, useImage } from "@shopify/react-native-skia";
import { Image } from "expo-image";

export type StoryFilteredImageProps = {
  uri: string;
  width: number;
  height: number;
  contentFit: "cover" | "contain";
  matrix: number[] | null;
};

export default function StoryFilteredImage({ uri, width, height, contentFit, matrix }: StoryFilteredImageProps) {
  const image = useImage(uri);
  if (!image) {
    return <Image source={{ uri }} style={{ width, height }} contentFit={contentFit} />;
  }

  return (
    <Canvas style={{ width, height }}>
      <SkiaImage image={image} x={0} y={0} width={width} height={height} fit={contentFit}>
        {matrix && <ColorMatrix matrix={matrix} />}
      </SkiaImage>
    </Canvas>
  );
}

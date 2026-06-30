import React, { forwardRef, useState } from "react";
import { View, Text } from "react-native";
import { Image } from "expo-image";
import ViewShot from "react-native-view-shot";
import { Post } from "../types/feed";
import { formatRelativeTime } from "../utils/linkPreview";

interface Props {
  post: Post;
  variant?: "default" | "instagramVideoOverlay";
}

const STORY_BG = "#081920";
const STORY_SCANLINE = "rgba(207,239,236,0.08)";
const STORY_SCANLINE_STEP = 10;
const STORY_SCANLINE_HEIGHT = 2;

const PostShareableCard = forwardRef<ViewShot, Props>(function PostShareableCard(
  { post, variant = "default" },
  ref,
) {
  const [exportImgAspect, setExportImgAspect] = useState<number | null>(null);
  const isInstagramVideoOverlay = variant === "instagramVideoOverlay";
  const mediaList = (post.images || []).filter(Boolean);
  const isVideoUri = (uri?: string) =>
    !!uri &&
    (/\.(mp4|mov|m4v|avi|webm)$/i.test(uri) ||
      uri.includes("video.wixstatic.com/video/") ||
      uri.includes("kind=video") ||
      uri.includes("mime=video%2F") ||
      uri.includes("mime=video/"));

  const renderScanlines = (left: number, top: number, width: number, height: number) => {
    const count = Math.ceil(height / STORY_SCANLINE_STEP);
    return Array.from({ length: count }).map((_, index) => (
      <View
        key={`scanline-${left}-${top}-${index}`}
        style={{
          position: "absolute",
          left,
          top: top + index * STORY_SCANLINE_STEP,
          width,
          height: STORY_SCANLINE_HEIGHT,
          backgroundColor: STORY_SCANLINE,
        }}
      />
    ));
  };

  const renderStoryBackgroundBlock = (left: number, top: number, width: number, height: number) => (
    <React.Fragment key={`story-bg-${left}-${top}-${width}-${height}`}>
      <View style={{ position: "absolute", left, top, width, height, backgroundColor: STORY_BG }} />
      {renderScanlines(left, top, width, height)}
    </React.Fragment>
  );

  const renderAuthorHeader = () => (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: "#06A7A1",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "bold", fontSize: 28 }}>
          {post.author[0].toUpperCase()}
        </Text>
      </View>
      <View style={{ marginLeft: 16 }}>
        <Text style={{ fontWeight: "bold", fontSize: 24, color: "#1F2937" }}>
          {post.author}
        </Text>
        <Text style={{ fontSize: 16, color: "#6B7280", marginTop: 4 }}>
          {formatRelativeTime(post.timestamp)}
        </Text>
      </View>
    </View>
  );

  if (isInstagramVideoOverlay && mediaList.length === 1 && isVideoUri(mediaList[0])) {
    const cardX = 160;
    const cardY = 500;
    const cardW = 760;
    const headerH = post.content ? 160 : 132;
    const mediaY = cardY + headerH;
    const mediaH = 860;
    const borderW = 8;
    const cardBottom = mediaY + mediaH;

    return (
      <View
        style={{ position: "absolute", left: -10000, width: 1080, height: 1920 }}
        pointerEvents="none"
      >
        <ViewShot ref={ref} options={{ format: "png", quality: 1 }}>
          <View
            style={{
              width: 1080,
              height: 1920,
              backgroundColor: "transparent",
            }}
          >
            {renderStoryBackgroundBlock(0, 0, 1080, cardY)}
            {renderStoryBackgroundBlock(0, cardY, cardX, cardBottom - cardY)}
            {renderStoryBackgroundBlock(cardX + cardW, cardY, 1080 - cardX - cardW, cardBottom - cardY)}
            {renderStoryBackgroundBlock(0, cardBottom, 1080, 1920 - cardBottom)}

            <View
              style={{
                position: "absolute",
                left: cardX,
                top: cardY,
                width: cardW,
                minHeight: headerH,
                backgroundColor: "#E8F1F2",
                padding: 28,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
              }}
            >
              {renderAuthorHeader()}

              {post.content && (
                <Text style={{ fontSize: 22, lineHeight: 32, color: "#1F2937" }}>
                  {post.content}
                </Text>
              )}
            </View>

            <View style={{ position: "absolute", left: cardX, top: mediaY, width: borderW, height: mediaH, backgroundColor: "#E8F1F2" }} />
            <View style={{ position: "absolute", left: cardX + cardW - borderW, top: mediaY, width: borderW, height: mediaH, backgroundColor: "#E8F1F2" }} />
            <View style={{ position: "absolute", left: cardX, top: cardBottom - borderW, width: cardW, height: borderW, backgroundColor: "#E8F1F2" }} />
            <View style={{ position: "absolute", left: cardX, top: cardBottom - 46, width: borderW, height: 46, backgroundColor: "#E8F1F2", borderBottomLeftRadius: 28 }} />
            <View style={{ position: "absolute", left: cardX + cardW - borderW, top: cardBottom - 46, width: borderW, height: 46, backgroundColor: "#E8F1F2", borderBottomRightRadius: 28 }} />

            <Text
              style={{
                color: "white",
                fontSize: 28,
                fontWeight: "600",
                textAlign: "center",
                position: "absolute",
                bottom: 60,
                left: 0,
                right: 0,
              }}
            >
              apps by ecothot
            </Text>
          </View>
        </ViewShot>
      </View>
    );
  }

  return (
    <View
      style={{ position: "absolute", left: -10000, width: 1080, height: 1920 }}
      pointerEvents="none"
    >
      <ViewShot ref={ref} options={{ format: "png", quality: 0.9 }}>
        <View
          style={{
            width: 1080,
            height: 1920,
            backgroundColor: STORY_BG,
            padding: 50,
            paddingBottom: 120,
            justifyContent: "center",
          }}
        >
          {renderScanlines(0, 0, 1080, 1920)}

          <View
            style={{
              backgroundColor: "#E8F1F2",
              borderRadius: 24,
              padding: 32,
            }}
          >
            {renderAuthorHeader()}

            {post.content && (
              <Text style={{ fontSize: 22, lineHeight: 32, color: "#1F2937", marginBottom: 20 }}>
                {post.content}
              </Text>
            )}

            {post.images && post.images.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                {post.images.length === 1 ? (
                  <Image
                    source={{ uri: post.images[0] }}
                    style={{
                      width: "100%",
                      aspectRatio: exportImgAspect || 1,
                      borderRadius: 16,
                    }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    onLoad={(e: any) => {
                      const w = e?.source?.width;
                      const h = e?.source?.height;
                      if (w && h) setExportImgAspect(w / h);
                    }}
                  />
                ) : (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {post.images.slice(0, 4).map((uri, index) => (
                      <Image
                        key={index}
                        source={{ uri }}
                        style={{
                          width: post.images!.length === 2 ? "49%" : "48%",
                          aspectRatio: 1,
                          borderRadius: 12,
                        }}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    ))}
                  </View>
                )}
              </View>
            )}

            {post.linkPreview && (
              <View
                style={{
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "#D1D5DB",
                  overflow: "hidden",
                  backgroundColor: "#F9FAFB",
                }}
              >
                {post.linkPreview.thumbnail && (
                  <Image
                    source={{ uri: post.linkPreview.thumbnail }}
                    style={{ width: "100%", height: 300 }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                )}
                <View style={{ padding: 20 }}>
                  <Text style={{ fontSize: 16, color: "#6B7280", marginBottom: 8 }}>
                    {post.linkPreview.domain}
                  </Text>
                  <Text
                    style={{ fontSize: 20, fontWeight: "bold", color: "#1F2937", marginBottom: 8 }}
                  >
                    {post.linkPreview.title}
                  </Text>
                  {post.linkPreview.description && (
                    <Text style={{ fontSize: 16, color: "#6B7280" }} numberOfLines={3}>
                      {post.linkPreview.description}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>

          <Text
            style={{
              color: "white",
              fontSize: 28,
              fontWeight: "600",
              textAlign: "center",
              position: "absolute",
              bottom: 60,
              left: 0,
              right: 0,
            }}
          >
            apps by ecothot
          </Text>
        </View>
      </ViewShot>
    </View>
  );
});

export default PostShareableCard;

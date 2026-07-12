import * as FileSystem from "expo-file-system/legacy";
import { StoryFilter } from "../types/story";
import { encodeUploadUri, uploadMediaFile } from "./uploadMedia";

const BACKEND_URL = "https://us-central1-ecothot-social-media.cloudfunctions.net";

interface RenderStoryVideoInput {
  localVideoUri: string;
  liveFilter?: StoryFilter | null;
  trimStartMs?: number;
  trimEndMs?: number;
}

interface RenderStoryVideoResult {
  url: string;
  storagePath?: string;
  durationMs?: number;
}

function isRemoteUri(uri: string) {
  return /^https?:\/\//i.test(uri);
}

function getVideoFileName(uri: string) {
  const baseName = uri.split("#", 1)[0].split("?", 1)[0].split("/").pop() || "";
  const ext = baseName.includes(".") ? baseName.split(".").pop()?.toLowerCase() : "";
  const safeExt = ext === "mov" || ext === "m4v" || ext === "mp4" ? ext : "mp4";
  return `cuevas-story-${Date.now()}.${safeExt}`;
}

function getVideoMime(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".m4v")) return "video/x-m4v";
  return "video/mp4";
}

export function getRenderedStoryDurationMs(
  trimStartMs?: number,
  trimEndMs?: number,
  fallbackDurationMs?: number
) {
  const start = Math.max(0, trimStartMs || 0);
  const end =
    typeof trimEndMs === "number" && trimEndMs > start
      ? trimEndMs
      : fallbackDurationMs;
  if (typeof end === "number" && end > start) {
    return Math.max(0, end - start);
  }
  return fallbackDurationMs;
}

export async function renderStoryVideo({
  localVideoUri,
  liveFilter,
  trimStartMs,
  trimEndMs,
}: RenderStoryVideoInput): Promise<RenderStoryVideoResult> {
  const fileName = getVideoFileName(localVideoUri);
  const sourceUrl = isRemoteUri(localVideoUri)
    ? localVideoUri
    : await uploadMediaFile(
        encodeUploadUri(
          localVideoUri,
          fileName,
          getVideoMime(fileName),
          "video",
          "story-video"
        ),
        "story-video"
      );

  const response = await fetch(`${BACKEND_URL}/renderStoryVideo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      videoUrl: sourceUrl,
      liveFilter: liveFilter || "none",
      trimStartMs,
      trimEndMs,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success || !data?.url) {
    throw new Error(data?.error || "Story video render failed");
  }

  return {
    url: String(data.url),
    storagePath: data.storagePath ? String(data.storagePath) : undefined,
    durationMs:
      typeof data.durationMs === "number" && Number.isFinite(data.durationMs)
        ? data.durationMs
        : undefined,
  };
}

export async function ensureLocalVideoUri(uri: string, tag = "story-video") {
  if (!isRemoteUri(uri)) return uri;
  const target =
    FileSystem.cacheDirectory +
    `${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
  const downloaded = await FileSystem.downloadAsync(uri, target);
  return downloaded.uri;
}

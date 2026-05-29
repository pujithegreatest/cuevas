import * as FileSystem from "expo-file-system/legacy";

const UPLOAD_API = "https://www.ecothot.com/_functions/uploadMedia";
const UPLOAD_FINALIZE_API = "https://www.ecothot.com/_functions/uploadMediaFinalize";

export type UploadDestination =
  | "post-image"
  | "post-video"
  | "post-audio"
  | "story-image"
  | "story-video"
  | "story-audio"
  | "mission-proof"
  | "profile-avatar"
  | "misc";

export function encodeUploadUri(
  uri: string,
  fileName: string,
  mimeType: string,
  kind: "image" | "video" | "audio",
  destination?: UploadDestination
) {
  const sep = uri.includes("#") ? "&" : "#";
  const destinationPart = destination ? `&destination=${encodeURIComponent(destination)}` : "";
  return (
    uri +
    sep +
    `name=${encodeURIComponent(fileName)}&mime=${encodeURIComponent(mimeType)}&kind=${encodeURIComponent(kind)}${destinationPart}`
  );
}

export async function uploadMediaFile(uri: string, destinationOverride?: UploadDestination): Promise<string> {
  const [rawUri, hash] = uri.split("#", 2);
  let providedName = "";
  let providedMime = "";
  let providedKind = "";
  let providedDestination = destinationOverride || "";

  if (hash) {
    for (const part of hash.split("&")) {
      const [key, rawValue] = part.split("=", 2);
      const value = rawValue ? decodeURIComponent(rawValue) : "";
      if (key === "name") providedName = value;
      else if (key === "mime") providedMime = value;
      else if (key === "kind") providedKind = value;
      else if (key === "destination") providedDestination = value as UploadDestination;
    }
  }

  const rawName = providedName || rawUri.split("/").pop() || `upload-${Date.now()}`;
  const rawExt = rawName.includes(".") ? rawName.split(".").pop()?.toLowerCase() : undefined;
  const ext = rawExt || "jpg";
  const inferredMime =
    ext === "mp3"
      ? "audio/mpeg"
      : ext === "m4a"
      ? "audio/m4a"
      : ext === "wav"
      ? "audio/wav"
      : ext === "png"
      ? "image/png"
      : ext === "mp4" || ext === "mov" || ext === "m4v"
      ? ext === "mov"
        ? "video/quicktime"
        : "video/mp4"
      : "image/jpeg";

  const mime =
    providedMime ||
    (providedKind === "audio"
      ? inferredMime.startsWith("audio/")
        ? inferredMime
        : "audio/m4a"
      : providedKind === "video"
      ? inferredMime.startsWith("video/")
        ? inferredMime
        : "video/mp4"
      : inferredMime);

  const filename = rawName.includes(".")
    ? rawName
    : `${rawName}.${mime === "audio/mpeg" ? "mp3" : mime.startsWith("video/") ? "mp4" : mime === "image/png" ? "png" : "jpg"}`;

  const initRes = await fetch(UPLOAD_API, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: filename, mimeType: mime, kind: providedKind || undefined, destination: providedDestination || undefined }),
  });
  const initJson = await initRes.json();
  if (!initRes.ok || !initJson?.success || !initJson?.uploadUrl) {
    throw new Error(initJson?.error || "Upload init failed");
  }

  const uploadResult = await FileSystem.uploadAsync(initJson.uploadUrl, rawUri, {
    httpMethod: "PUT",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { "Content-Type": mime },
  });

  let trackingKey = initJson.fileId || initJson.trackingKey || null;
  if (uploadResult?.body) {
    try {
      const uploadJson = JSON.parse(uploadResult.body);
      trackingKey = uploadJson?.fileId || uploadJson?.id || uploadJson?.file?._id || uploadJson?.file?.id || trackingKey;
    } catch {
      // Upload body can be empty/non-JSON.
    }
  }

  if (!trackingKey) throw new Error("Upload failed: missing tracking key");

  const finalizeRes = await fetch(UPLOAD_FINALIZE_API, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      fileId: initJson.fileId || null,
      trackingKey,
      fileName: filename,
      mimeType: mime,
    }),
  });
  const finalizeJson = await finalizeRes.json();
  if (!finalizeRes.ok || !finalizeJson?.success || !finalizeJson?.url) {
    throw new Error(finalizeJson?.error || "Upload finalize failed");
  }

  return finalizeJson.url as string;
}

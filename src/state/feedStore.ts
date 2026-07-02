import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Post, Comment, LinkPreview, CommentPrivacyLevel, PrivacyLevel, PostAudio } from "../types/feed";
import { completeLinkPreview, detectLinkPreview, extractUrlsFromText } from "../utils/linkPreview";
import * as FileSystem from 'expo-file-system/legacy';
import { normalizeHandle as normalizePublicHandle } from "../utils/handles";

const POSTS_API = "https://www.ecothot.com/_functions/posts";
const UPLOAD_API = "https://www.ecothot.com/_functions/uploadMedia";
const UPLOAD_FINALIZE_API = "https://www.ecothot.com/_functions/uploadMediaFinalize";

interface FeedViewer {
  userEmail?: string | null;
  displayName?: string | null;
  handleAliases?: string[];
  friends?: { handle: string }[];
}

interface FeedState {
  posts: Post[];
  fetchPosts: (viewer?: FeedViewer) => Promise<void>;
  createPostRemote: (
    post: Omit<Post, "id" | "timestamp" | "likes" | "commentsList" | "isLiked">
  ) => Promise<void>;
  toggleLike: (postId: string) => void;
  addComment: (postId: string, comment: Omit<Comment, "id" | "timestamp">) => void;
  updatePostPrivacy: (postId: string, privacy: PrivacyLevel) => Promise<void>;
  updateCommentPrivacy: (postId: string, commentId: string, privacy: CommentPrivacyLevel) => void;
  updateAuthorHandle: (oldHandles: string[], newHandle: string, email?: string | null) => void;
  deletePost: (postId: string) => void;
}

const PRIVACY_VALUES: PrivacyLevel[] = ["public", "friends", "private", "group"];

function normalizeHandle(value?: string | null) {
  return normalizePublicHandle(value, "");
}

function normalizePrivacyValue(value: any): PrivacyLevel {
  return PRIVACY_VALUES.includes(value) ? value : "public";
}

function buildPostsUrl(viewer?: FeedViewer) {
  if (!viewer) return POSTS_API;
  const handles = new Set<string>();
  if (viewer.displayName) handles.add(viewer.displayName);
  if (viewer.displayName) handles.add(normalizeHandle(viewer.displayName));
  if (viewer.userEmail) {
    handles.add(viewer.userEmail.split("@")[0]);
    handles.add(normalizeHandle(viewer.userEmail.split("@")[0]));
  }
  (viewer.handleAliases || []).forEach((alias) => {
    if (!alias) return;
    handles.add(alias);
    handles.add(normalizeHandle(alias));
  });
  const friendHandles = (viewer.friends || []).map((friend) => friend.handle).filter(Boolean);
  const query = new URLSearchParams();
  if (viewer.userEmail) query.set("viewerEmail", viewer.userEmail);
  if (handles.size > 0) query.set("viewer", Array.from(handles).join(","));
  if (friendHandles.length > 0) {
    const normalizedFriends = new Set<string>();
    friendHandles.forEach((handle) => {
      normalizedFriends.add(handle);
      normalizedFriends.add(normalizeHandle(handle));
    });
    query.set("friends", Array.from(normalizedFriends).filter(Boolean).join(","));
  }
  const qs = query.toString();
  return qs ? `${POSTS_API}?${qs}` : POSTS_API;
}

function mapFromBackend(item: any): Post {
  // Wix CMS URL fields can come back as:
  // - string URLs
  // - objects like { url: "https://..." }
  // Also, we’ve seen occasional bad URLs like "...~mv2.jpg~mv2.jpg" which won’t render.
  const normalizeWixAudioUrl = (url: string): string => {
    const wixAudioAsImageMatch = url.match(
      /^https?:\/\/static\.wixstatic\.com\/media\/([^/?#]+)\.(m4a|mp3|aac|wav)~mv2\.jpg$/i
    );
    if (wixAudioAsImageMatch?.[1] && wixAudioAsImageMatch?.[2]) {
      return `https://static.wixstatic.com/mp3/${wixAudioAsImageMatch[1]}.${wixAudioAsImageMatch[2].toLowerCase()}`;
    }
    const wixMediaAudioMatch = url.match(
      /^https?:\/\/static\.wixstatic\.com\/media\/([^/?#]+)~mv2\.(m4a|mp3|aac|wav)$/i
    );
    if (wixMediaAudioMatch?.[1] && wixMediaAudioMatch?.[2]) {
      return `https://static.wixstatic.com/mp3/${wixMediaAudioMatch[1]}.${wixMediaAudioMatch[2].toLowerCase()}`;
    }
    return url;
  };

  const rawMediaList = (item?.MediaUrls ||
    item?.mediaUrls ||
    item?.Media ||
    item?.media ||
    []) as any[];

  const normalizeUrl = (v: any): string | null => {
    if (!v) return null;
    const url =
      typeof v === "string"
        ? v
        : typeof v === "object"
        ? v.url || v.src || v.href || null
        : null;
    if (!url || typeof url !== "string") return null;

    // Fix common duplication bug: "...~mv2.jpg~mv2.jpg" or "...~mv2.mp4~mv2.mp4"
    const fixed = url.replace(/(~mv2\.[a-z0-9]+)\1$/i, "$1");

    // Wix "media" URLs ending in ~mv2.mp4 are often not publicly playable (403) in native players.
    // Convert to Wix's public transcoded MP4 variant.
    // Example:
    // - https://static.wixstatic.com/media/<id>~mv2.mp4
    // -> https://video.wixstatic.com/video/<id>/480p/mp4/file.mp4
    const mediaMp4Match = fixed.match(/^https?:\/\/static\.wixstatic\.com\/media\/([^/?#]+)~mv2\.mp4/i);
    if (mediaMp4Match?.[1]) {
      const id = mediaMp4Match[1];
      return `https://video.wixstatic.com/video/${id}/480p/mp4/file.mp4`;
    }

    // Wix video URLs with `/file.mp4` can return 403; normalize to the public 480p MP4.
    const videoFileMatch = fixed.match(/^https?:\/\/video\.wixstatic\.com\/video\/([^/?#]+)\/file\.mp4/i);
    if (videoFileMatch?.[1]) {
      const id = videoFileMatch[1];
      return `https://video.wixstatic.com/video/${id}/480p/mp4/file.mp4`;
    }

    return fixed;
  };

  const media =
    rawMediaList
      .map(normalizeUrl)
      .filter((m): m is string => !!m) || [];

  const date =
    item?.["Date Published"] ||
    item?.datePublished ||
    item?._createdDate ||
    Date.now();

  const content = item?.["Plain Content"] || item?.content || "";
  const rawLinkPreview =
    item?.LinkPreview ||
    item?.linkPreview ||
    item?.["Link Preview"] ||
    item?.link_preview ||
    null;
  let linkPreview: LinkPreview | undefined;
  if (rawLinkPreview) {
    try {
      linkPreview =
        typeof rawLinkPreview === "string"
          ? JSON.parse(rawLinkPreview)
          : rawLinkPreview;
    } catch {
      linkPreview = undefined;
    }
  }
  if (!linkPreview) {
    const firstUrl = extractUrlsFromText(content)[0];
    linkPreview = firstUrl ? detectLinkPreview(firstUrl) || undefined : undefined;
  } else {
    linkPreview = completeLinkPreview(linkPreview, content) || undefined;
  }

  const rawAudio =
    item?.Audio ||
    item?.audio ||
    item?.PostAudio ||
    item?.postAudio ||
    item?.["Post Audio"] ||
    null;
  let audio: PostAudio | undefined;
  if (rawAudio) {
    try {
      audio = typeof rawAudio === "string" ? JSON.parse(rawAudio) : rawAudio;
    } catch {
      audio = undefined;
    }
  }
  const audioUrl =
    item?.AudioUrl ||
    item?.audioUrl ||
    item?.AudioURL ||
    item?.audioURL ||
    audio?.uri ||
    null;
  if (audioUrl) {
    audio = {
      uri: normalizeWixAudioUrl(String(audioUrl)),
      title: audio?.title || item?.AudioTitle || item?.audioTitle || "Cuevas Audio Transmission",
      artist: audio?.artist || item?.AudioArtist || item?.audioArtist || item?.User || item?.author || undefined,
      durationMs: audio?.durationMs || item?.AudioDurationMs || item?.audioDurationMs || undefined,
    };
  }

  return {
    id: item?._id?.toString?.() || Date.now().toString(),
    author: item?.User || item?.author || "anonymous",
    authorEmail: item?.AuthorEmail || item?.authorEmail || item?.UserEmail || item?.userEmail || undefined,
    authorRewardPoints: item?.authorRewardPoints ?? item?.cuevas ?? 0,
    content,
    images: media.length ? media : undefined,
    audio,
    linkPreview,
    timestamp: new Date(date).getTime(),
    likes: item?.["Like Count"] ?? item?.likeCount ?? 0,
    commentsList: item?.commentsList || [],
    isLiked: false,
    privacy: normalizePrivacyValue(item?.Privacy || item?.privacy || item?.PostPrivacy || item?.postPrivacy),
  };
}

function mapToBackend(
  postData: Omit<Post, "id" | "timestamp" | "likes" | "commentsList" | "isLiked">,
  mediaUrls: string[]
) {
  const payload: any = {
    User: postData.author,
    author: postData.author,
    AuthorEmail: postData.authorEmail || "",
    authorEmail: postData.authorEmail || "",
    "Plain Content": postData.content,
    Media: mediaUrls,
    MediaUrls: mediaUrls,
    Hashtags: [],
    "Like Count": 0,
    "Date Published": new Date().toISOString(),
    authorRewardPoints: postData.authorRewardPoints ?? 0,
    Privacy: normalizePrivacyValue(postData.privacy),
    privacy: normalizePrivacyValue(postData.privacy),
    PostPrivacy: normalizePrivacyValue(postData.privacy),
  };
  if (postData.audio?.uri) {
    payload.AudioUrl = postData.audio.uri;
    payload.Audio = JSON.stringify(postData.audio);
    payload.AudioTitle = postData.audio.title;
    payload.AudioArtist = postData.audio.artist || "";
    payload.AudioDurationMs = postData.audio.durationMs || 0;
  }
  return payload;
}

async function uploadOne(uri: string): Promise<string> {
  // Wix/Velo request bodies have strict size limits. To upload photos/videos reliably:
  // 1) Ask Wix for an uploadUrl, 2) PUT the binary directly to that URL, 3) finalize to get the public URL.

  // Media can be encoded as: <uri>#name=<...>&mime=<...>&kind=<...>
  const [rawUri, hash] = uri.split("#", 2);
  let providedName = "";
  let providedMime = "";
  let providedKind = "";
  let providedDestination = "";
  if (hash) {
    for (const part of hash.split("&")) {
      const [k, v] = part.split("=", 2);
      if (!k) continue;
      const val = v ? decodeURIComponent(v) : "";
      if (k === "name") providedName = val;
      else if (k === "mime") providedMime = val;
      else if (k === "kind") providedKind = val;
      else if (k === "destination") providedDestination = val;
    }
  }

  // Fall back to old inference only if metadata is missing.
  const rawName = providedName || rawUri.split("/").pop() || `upload-${Date.now()}`;
  const rawExt = rawName.includes(".") ? rawName.split(".").pop()?.toLowerCase() : undefined;
  const ext = rawExt || "jpg";

  const inferredMime =
    ext === "mp4" || ext === "mov" || ext === "m4v"
      ? ext === "mov"
        ? "video/quicktime"
        : ext === "m4v"
        ? "video/x-m4v"
        : "video/mp4"
      : ext === "mp3"
      ? "audio/mpeg"
      : ext === "m4a"
      ? "audio/m4a"
      : ext === "wav"
      ? "audio/wav"
      : ext === "aac"
      ? "audio/aac"
      : ext === "heic"
      ? "image/heic"
      : ext === "heif"
      ? "image/heif"
      : ext === "png"
      ? "image/png"
      : "image/jpeg";

  const mime =
    providedMime ||
    (providedKind === "video"
      ? inferredMime.startsWith("video/") ? inferredMime : "video/mp4"
      : providedKind === "audio"
      ? inferredMime.startsWith("audio/") ? inferredMime : "audio/m4a"
      : providedKind === "image"
      ? inferredMime
      : inferredMime);

  // Ensure filename has an extension.
  const filename = rawName.includes(".")
    ? rawName
    : `${rawName}.${
        mime === "video/quicktime" ? "mov" : mime.startsWith("video/") ? "mp4" : mime === "audio/mpeg" ? "mp3" : mime.startsWith("audio/") ? "m4a" : mime === "image/png" ? "png" : "jpg"
      }`;

  console.log("[UPLOAD_ONE] inferred", { filename, mime, providedKind, providedMime, providedName, providedDestination });

  // Step 1: init (get uploadUrl + (maybe) fileId)
  const initRes = await fetch(UPLOAD_API, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: filename,
      mimeType: mime,
      kind: providedKind || undefined,
      destination: providedDestination || undefined,
    }),
  });
  const initText = await initRes.text();
  let initJson: any = null;
  try {
    initJson = initText ? JSON.parse(initText) : null;
  } catch (e) {
    console.error("Upload init parse error", { status: initRes.status, initText });
    throw new Error(`Upload init failed (${initRes.status}): ${initText || "No body"}`);
  }
  if (!initRes.ok || !initJson?.success) {
    console.error("Upload init not ok", { status: initRes.status, initText });
    throw new Error(initJson?.error || `Upload init failed (${initRes.status}): ${initText || "No body"}`);
  }

  const uploadUrl: string | undefined =
    initJson?.uploadUrl || initJson?.data?.uploadUrl || initJson?.result?.uploadUrl;
  const initFileId: string | undefined =
    initJson?.fileId || initJson?.data?.fileId || initJson?.result?.fileId || initJson?.id;
  const trackingKey: string | undefined =
    initJson?.trackingKey || initJson?.data?.trackingKey || initJson?.result?.trackingKey;

  if (!uploadUrl) {
    console.error("Upload init missing uploadUrl", initJson);
    throw new Error("Upload init failed: missing uploadUrl");
  }

  // Step 2: upload binary directly to Wix
  const uploadResult = await FileSystem.uploadAsync(uploadUrl, rawUri, {
    httpMethod: "PUT",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { "Content-Type": mime },
  });

  // Some Wix upload endpoints return JSON that includes a file ID. Try to extract it.
  let uploadedFileId: string | undefined = initFileId;
  if (uploadResult?.body) {
    try {
      const bodyJson = JSON.parse(uploadResult.body);
      uploadedFileId =
        bodyJson?.fileId ||
        bodyJson?.id ||
        bodyJson?.file?._id ||
        bodyJson?.file?.id ||
        bodyJson?.fileId;
    } catch {
      // ignore (body may be empty or non-JSON)
    }
  }

  if (!uploadedFileId) {
    // Some Wix environments do not return fileId from generateFileUploadUrl.
    // We fall back to a trackingKey (usually the unique filename/hash Wix embeds in the upload URL).
    uploadedFileId = trackingKey;
  }

  if (!uploadedFileId) {
    console.error("Upload missing fileId/trackingKey (init + upload response)", {
      initJson,
      uploadStatus: uploadResult?.status,
      uploadBody: uploadResult?.body,
    });
    throw new Error("Upload failed: missing fileId/trackingKey");
  }

  // Step 3: finalize (backend polls until Wix URL is live)
  console.log("[UPLOAD_ONE] calling finalize", { fileId: initFileId, trackingKey: uploadedFileId, fileName: filename, mimeType: mime });
  const finRes = await fetch(UPLOAD_FINALIZE_API, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    // backend accepts fileId OR trackingKey, plus mimeType for extension
    body: JSON.stringify({ 
      fileId: initFileId || null, 
      trackingKey: uploadedFileId, 
      fileName: filename,
      mimeType: mime,
    }),
  });
  const finText = await finRes.text();
  let finJson: any = null;
  try {
    finJson = finText ? JSON.parse(finText) : null;
  } catch (e) {
    console.error("Upload finalize parse error", { status: finRes.status, finText });
    throw new Error(`Upload finalize failed (${finRes.status}): ${finText || "No body"}`);
  }

  if (finRes.ok && finJson?.success && finJson?.url) {
    console.log("[UPLOAD_ONE] finalize success", { url: finJson.url, timedOut: finJson.timedOut });
    return finJson.url as string;
  }

  console.error("Upload finalize not ok", { status: finRes.status, finText });
  throw new Error(finJson?.error || `Upload finalize failed (${finRes.status}): ${finText || "No body"}`);
}

export const useFeedStore = create<FeedState>()(
  persist(
    (set) => ({
      posts: [],

      fetchPosts: async (viewer) => {
        try {
          const res = await fetch(buildPostsUrl(viewer), { method: "GET" });
          const json = await res.json();
          if (json?.success && Array.isArray(json.posts)) {
            set({ posts: json.posts.map(mapFromBackend) });
          }
        } catch (e) {
          console.error("fetchPosts error", e);
        }
      },

      createPostRemote: async (postData) => {
        try {
          const mediaUris = (postData.images || []).filter(Boolean);
          const uploaded: string[] = [];
          for (const uri of mediaUris) {
            const url = await uploadOne(uri);
            uploaded.push(url);
          }

          let audio = postData.audio;
          if (postData.audio?.uri && !postData.audio.uri.startsWith("http")) {
            const uploadedAudio = await uploadOne(postData.audio.uri);
            audio = { ...postData.audio, uri: uploadedAudio };
          }

          const payload = mapToBackend({ ...postData, audio }, uploaded);
          const res = await fetch(POSTS_API, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(payload),
          });
          const resText = await res.text();
          let json: any = null;
          try {
            json = resText ? JSON.parse(resText) : null;
          } catch (e) {
            console.error("Create post parse error", { status: res.status, resText });
            throw new Error(`Create post parse error (${res.status}): ${resText || "No body"}`);
          }
          if (json?.success && json.post) {
            const mappedPost = mapFromBackend(json.post);
            const newPost = {
              ...mappedPost,
              audio: mappedPost.audio || audio,
              privacy: normalizePrivacyValue(postData.privacy),
            };
            set((state) => ({
              posts: [newPost, ...state.posts],
            }));
          } else {
            console.error("Create post not ok", { status: res.status, resText });
            throw new Error(json?.error || "Failed to create post");
          }
        } catch (e) {
          console.error("createPostRemote error", e);
          // Optional fallback: local insert to avoid UX break
        set((state) => ({
          posts: [
            {
              ...postData,
              id: Date.now().toString(),
              timestamp: Date.now(),
              likes: 0,
              commentsList: [],
              isLiked: false,
            },
            ...state.posts,
          ],
          }));
        }
      },

      toggleLike: (postId) =>
        set((state) => ({
          posts: state.posts.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  isLiked: !post.isLiked,
                  likes: post.isLiked ? post.likes - 1 : post.likes + 1,
                }
              : post
          ),
        })),

      addComment: (postId, commentData) =>
        set((state) => ({
          posts: state.posts.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  commentsList: [
                    ...(post.commentsList || []),
                    {
                      ...commentData,
                      id: `c${Date.now()}`,
                      timestamp: Date.now(),
                      privacy: commentData.privacy || "public",
                    },
                  ],
                }
              : post
          ),
        })),

      updatePostPrivacy: async (postId, privacy) => {
          const safePrivacy = normalizePrivacyValue(privacy);
          let previousPrivacy: PrivacyLevel = "public";
          set((state) => ({
            posts: state.posts.map((post) => {
              if (post.id !== postId) return post;
              previousPrivacy = normalizePrivacyValue(post.privacy);
              return { ...post, privacy: safePrivacy };
            }),
          }));

          try {
            const res = await fetch(POSTS_API, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              id: postId,
              _id: postId,
              Privacy: safePrivacy,
              privacy: safePrivacy,
              PostPrivacy: safePrivacy,
            }),
            });
            const text = await res.text();
            let json: any = null;
            try {
              json = text ? JSON.parse(text) : null;
            } catch {
              // Keep the response text for the error below.
            }
            if (!res.ok || !json?.success) {
              throw new Error(json?.error || text || `Privacy save failed (${res.status})`);
            }
          } catch (e) {
            set((state) => ({
              posts: state.posts.map((post) =>
                post.id === postId ? { ...post, privacy: previousPrivacy } : post
              ),
            }));
            console.log("[FEED] updatePostPrivacy remote failed", String(e));
            throw e;
          }
        },

      updateCommentPrivacy: (postId, commentId, privacy) =>
        set((state) => ({
          posts: state.posts.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  commentsList: (post.commentsList || []).map((comment) =>
                    comment.id === commentId ? { ...comment, privacy } : comment
                  ),
                }
              : post
          ),
        })),

      updateAuthorHandle: (oldHandles, newHandle, email) => {
        const aliases = new Set((oldHandles || []).map(normalizeHandle).filter(Boolean));
        const normalizedEmail = normalizeHandle(email);
        if (!newHandle.trim() || (aliases.size === 0 && !normalizedEmail)) return;

        set((state) => ({
          posts: state.posts.map((post) => {
            const postMatches =
              (normalizedEmail && normalizeHandle(post.authorEmail) === normalizedEmail) ||
              aliases.has(normalizeHandle(post.author));
            const commentsList = (post.commentsList || []).map((comment) => {
              const commentMatches =
                (normalizedEmail && normalizeHandle(comment.authorEmail) === normalizedEmail) ||
                aliases.has(normalizeHandle(comment.author));
              return commentMatches ? { ...comment, author: newHandle, authorEmail: email || comment.authorEmail } : comment;
            });

            return {
              ...post,
              author: postMatches ? newHandle : post.author,
              authorEmail: postMatches && email ? email : post.authorEmail,
              commentsList,
            };
          }),
        }));
      },

      deletePost: (postId) => {
        set((state) => ({
          posts: state.posts.filter((post) => post.id !== postId),
        }));
        fetch(POSTS_API, {
          method: "DELETE",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ id: postId, _id: postId }),
        }).catch((e) => console.log("[FEED] deletePost remote failed", String(e)));
      },
    }),
    {
      name: "feed-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

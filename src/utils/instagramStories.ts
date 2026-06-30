import { Alert, Linking, Platform } from "react-native";
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from "expo-media-library";
import Constants from "expo-constants";
import RNShare, { Social } from "react-native-share";

const BACKEND_URL = "https://us-central1-ecothot-social-media.cloudfunctions.net";

type ShareToInstagramStoryOpts = {
  /** Facebook App ID (required on iOS since Jan 2023). */
  appId?: string;
  /** Optional deep-link back to your app/site. */
  attributionURL?: string;
  /** Optional gradient colors (hex). */
  backgroundTopColor?: string;
  backgroundBottomColor?: string;
  /** Optional video to use as the Instagram Story background. */
  backgroundVideoUri?: string;
  /** Optional debug tag for logs */
  debugTag?: string;
};

function getInstagramFbAppId(explicit?: string): string | undefined {
  if (explicit) return explicit;
  const env =
    process.env.EXPO_PUBLIC_INSTAGRAM_FB_APP_ID ||
    process.env.EXPO_PUBLIC_FACEBOOK_APP_ID ||
    process.env.EXPO_PUBLIC_FB_APP_ID;
  if (env) return env;
  const extra = (Constants.expoConfig?.extra || (Constants as any).manifest?.extra || {}) as Record<string, any>;
  const fromExtra = extra.instagramFbAppId || extra.facebookAppId || extra.fbAppId;
  return fromExtra ? String(fromExtra) : undefined;
}

async function prepareBackgroundVideoUri(videoUri: string, tag: string): Promise<string | undefined> {
  if (Platform.OS !== "ios" || /[?&]id=/.test(videoUri)) {
    return videoUri;
  }

  const permission = await MediaLibrary.requestPermissionsAsync();
  if (!permission.granted) {
    console.log(tag, "media library permission denied for story video");
    return undefined;
  }

  try {
    let readableUri = videoUri;
    if (/^https?:\/\//i.test(videoUri)) {
      const target =
        FileSystem.cacheDirectory +
        `cuevas-ig-story-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
      console.log(tag, "downloading remote story video", { from: videoUri, to: target });
      const downloaded = await FileSystem.downloadAsync(videoUri, target);
      readableUri = downloaded.uri;
    }

    const asset = await MediaLibrary.createAssetAsync(readableUri);
    console.log(tag, "created media library asset for story video", {
      hasId: !!asset.id,
      uri: asset.uri,
    });
    return `${asset.uri}?id=${encodeURIComponent(asset.id)}`;
  } catch (e) {
    console.log(tag, "createAssetAsync failed for story video", String(e));
    return undefined;
  }
}

async function composeInstagramStoryVideo(
  videoUrl: string,
  overlayPngBase64: string,
  tag: string
): Promise<string | undefined> {
  try {
    console.log(tag, "requesting Firebase video composition");
    const response = await fetch(`${BACKEND_URL}/instagramStoryVideo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoUrl, overlayPngBase64 }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.success || !data?.url) {
      console.log(tag, "Firebase composition failed", {
        status: response.status,
        error: data?.error,
      });
      return undefined;
    }
    console.log(tag, "Firebase composition ready", {
      hasUrl: !!data.url,
      storagePath: data.storagePath,
    });
    return String(data.url);
  } catch (e) {
    console.log(tag, "Firebase composition request failed", String(e));
    return undefined;
  }
}

export async function sharePngUriToInstagramStory(
  pngUri: string,
  opts: ShareToInstagramStoryOpts = {}
): Promise<boolean> {
  const tag = opts.debugTag ? `[IG_STORY:${opts.debugTag}]` : "[IG_STORY]";

  try {
    if (!pngUri) {
      console.log(tag, "missing pngUri");
      return false;
    }

    if (Platform.OS === "web") {
      Alert.alert("Instagram share isn't supported on web.");
      return false;
    }

    // iOS requires LSApplicationQueriesSchemes for canOpenURL to work.
    // If it isn't present in the built app, canOpenURL can THROW with:
    // "Unable to open URL: ... Add instagram-stories to LSApplicationQueriesSchemes in your Info.plist."
    // We treat that as a build-config issue and still try shareSingle (which will fail gracefully if IG isn't installed).
    let canOpen: boolean | null = null;
    try {
      canOpen = await Linking.canOpenURL("instagram-stories://share");
      console.log(tag, "canOpenURL(instagram-stories://share)=", canOpen);
      if (canOpen === false) {
        Alert.alert("Instagram not installed", "Install Instagram to share to Stories.");
        return false;
      }
    } catch (e: any) {
      console.log(tag, "canOpenURL threw (likely missing LSApplicationQueriesSchemes)", String(e?.message || e));
      canOpen = null; // unknown, continue
    }

    const appId = getInstagramFbAppId(opts.appId);
    console.log(tag, "resolved appId?", !!appId);
    if (Platform.OS === "ios" && !appId) {
      Alert.alert(
        "Missing Facebook App ID",
        "To share to Instagram Stories on iOS, set EXPO_PUBLIC_INSTAGRAM_FB_APP_ID (or add expo.extra.instagramFbAppId in app.json)."
      );
      return false;
    }

    // Convert the file:// PNG into a data URL (most reliable across iOS/Android for stories).
    const base64 = await FileSystem.readAsStringAsync(pngUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const dataUrl = `data:image/png;base64,${base64}`;

    const socialKey = Social.InstagramStories;
    if (!RNShare?.shareSingle || !socialKey) {
      console.log(tag, "react-native-share missing shareSingle/Social.INSTAGRAM_STORIES");
      Alert.alert("Share not available", "Instagram Stories sharing is not available in this build.");
      return false;
    }

    const shareOptions: any = {
      social: socialKey,
      backgroundTopColor: opts.backgroundTopColor || "#06A7A1",
      backgroundBottomColor: opts.backgroundBottomColor || "#0891B2",
      attributionURL: opts.attributionURL || "https://www.ecothot.com/",
    };
    if (opts.backgroundVideoUri) {
      const composedVideoUrl = await composeInstagramStoryVideo(opts.backgroundVideoUri, base64, tag);
      const preparedVideo = composedVideoUrl
        ? await prepareBackgroundVideoUri(composedVideoUrl, tag)
        : undefined;
      if (preparedVideo) {
        shareOptions.backgroundVideo = preparedVideo;
      } else {
        shareOptions.backgroundImage = dataUrl;
      }
    } else {
      shareOptions.backgroundImage = dataUrl;
    }
    if (Platform.OS === "ios") {
      shareOptions.appId = appId;
    }

    console.log(tag, "calling shareSingle", {
      social: "INSTAGRAM_STORIES",
      hasBackgroundImage: !!shareOptions.backgroundImage,
      hasBackgroundVideo: !!shareOptions.backgroundVideo,
      hasStickerImage: !!shareOptions.stickerImage,
      hasAppId: !!shareOptions.appId,
      attributionURL: shareOptions.attributionURL,
    });
    await RNShare.shareSingle(shareOptions);
    return true;
  } catch (e: any) {
    console.log("[IG_STORY] error", String(e?.message || e));
    try {
      console.log("[IG_STORY] error obj", JSON.stringify(e));
    } catch {}
    Alert.alert("Share failed", "Could not share to Instagram Stories.");
    return false;
  }
}

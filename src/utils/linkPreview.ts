import { LinkPreview } from "../types/feed";

export function completeLinkPreview(preview: LinkPreview | null | undefined, text?: string): LinkPreview | null {
  const previewUrl = preview?.url;
  const textUrl = text ? extractUrlsFromText(text)[0] : null;
  const detected = detectLinkPreview(previewUrl || textUrl || "");
  if (!preview && !detected) return null;
  if (!preview) return detected;
  if (!detected) return preview;

  return {
    ...detected,
    ...preview,
    title: preview.title || detected.title,
    description: preview.description || detected.description,
    thumbnail: preview.thumbnail || detected.thumbnail,
    domain: preview.domain || detected.domain,
  };
}

export async function enrichLinkPreview(preview: LinkPreview | null): Promise<LinkPreview | null> {
  if (!preview?.url) return preview;

  try {
    if (preview.type === "youtube") {
      const response = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(preview.url)}&format=json`
      );
      if (!response.ok) return preview;

      const data = await response.json();
      return {
        ...preview,
        title: typeof data?.title === "string" && data.title ? data.title : preview.title,
        thumbnail:
          typeof data?.thumbnail_url === "string" && data.thumbnail_url
            ? data.thumbnail_url
            : preview.thumbnail,
        description: preview.description || "Watch on YouTube",
      };
    }

    const response = await fetch(preview.url);
    if (!response.ok) return preview;
    const html = await response.text();
    const title =
      readMeta(html, "property", "og:title") ||
      readMeta(html, "name", "twitter:title") ||
      readTitle(html) ||
      preview.title;
    const description =
      readMeta(html, "property", "og:description") ||
      readMeta(html, "name", "description") ||
      readMeta(html, "name", "twitter:description") ||
      preview.description;
    const image =
      readMeta(html, "property", "og:image") ||
      readMeta(html, "name", "twitter:image") ||
      preview.thumbnail;

    return {
      ...preview,
      title: title ? decodeHtml(title).trim() : preview.title,
      description: description ? decodeHtml(description).trim() : preview.description,
      thumbnail: image ? absolutizeUrl(image.trim(), preview.url) : preview.thumbnail,
    };
  } catch {
    return preview;
  }
}

/**
 * Detects if a URL is from a supported platform and extracts preview data
 */
export function detectLinkPreview(url: string): LinkPreview | null {
  try {
    const cleanUrl = sanitizeUrl(url);
    const urlObj = new URL(cleanUrl);
    const domain = urlObj.hostname.replace("www.", "");

    // YouTube detection
    if (domain.includes("youtube.com") || domain.includes("youtu.be")) {
      const videoId = extractYouTubeId(cleanUrl);
      if (videoId) {
        return {
          url: cleanUrl,
          type: "youtube",
          title: "Watch on YouTube",
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          domain: "youtube.com",
        };
      }
    }

    // Spotify detection
    if (domain.includes("spotify.com")) {
      const spotifyData = extractSpotifyData(cleanUrl);
      if (spotifyData) {
        return {
          url: cleanUrl,
          type: "spotify",
          title: `Spotify ${spotifyData.type}`,
          description: "Listen on Spotify",
          domain: "spotify.com",
          thumbnail: "https://storage.googleapis.com/pr-newsroom-wp/1/2018/11/Spotify_Logo_RGB_Green.png",
        };
      }
    }

    // Generic link
    return {
      url: cleanUrl,
      type: "generic",
      title: domain,
      description: "External link",
      domain,
    };
  } catch {
    return null;
  }
}

function sanitizeUrl(url: string): string {
  return String(url || "").trim().replace(/[),.?!]+$/g, "");
}

function readMeta(html: string, attr: "property" | "name", value: string): string | undefined {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+${attr}=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

function readTitle(html: string): string | undefined {
  return html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function absolutizeUrl(maybeUrl: string, baseUrl: string): string {
  try {
    return new URL(maybeUrl, baseUrl).toString();
  } catch {
    return maybeUrl;
  }
}

/**
 * Extract YouTube video ID from various URL formats
 */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#/]+)/,
    /youtube\.com\/live\/([^&\n?#/]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Extract Spotify content type and ID
 */
function extractSpotifyData(url: string): { type: string; id: string } | null {
  const match = url.match(/spotify\.com\/(track|album|playlist|artist)\/([^?&\n]+)/);
  if (match) {
    return {
      type: match[1],
      id: match[2],
    };
  }
  return null;
}

/**
 * Extract URLs from text content
 */
export function extractUrlsFromText(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);
  return (matches || []).map(sanitizeUrl).filter(Boolean);
}

/**
 * Format timestamp to relative time (e.g., "2h ago", "1d ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) {
    return new Date(timestamp).toLocaleDateString();
  } else if (days > 0) {
    return `${days}d ago`;
  } else if (hours > 0) {
    return `${hours}h ago`;
  } else if (minutes > 0) {
    return `${minutes}m ago`;
  } else {
    return "Just now";
  }
}

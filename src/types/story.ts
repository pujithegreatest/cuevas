export type StoryFilter =
  | "none"
  | "heatwave"
  | "hologram"
  | "vaporwave"
  | "infrared"
  | "glitch"
  | "matrix"
  | "void"
  | "noir"
  | "sepia"
  | "acid"
  | "arctic"
  | "dream"
  | "neon"
  | "xray"
  | "thermal"
  | "predator"
  | "scanner"
  | "chrome"
  | "radioactive";

export type StorySticker =
  | "custom"
  | "timestamp"
  | "location"
  | "fire"
  | "heart"
  | "lightning"
  | "skull"
  | "star"
  | "alien"
  | "robot"
  | "moon";

export interface StoryStickerPick {
  kind: StorySticker;
  label?: string;
  preview?: string;
  imageUri?: string;
  text?: string;
}

export interface StoryStickerOverlay {
  id: string;
  kind: StorySticker;
  // Static label override (e.g. captured timestamp text)
  text?: string;
  label?: string;
  imageUri?: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface DrawStroke {
  id: string;
  color: string;
  width: number;
  // Normalized 0..1 points
  points: { x: number; y: number }[];
}

export interface StoryTextOverlay {
  id: string;
  text: string;
  // Normalized 0..1 position within the canvas
  x: number;
  y: number;
  scale: number;
  rotation: number;
  color: string;
  style: "neon" | "mono" | "chrome" | "blood" | "ticker" | "wave" | "glitch";
}

export interface StoryMusic {
  id: string;
  startMs: number;
  endMs: number;
}

export interface StoryVoiceover {
  uri: string;
  durationMs: number;
}

export interface Story {
  id: string;
  author: string;
  authorRewardPoints?: number;
  privacy?: import("./feed").PrivacyLevel;
  imageUri: string;
  mediaType?: "image" | "video";
  videoDurationMs?: number;
  videoTrimStartMs?: number;
  videoTrimEndMs?: number;
  thumbnailUri?: string;
  filter?: StoryFilter;
  liveFilter?: StoryFilter;
  textOverlays?: StoryTextOverlay[];
  music?: StoryMusic;
  voiceover?: StoryVoiceover;
  timestamp: number;
}

export interface StoryGroup {
  author: string;
  authorRewardPoints?: number;
  stories: Story[];
  isOwn: boolean;
  hasUnviewed: boolean;
}

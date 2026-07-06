export interface LinkPreview {
  url: string;
  type: "youtube" | "spotify" | "generic";
  title?: string;
  description?: string;
  thumbnail?: string;
  domain?: string;
}

export type PrivacyLevel = "public" | "friends" | "private" | "group";
export type CommentPrivacyLevel = PrivacyLevel | "poster";

export interface Comment {
  id: string;
  author: string;
  authorEmail?: string;
  authorRewardPoints: number;
  content: string;
  timestamp: number;
  privacy?: CommentPrivacyLevel;
}

export interface PostMusic {
  id: string;
  startMs: number;
  endMs: number;
}

export interface PostAudio {
  uri: string;
  title: string;
  artist?: string;
  durationMs?: number;
}

export interface MissionShare {
  id: string;
  title: string;
  description?: string;
  points?: number;
  durationHours?: number;
  location?: string;
  eventDate?: string;
  eventDateISO?: string;
  type?: string;
  difficulty?: string;
  peopleNeeded?: number | string;
  gearProvided?: boolean;
  materialsNote?: string;
  eventUrl?: string;
  businessName?: string;
  businessHandle?: string;
  businessVerified?: boolean;
  goingCount?: number;
  status?: string;
}

export interface Post {
  id: string;
  author: string;
  authorEmail?: string;
  authorRewardPoints: number;
  authorAvatar?: string;
  content: string;
  images?: string[];
  audio?: PostAudio;
  linkPreview?: LinkPreview;
  missionShare?: MissionShare;
  timestamp: number;
  likes: number;
  commentsList: Comment[];
  isLiked?: boolean;
  privacy?: PrivacyLevel;
}

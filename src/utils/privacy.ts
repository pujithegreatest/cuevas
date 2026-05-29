import { Comment, CommentPrivacyLevel, Post, PrivacyLevel } from "../types/feed";
import type { FriendNode } from "../state/appStore";

export const POST_PRIVACY_OPTIONS: {
  value: PrivacyLevel;
  label: string;
  shortLabel: string;
  icon: string;
}[] = [
  { value: "public", label: "Everyone", shortLabel: "GLOBAL", icon: "globe-outline" },
  { value: "friends", label: "Research Network", shortLabel: "NETWORK", icon: "people-outline" },
  { value: "private", label: "My Eyes Only", shortLabel: "MY EYES", icon: "lock-closed-outline" },
  { value: "group", label: "Selected Crew", shortLabel: "CREW", icon: "person-add-outline" },
];

export const COMMENT_PRIVACY_OPTIONS: {
  value: CommentPrivacyLevel;
  label: string;
  shortLabel: string;
  icon: string;
}[] = [
  ...POST_PRIVACY_OPTIONS,
  { value: "poster", label: "Only Poster", shortLabel: "POSTER DM", icon: "paper-plane-outline" },
];

export function getPrivacyOption(value?: PrivacyLevel) {
  return (
    POST_PRIVACY_OPTIONS.find((option) => option.value === value) ||
    POST_PRIVACY_OPTIONS[0]
  );
}

export function getCommentPrivacyOption(value?: CommentPrivacyLevel) {
  return (
    COMMENT_PRIVACY_OPTIONS.find((option) => option.value === value) ||
    COMMENT_PRIVACY_OPTIONS[0]
  );
}

export function nextPrivacy(value?: PrivacyLevel): PrivacyLevel {
  const current = POST_PRIVACY_OPTIONS.findIndex((option) => option.value === value);
  return POST_PRIVACY_OPTIONS[(current + 1 + POST_PRIVACY_OPTIONS.length) % POST_PRIVACY_OPTIONS.length].value;
}

export function nextCommentPrivacy(value?: CommentPrivacyLevel): CommentPrivacyLevel {
  const current = COMMENT_PRIVACY_OPTIONS.findIndex((option) => option.value === value);
  return COMMENT_PRIVACY_OPTIONS[(current + 1 + COMMENT_PRIVACY_OPTIONS.length) % COMMENT_PRIVACY_OPTIONS.length].value;
}

export function normalizePrivacy(value: unknown, fallback: PrivacyLevel = "public"): PrivacyLevel {
  return POST_PRIVACY_OPTIONS.some((option) => option.value === value)
    ? (value as PrivacyLevel)
    : fallback;
}

export function normalizeCommentPrivacy(
  value: unknown,
  fallback: CommentPrivacyLevel = "public"
): CommentPrivacyLevel {
  return COMMENT_PRIVACY_OPTIONS.some((option) => option.value === value)
    ? (value as CommentPrivacyLevel)
    : fallback;
}

export function getUserHandles(
  userEmail?: string | null,
  displayName?: string | null,
  aliases?: string[]
) {
  const handles = new Set<string>();
  if (displayName) handles.add(displayName);
  if (userEmail) handles.add(userEmail.split("@")[0]);
  (aliases || []).forEach((alias) => alias && handles.add(alias));
  return handles;
}

export function canViewPost(
  post: Post,
  userHandles: Set<string>,
  friends: FriendNode[] = []
): boolean {
  const privacy = normalizePrivacy(post.privacy, "public");
  if (privacy === "public") return true;
  if (userHandles.has(post.author)) return true;
  if (privacy === "friends") {
    return friends.some((friend) => friend.handle === post.author);
  }
  return false;
}

export function canViewComment(
  comment: Comment,
  post: Post,
  userHandles: Set<string>,
  friends: FriendNode[] = []
): boolean {
  const privacy = normalizeCommentPrivacy(comment.privacy, "public");
  if (privacy === "poster") {
    return userHandles.has(post.author) || userHandles.has(comment.author);
  }
  if (privacy === "public") return true;
  if (userHandles.has(comment.author) || userHandles.has(post.author)) return true;
  if (privacy === "friends") {
    return friends.some((friend) => friend.handle === comment.author);
  }
  return false;
}

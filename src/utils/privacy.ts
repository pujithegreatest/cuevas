import { Comment, CommentPrivacyLevel, Post, PrivacyLevel } from "../types/feed";
import type { FriendNode } from "../state/appStore";
import { normalizeHandle } from "./handles";

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
  if (displayName) {
    handles.add(displayName);
    handles.add(normalizeHandle(displayName));
  }
  if (userEmail) {
    handles.add(userEmail);
    handles.add(userEmail.toLowerCase());
    const local = userEmail.split("@")[0];
    handles.add(local);
    handles.add(normalizeHandle(local));
  }
  (aliases || []).forEach((alias) => {
    if (!alias) return;
    handles.add(alias);
    handles.add(normalizeHandle(alias));
  });
  return handles;
}

export function canViewPost(
  post: Post,
  userHandles: Set<string>,
  friends: FriendNode[] = []
): boolean {
  const privacy = normalizePrivacy(post.privacy, "public");
  if (privacy === "public") return true;
  if (post.authorEmail) {
    const postEmail = post.authorEmail.toLowerCase();
    if (userHandles.has(post.authorEmail) || userHandles.has(postEmail)) return true;
  }
  if (userHandles.has(post.author)) return true;
  const normalizedAuthor = normalizeHandle(post.author, "");
  if (normalizedAuthor && userHandles.has(normalizedAuthor)) return true;
  if (privacy === "friends") {
    return friends.some(
      (friend) => normalizeHandle(friend.handle, "") === normalizedAuthor
    );
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
    return (
      userHandles.has(post.author) ||
      userHandles.has(comment.author) ||
      (!!post.authorEmail && userHandles.has(post.authorEmail.toLowerCase())) ||
      (!!comment.authorEmail && userHandles.has(comment.authorEmail.toLowerCase()))
    );
  }
  if (privacy === "public") return true;
  if (post.authorEmail && userHandles.has(post.authorEmail.toLowerCase())) return true;
  if (comment.authorEmail && userHandles.has(comment.authorEmail.toLowerCase())) return true;
  if (userHandles.has(comment.author) || userHandles.has(post.author)) return true;
  const normalizedCommentAuthor = normalizeHandle(comment.author, "");
  const normalizedPostAuthor = normalizeHandle(post.author, "");
  if (
    (normalizedCommentAuthor && userHandles.has(normalizedCommentAuthor)) ||
    (normalizedPostAuthor && userHandles.has(normalizedPostAuthor))
  ) {
    return true;
  }
  if (privacy === "friends") {
    return friends.some(
      (friend) => normalizeHandle(friend.handle, "") === normalizedCommentAuthor
    );
  }
  return false;
}

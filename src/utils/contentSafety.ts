export const OBJECTIONABLE_CONTENT_MESSAGE =
  "Cuevas filters objectionable material from being posted. Please edit this before sharing.";

const SAFETY_PATTERNS: RegExp[] = [
  /\b(csam|child\s*(sexual\s*)?(abuse|exploitation|porn|pornography)|grooming|sextortion)\b/i,
  /\b(underage|minor)\s+(nudes?|sex|sexual|explicit|porn|pornography)\b/i,
  /\b(kill\s+(yourself|urself)|kys)\b/i,
  /\b(kill|murder|shoot|stab|rape)\s+(you|u|him|her|them)\b/i,
  /\b(bomb|shoot\s+up)\s+(a\s+)?(school|church|mosque|synagogue|mall|event|building)\b/i,
  /\b(doxx?|swat)\s+(you|u|him|her|them)\b/i,
];

const MAX_LINKS_PER_TEXT_SUBMISSION = 2;

function flattenText(input: string | Array<string | null | undefined> | null | undefined) {
  if (Array.isArray(input)) {
    return input.filter(Boolean).join(" ");
  }
  return input || "";
}

export function getObjectionableContentMessage(
  input: string | Array<string | null | undefined> | null | undefined
) {
  const text = flattenText(input).trim();
  if (!text) return null;

  const linkMatches = text.match(/(?:https?:\/\/|www\.)/gi) || [];
  if (linkMatches.length > MAX_LINKS_PER_TEXT_SUBMISSION) {
    return "Cuevas filters spam and objectionable material from being posted. Please edit this before sharing.";
  }

  return SAFETY_PATTERNS.some((pattern) => pattern.test(text))
    ? OBJECTIONABLE_CONTENT_MESSAGE
    : null;
}

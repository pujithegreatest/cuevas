import { ModerationContentType } from "../state/appStore";

const CUEVAS_CLIENT_KEY = "ecothot-super-secret-9384fjksd";
const REPORT_API = "https://www.ecothot.com/_functions/contentReport";

export const REPORT_REASONS = [
  "Spam or scam",
  "Harassment or bullying",
  "Hate or abusive content",
  "Nudity or sexual content",
  "Violence or dangerous content",
  "False or misleading information",
  "Other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

interface SubmitModerationReportInput {
  targetHandle: string;
  contentType: ModerationContentType;
  contentId?: string;
  reason: string;
  reporterEmail?: string | null;
  contentPreview?: string | null;
}

export async function submitModerationReport(input: SubmitModerationReportInput) {
  const res = await fetch(REPORT_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      clientKey: CUEVAS_CLIENT_KEY,
      ...input,
    }),
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    if (!res.ok) throw new Error(text || `Report failed (${res.status})`);
  }

  if (!res.ok || !json?.success) {
    throw new Error(json?.error || text || `Report failed (${res.status})`);
  }
  return json;
}

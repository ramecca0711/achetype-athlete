/**
 * Shared formatting and calculation utilities used across multiple pages.
 */

/**
 * Calculate age from a birth date string (YYYY-MM-DD).
 * Returns null if the date is missing or invalid.
 */
export function calculateAge(birthDateRaw: string | null | undefined): number | null {
  if (!birthDateRaw) return null;
  const parsed = new Date(`${birthDateRaw}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const today = new Date();
  return Math.max(
    0,
    today.getFullYear() -
      parsed.getFullYear() -
      (today.getMonth() < parsed.getMonth() ||
      (today.getMonth() === parsed.getMonth() && today.getDate() < parsed.getDate())
        ? 1
        : 0)
  );
}

/**
 * Human-readable label for a 1–5 feedback score.
 */
export function feedbackScoreLabel(score: number | null | undefined): string {
  if (score === 5) return "There";
  if (score === 4) return "Almost there";
  if (score === 3) return "Getting closer";
  if (score === 2) return "Needs work";
  if (score === 1) return "Not quite";
  return "Not set";
}

/**
 * Maps review_request_videos position codes (101/102/103) to named keys.
 */
export function buildPhotoPositionMap(
  videos: { position: number; video_url: string }[]
): Map<"top" | "middle" | "bottom", string> {
  const map = new Map<"top" | "middle" | "bottom", string>();
  for (const v of videos) {
    if (v.position === 101) map.set("top", v.video_url);
    if (v.position === 102) map.set("middle", v.video_url);
    if (v.position === 103) map.set("bottom", v.video_url);
  }
  return map;
}

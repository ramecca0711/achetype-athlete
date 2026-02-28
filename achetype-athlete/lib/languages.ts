/**
 * AUTO-DOC: File overview
 * Purpose: Shared utility/helper module used by pages and components.
 * Related pages/files:
 * - Internal module with no static import map match.
 * Note: Update related files together when changing data shape or shared behavior.
 */
// Curated language options for the MVP language selectors.
export const LANGUAGE_OPTIONS = [
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "pt-BR", label: "Portuguese (Brazil)" },
  { code: "pt-PT", label: "Portuguese (Portugal)" },
  { code: "es-ES", label: "Spanish" },
  { code: "fr-FR", label: "French" },
  { code: "de-DE", label: "German" },
  { code: "it-IT", label: "Italian" },
  { code: "ja-JP", label: "Japanese" },
  { code: "ko-KR", label: "Korean" },
  { code: "zh-CN", label: "Chinese (Simplified)" }
] as const;

// Converts a language code into a readable fallback label.
export function languageLabel(code: string) {
  const found = LANGUAGE_OPTIONS.find((item) => item.code === code);
  return found?.label ?? code;
}

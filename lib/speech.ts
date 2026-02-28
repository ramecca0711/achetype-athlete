/**
 * AUTO-DOC: File overview
 * Purpose: Shared utility/helper module used by pages and components.
 * Related pages/files:
 * - Internal module with no static import map match.
 * Note: Update related files together when changing data shape or shared behavior.
 */
// Speaks text using the browser Speech Synthesis API.
export function speakText(text: string, langCode: string) {
  // Guard for non-browser rendering contexts.
  if (typeof window === "undefined") return;
  if (!("speechSynthesis" in window)) return;
  if (!text.trim()) return;

  const utterance = new SpeechSynthesisUtterance(text);
  const normalizedCode = langCode.toLowerCase();
  const voices = window.speechSynthesis.getVoices();

  // Prefer a voice that starts with the chosen language code (ex: "pt-BR").
  const matchedVoice = voices.find((voice) =>
    voice.lang.toLowerCase().startsWith(normalizedCode.split("-")[0])
  );

  if (matchedVoice) {
    utterance.voice = matchedVoice;
    utterance.lang = matchedVoice.lang;
  } else {
    utterance.lang = langCode;
  }

  utterance.rate = 0.96;

  // Cancel active speech first so repeated clicks feel responsive.
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

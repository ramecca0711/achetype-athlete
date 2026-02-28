/**
 * AUTO-DOC: File overview
 * Purpose: Shared utility/helper module used by pages and components.
 * Related pages/files:
 * - `app/athlete/page.tsx`
 * - `app/coach/review-log/page.tsx`
 * - `components/archetype-approval-form.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
export type ArchetypeKind = "V" | "A" | "H";

export function suggestArchetypeFromRatio(
  shoulderWidth: number,
  hipWidth: number,
  tolerance = 0.05
): { archetype: ArchetypeKind; ratio: number } {
  const ratio = shoulderWidth / hipWidth;
  if (Math.abs(ratio - 1) <= tolerance) return { archetype: "H", ratio };
  if (shoulderWidth > hipWidth) return { archetype: "V", ratio };
  return { archetype: "A", ratio };
}

export function inferArchetype(shoulderWidth: number, hipWidth: number): {
  archetype: ArchetypeKind;
  confidence: number;
  ratio: number;
} {
  const ratio = shoulderWidth / hipWidth;

  if (ratio >= 1.08) {
    return { archetype: "V", confidence: Math.min(0.99, 0.65 + (ratio - 1.08)), ratio };
  }

  if (ratio <= 0.92) {
    return { archetype: "A", confidence: Math.min(0.99, 0.65 + (0.92 - ratio)), ratio };
  }

  return { archetype: "H", confidence: 0.7 + (0.08 - Math.abs(1 - ratio)), ratio };
}

export function archetypeSummary(kind: ArchetypeKind): string {
  if (kind === "V") {
    return "Shoulders are wider than hips. Prioritize shoulder stability and lower-chain symmetry.";
  }

  if (kind === "A") {
    return "Hips are wider than shoulders. Prioritize upper-back strength and trunk control.";
  }

  return "Shoulders and hips are proportionally similar. Prioritize balanced strength progression.";
}

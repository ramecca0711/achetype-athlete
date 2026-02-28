/**
 * AUTO-DOC: File overview
 * Purpose: Shared utility/helper module used by pages and components.
 * Related pages/files:
 * - `app/athlete/day/[dayId]/page.tsx`
 * - `app/layout.tsx`
 * - `components/request-review-form.tsx`
 * - `components/right-sidebar.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
export type AppRole = "athlete" | "coach" | "admin";

export type SubmissionStatus = "pending_review" | "not_quite" | "almost_there" | "there";

export type ConfidenceScore = 1 | 2 | 3 | 4 | 5;

export const confidencePhrases: Record<ConfidenceScore, string> = {
  1: "Need help",
  2: "Unsure",
  3: "Decent",
  4: "Solid",
  5: "Locked in"
};

export const statusLabel: Record<SubmissionStatus, string> = {
  pending_review: "Pending Review",
  not_quite: "Not Quite",
  almost_there: "Almost There",
  there: "There"
};

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  member_since: string;
  injuries: string | null;
  imbalances: string | null;
  goals: string[];
  archetype_ai: string | null;
  archetype_final: string | null;
  archetype_confidence: number | null;
  shoulder_width: number | null;
  hip_width: number | null;
  archetype_notes: string | null;
  onboarding_completed?: boolean;
  posture_photos_required?: boolean;
  training_experience?: string | null;
  weekly_training_days?: number | null;
  intro_survey_notes?: string | null;
  created_at: string;
  updated_at: string;
};

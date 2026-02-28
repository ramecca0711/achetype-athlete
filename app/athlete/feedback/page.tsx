/**
 * AUTO-DOC: File overview
 * Purpose: Next.js route page for `/athlete/feedback`.
 * Related pages/files:
 * - `lib/supabase/server.ts`
 * - `app/layout.tsx`
 * - `components/right-sidebar.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function AthleteFeedbackPage() {
  const supabase = createSupabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const cookieStore = await cookies();
  const scopedAthleteId = me?.role === "admin" ? cookieStore.get("admin_view_athlete_id")?.value || "" : user.id;
  if (me?.role === "admin" && !scopedAthleteId) redirect("/admin");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", scopedAthleteId).maybeSingle();
  if (profile?.role !== "athlete" && me?.role !== "admin") redirect("/");
  const feedbackScoreLabel = (score: number | null | undefined) => {
    if (score === 5) return "There";
    if (score === 4) return "Almost there";
    if (score === 3) return "Getting closer";
    if (score === 2) return "Needs work";
    if (score === 1) return "Not quite";
    return "Not set";
  };

  const { data: requests } = await supabase
    .from("review_requests")
    .select(
      `
      id,
      confidence_score,
      notes,
      feedback_text,
      feedback_score,
      quick_notes,
      created_at,
      exercise:exercises(name),
      resolutions:feedback_video_resolutions(feedback_video:coach_feedback_videos(loom_url, transcript_summary))
    `
    )
    .eq("athlete_id", scopedAthleteId)
    .eq("status", "resolved")
    .order("created_at", { ascending: false });

  const { data: feedbackRows } = await supabase
    .from("exercise_feedback_log")
    .select("exercise_id, client_name, feedback_date, feedback_text, exercise:exercises(name)")
    .order("feedback_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  const latestFeedbackByExerciseName = new Map<string, { text: string; client: string; date: string }>();
  for (const row of feedbackRows ?? []) {
    const exercise = Array.isArray(row.exercise) ? row.exercise[0] : row.exercise;
    const key = String(exercise?.name ?? "").trim().toLowerCase();
    if (!key || latestFeedbackByExerciseName.has(key)) continue;
    latestFeedbackByExerciseName.set(key, {
      text: row.feedback_text,
      client: row.client_name,
      date: row.feedback_date
    });
  }
  const importedRows = feedbackRows ?? [];

  return (
    <main className="shell space-y-4">
      <section className="card p-6">
        <p className="badge inline-block">Athlete - Your Feedback</p>
        <h1 className="text-3xl mt-3">Your Feedback Log</h1>
      </section>

      {!!importedRows.length && (
        <section className="card p-6">
          <h2 className="text-xl">Previous Feedback</h2>
          <div className="space-y-2 mt-3">
            {importedRows.slice(0, 50).map((row: any, index: number) => {
              const exercise = Array.isArray(row.exercise) ? row.exercise[0] : row.exercise;
              return (
                <details key={`imported-${row.exercise_id}-${row.feedback_date}-${index}`} className="card p-6" open={false}>
                  <summary className="cursor-pointer list-none">
                    <div className="flex gap-2 flex-wrap items-center">
                      <span className="font-semibold">{exercise?.name ?? "Exercise"}</span>
                      <span className="badge">Status reviewed</span>
                      <span className="badge">Confidence Missing</span>
                    </div>
                  </summary>
                  <div className="mt-3">
                    <p className="text-sm mt-2">
                      <span className="font-semibold">Most recent feedback:</span>{" "}
                      {row.feedback_text?.trim() ? row.feedback_text : <span className="text-red-700">Missing</span>}
                    </p>
                    <p className="text-sm mt-1">
                      <span className="font-semibold">Feedback source:</span>{" "}
                      {row.client_name ? `${row.client_name} (${row.feedback_date})` : <span className="text-red-700">Missing</span>}
                    </p>
                    <p className="text-sm mt-1"><span className="font-semibold">Your note:</span> <span className="text-red-700">Missing</span></p>
                    <p className="text-sm mt-1"><span className="font-semibold">Quick notes:</span> <span className="text-red-700">Missing</span></p>
                    <p className="text-sm mt-1"><span className="font-semibold">Feedback score:</span> <span className="text-red-700">Missing</span></p>
                    <p className="text-sm mt-1"><span className="font-semibold">Loom feedback video:</span> <span className="text-red-700">Missing</span></p>
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      )}

      {!importedRows.length && (
        <>
          <section className="card p-6">
            <p className="meta">No feedback yet. Submit a request review first.</p>
          </section>
        </>
      )}
    </main>
  );
}

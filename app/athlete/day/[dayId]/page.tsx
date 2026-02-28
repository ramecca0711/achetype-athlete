/**
 * AUTO-DOC: File overview
 * Purpose: Next.js route page for `/athlete/day/[dayId]`.
 * Related pages/files:
 * - `lib/supabase/server.ts`
 * - `lib/types.ts`
 * - `app/layout.tsx`
 * - `components/right-sidebar.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { confidencePhrases, statusLabel } from "@/lib/types";

type DayPageProps = {
  params: { dayId: string };
};

export default async function AthleteDayPage({ params }: DayPageProps) {
  const supabase = createSupabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  const cookieStore = await cookies();
  const scopedAthleteId = profile?.role === "admin" ? cookieStore.get("admin_view_athlete_id")?.value || "" : user.id;
  if (profile?.role === "admin" && !scopedAthleteId) redirect("/admin");

  const { data: scopedProfile } = await supabase
    .from("profiles")
    .select("role, onboarding_completed")
    .eq("id", scopedAthleteId)
    .maybeSingle();

  if (scopedProfile?.role !== "athlete" && profile?.role !== "admin") {
    redirect("/");
  }

  if (!scopedProfile?.onboarding_completed) {
    redirect("/onboarding");
  }

  async function submitExercise(formData: FormData) {
    "use server";

    const sb = createSupabaseServer();
    const {
      data: { user: actionUser }
    } = await sb.auth.getUser();

    if (!actionUser) {
      redirect("/login");
    }
    const { data: actionProfile } = await sb.from("profiles").select("role").eq("id", actionUser.id).maybeSingle();
    const actionCookies = await cookies();
    const targetAthleteId =
      actionProfile?.role === "admin" ? actionCookies.get("admin_view_athlete_id")?.value || "" : actionUser.id;
    if (!targetAthleteId) redirect("/admin");

    const pdeId = String(formData.get("program_day_exercise_id") ?? "");
    const repsRaw = String(formData.get("reps_completed") ?? "").trim();
    const weightRaw = String(formData.get("weight_lbs") ?? "").trim();
    const timeRaw = String(formData.get("time_seconds") ?? "").trim();

    await sb.from("exercise_submissions").insert({
      athlete_id: targetAthleteId,
      program_day_exercise_id: pdeId,
      reps_completed: repsRaw ? Number(repsRaw) : null,
      weight_lbs: weightRaw ? Number(weightRaw) : null,
      time_seconds: timeRaw ? Number(timeRaw) : null,
      confidence_score: Number(formData.get("confidence_score") ?? 3),
      athlete_note: String(formData.get("athlete_note") ?? "") || null,
      ai_note_suggestion: String(formData.get("ai_note_suggestion") ?? "") || null,
      athlete_approved_note: formData.get("athlete_approved_note") === "on",
      loom_url: String(formData.get("loom_url") ?? "") || null
    });

    revalidatePath(`/athlete/day/${params.dayId}`);
    revalidatePath("/coach/queue");
  }

  const { data: day } = await supabase
    .from("program_days")
    .select("id, day_index, title, notes, program_id")
    .eq("id", params.dayId)
    .maybeSingle();

  if (!day) notFound();

  const { data: program } = await supabase
    .from("programs")
    .select("id, athlete_id")
    .eq("id", day.program_id)
    .eq("athlete_id", scopedAthleteId)
    .maybeSingle();

  if (!program) notFound();

  const { data: rows } = await supabase
    .from("program_day_exercises")
    .select(
      `
      id,
      position,
      set_count,
      rep_target,
      weight_target_lbs,
      time_target_seconds,
      focus,
      personal_notes,
      dos,
      donts,
      prescription,
      exercise:exercises(name, exercise_group, purpose_impact, where_to_feel, sample_video_url, gunther_video_url)
    `
    )
    .eq("program_day_id", day.id)
    .order("position", { ascending: true });

  const pdeIds = (rows ?? []).map((r) => r.id);
  const { data: submissions } = pdeIds.length
    ? await supabase
        .from("exercise_submissions")
        .select(
          `
          id,
          program_day_exercise_id,
          reps_completed,
          weight_lbs,
          time_seconds,
          confidence_score,
          athlete_note,
          status,
          loom_url,
          submitted_at,
          feedback:coach_feedback(high_level_feedback, created_at)
        `
        )
        .eq("athlete_id", scopedAthleteId)
        .in("program_day_exercise_id", pdeIds)
        .order("submitted_at", { ascending: false })
    : { data: [] as any[] };

  return (
    <main className="shell space-y-4">
      <section className="card p-6">
        <h1 className="text-4xl">Day {day.day_index}: {day.title}</h1>
        {day.notes && <p className="meta mt-2">{day.notes}</p>}
      </section>

      {(rows ?? []).map((row) => {
        const exercise = Array.isArray(row.exercise) ? row.exercise[0] : row.exercise;
        const history = (submissions ?? []).filter((item) => item.program_day_exercise_id === row.id);
        const isTime = row.prescription === "time";
        const isMixed = row.prescription === "mixed";

        return (
          <section key={row.id} className="card p-6">
            <div className="flex gap-2 flex-wrap">
              <span className="badge">Exercise {row.position}</span>
              <span className="badge">{row.prescription}</span>
              <span className="badge">{exercise?.exercise_group ?? "General"}</span>
            </div>
            <h2 className="text-3xl mt-3">{exercise?.name}</h2>
            <div className="grid md:grid-cols-4 gap-2 mt-3 text-sm">
              <div className="metric"><p className="meta">Sets</p><p className="font-semibold">{row.set_count ?? "-"}</p></div>
              <div className="metric"><p className="meta">Reps</p><p className="font-semibold">{row.rep_target ?? "-"}</p></div>
              <div className="metric"><p className="meta">Weight</p><p className="font-semibold">{row.weight_target_lbs ?? "-"}</p></div>
              <div className="metric"><p className="meta">Time</p><p className="font-semibold">{row.time_target_seconds ?? "-"}</p></div>
            </div>
            <p className="text-sm mt-3"><span className="font-semibold">Focus:</span> {row.focus ?? "-"}</p>
            <p className="text-sm mt-1"><span className="font-semibold">Purpose/Impact:</span> {exercise?.purpose_impact ?? "-"}</p>
            <p className="text-sm mt-1"><span className="font-semibold">Where to feel:</span> {exercise?.where_to_feel ?? "-"}</p>
            <p className="text-sm mt-1"><span className="font-semibold">Do:</span> {row.dos ?? "-"}</p>
            <p className="text-sm mt-1"><span className="font-semibold">Don&apos;t:</span> {row.donts ?? "-"}</p>
            <p className="text-sm mt-1"><span className="font-semibold">Personal notes:</span> {row.personal_notes ?? "-"}</p>

            <form action={submitExercise} className="mt-4 border rounded-xl p-4 bg-white">
              <input type="hidden" name="program_day_exercise_id" value={row.id} />
              <h3 className="text-xl">Submit Video + Notes</h3>
              <p className="text-sm meta mt-1">
                Smart guidance only: fill the fields that match this exercise prescription.
              </p>

              <div className="grid md:grid-cols-3 gap-3 mt-3">
                <label className="text-sm">
                  Reps Completed {(isTime && !isMixed) ? "(usually optional)" : "(recommended)"}
                  <input className="input mt-1" type="number" name="reps_completed" />
                </label>
                <label className="text-sm">
                  Weight (lbs) {(isTime && !isMixed) ? "(usually optional)" : "(recommended)"}
                  <input className="input mt-1" type="number" step="0.1" name="weight_lbs" />
                </label>
                <label className="text-sm">
                  Time (seconds) {(isTime || isMixed) ? "(recommended)" : "(usually optional)"}
                  <input className="input mt-1" type="number" name="time_seconds" />
                </label>
              </div>

              <label className="text-sm block mt-3">
                Confidence Score (1-5)
                <select className="select mt-1" name="confidence_score" defaultValue="3">
                  {Object.entries(confidencePhrases).map(([score, phrase]) => (
                    <option key={score} value={score}>
                      {score} - {phrase}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm block mt-3">
                Loom Link
                <input className="input mt-1" type="url" name="loom_url" placeholder="https://www.loom.com/share/..." />
              </label>

              <label className="text-sm block mt-3">
                Your Note
                <textarea className="textarea mt-1" name="athlete_note" />
              </label>
              <label className="text-sm block mt-3">
                Bot Suggested Note (editable)
                <textarea className="textarea mt-1" name="ai_note_suggestion" />
              </label>
              <label className="text-sm mt-2 inline-flex items-center gap-2">
                <input type="checkbox" name="athlete_approved_note" /> Approve bot note for submission
              </label>

              <button type="submit" className="btn btn-primary mt-4">
                Submit to Gunther Queue
              </button>
            </form>

            <div className="mt-4">
              <h3 className="text-xl">Past Submissions</h3>
              {!history.length && <p className="meta mt-2">No submissions yet.</p>}
              <div className="space-y-2 mt-2">
                {history.map((item) => (
                  <details key={item.id} className={`border rounded-xl p-3 status-${item.status}`} open={false}>
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-wrap gap-2 items-center text-sm">
                        <span className="badge">
                          {statusLabel[(item.status ?? "pending_review") as keyof typeof statusLabel]}
                        </span>
                        <span className="badge">
                          {item.confidence_score} - {confidencePhrases[(item.confidence_score ?? 3) as 1 | 2 | 3 | 4 | 5]}
                        </span>
                        <span className="badge">{new Date(item.submitted_at).toLocaleDateString()}</span>
                      </div>
                    </summary>
                    <div className="mt-2">
                      <p className="text-sm">
                        Reps: {item.reps_completed ?? "-"} | Weight: {item.weight_lbs ?? "-"} | Time: {item.time_seconds ?? "-"}
                      </p>
                      {!!item.loom_url && (
                        <a href={item.loom_url} target="_blank" className="text-blue-700 underline text-sm mt-1 inline-block">
                          Open Link
                        </a>
                      )}
                      {item.feedback?.[0] && (
                        <p className="text-sm mt-1"><span className="font-semibold">Most recent feedback:</span> {item.feedback[0].high_level_feedback}</p>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </main>
  );
}

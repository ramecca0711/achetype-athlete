/**
 * AUTO-DOC: File overview
 * Purpose: Next.js route page for `/coach/new-loom-upload`.
 * Related pages/files:
 * - `lib/supabase/server.ts`
 * - `components/loom-resolution-selector.tsx`
 * - `lib/loom.ts`
 * - `app/layout.tsx`
 * - `components/right-sidebar.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";
import LoomResolutionSelector from "@/components/loom-resolution-selector";
import { fetchLoomTranscriptSummary } from "@/lib/loom";

export default async function CoachNewLoomUploadPage() {
  const supabase = createSupabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "coach" && me?.role !== "admin") redirect("/");
  const cookieStore = await cookies();
  const scopedCoachId = me?.role === "admin" ? cookieStore.get("admin_view_coach_id")?.value || "" : user.id;
  if (me?.role === "admin" && !scopedCoachId) redirect("/admin");

  async function uploadFeedbackVideo(formData: FormData) {
    "use server";
    const sb = createSupabaseServer();
    const {
      data: { user: actionUser }
    } = await sb.auth.getUser();
    if (!actionUser) redirect("/login");
    const { data: actionMe } = await sb.from("profiles").select("role").eq("id", actionUser.id).maybeSingle();
    const actionCookies = await cookies();
    const targetCoachId =
      actionMe?.role === "admin" ? actionCookies.get("admin_view_coach_id")?.value || "" : actionUser.id;
    if (!targetCoachId) redirect("/admin");

    const loomUrl = String(formData.get("loom_url") ?? "").trim();
    const reviewRequestIds = formData
      .getAll("review_request_ids")
      .map((value) => String(value).trim())
      .filter(Boolean);

    if (!loomUrl || !reviewRequestIds.length) {
      redirect("/coach/new-loom-upload");
    }

    const summary = await fetchLoomTranscriptSummary(loomUrl);

    const { data: video } = await sb
      .from("coach_feedback_videos")
      .insert({
        coach_id: targetCoachId,
        loom_url: loomUrl,
        transcript_summary:
          summary ?? "Transcript unavailable automatically. Add transcript integration token or paste summary later."
      })
      .select("id")
      .single();

    if (!video?.id) {
      redirect("/coach/new-loom-upload");
    }

    await sb.from("feedback_video_resolutions").insert(
      reviewRequestIds.map((requestId) => ({
        feedback_video_id: video.id,
        review_request_id: requestId
      }))
    );

    await sb
      .from("review_requests")
      .update({ status: "resolved" })
      .in("id", reviewRequestIds)
      .eq("coach_id", targetCoachId);

    const { data: resolvedRows } = await sb
      .from("review_requests")
      .select("athlete_id, exercise:exercises(name)")
      .in("id", reviewRequestIds)
      .eq("coach_id", targetCoachId);

    const athleteIds = Array.from(new Set((resolvedRows ?? []).map((row: any) => row.athlete_id).filter(Boolean)));
    const { data: athleteProfiles } = athleteIds.length
      ? await sb
          .from("profiles")
          .select("id, full_name, share_feedback_publicly")
          .in("id", athleteIds)
      : { data: [] as any[] };
    const publicAthletes = new Map(
      (athleteProfiles ?? [])
        .filter((p: any) => p.share_feedback_publicly)
        .map((p: any) => [p.id, p.full_name ?? "Athlete"])
    );

    if (publicAthletes.size) {
      const exercisesByAthlete = new Map<string, Set<string>>();
      for (const row of resolvedRows ?? []) {
        if (!publicAthletes.has(row.athlete_id)) continue;
        const exercise = Array.isArray(row.exercise) ? row.exercise[0] : row.exercise;
        const name = String(exercise?.name ?? "").trim();
        const set = exercisesByAthlete.get(row.athlete_id) ?? new Set<string>();
        if (name) set.add(name);
        exercisesByAthlete.set(row.athlete_id, set);
      }

      const boardRows = Array.from(publicAthletes.entries()).map(([athleteId, fullName]) => ({
        sender_id: targetCoachId,
        athlete_id: athleteId,
        message_type: "loom_posted",
        message_text: `New Loom feedback posted for ${fullName}.`,
        loom_url: loomUrl,
        reviewed_exercises: Array.from(exercisesByAthlete.get(athleteId) ?? [])
      }));

      if (boardRows.length) {
        await sb.from("public_review_board_messages").insert(boardRows);
      }
    }

    redirect("/coach/new-loom-upload");
  }

  const { data: openRequests } = await supabase
    .from("review_requests")
    .select(
      "id, athlete_id, created_at, athlete:profiles!review_requests_athlete_id_fkey(full_name), exercise:exercises(name)"
    )
    .eq("coach_id", scopedCoachId)
    .neq("status", "resolved")
    .order("created_at", { ascending: false });

  const athletes = Array.from(
    new Map(
      (openRequests ?? []).map((request: any) => {
        const athlete = Array.isArray(request.athlete) ? request.athlete[0] : request.athlete;
        return [request.athlete_id, { id: request.athlete_id, full_name: athlete?.full_name ?? "Athlete" }];
      })
    ).values()
  );

  const requests = (openRequests ?? []).map((request: any) => {
    const exercise = Array.isArray(request.exercise) ? request.exercise[0] : request.exercise;
    return {
      id: request.id,
      athlete_id: request.athlete_id,
      exercise_name: exercise?.name ?? "Exercise",
      created_at: request.created_at
    };
  });

  return (
    <main className="shell space-y-4">
      <section className="card p-6">
        <p className="badge inline-block">Coach - New Loom Video Upload</p>
        <h1 className="text-3xl mt-3">Upload Coach Feedback Video</h1>
      </section>

      <section className="card p-6">
        <form action={uploadFeedbackVideo} className="space-y-4">
          <label className="text-sm block">
            Paste Loom Link
            <input className="input mt-1" name="loom_url" type="url" required />
          </label>

          <LoomResolutionSelector athletes={athletes} requests={requests} />

          <button className="btn btn-primary" type="submit">Submit</button>
        </form>
      </section>
    </main>
  );
}

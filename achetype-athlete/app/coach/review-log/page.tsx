/**
 * AUTO-DOC: File overview
 * Purpose: Next.js route page for `/coach/review-log`.
 * Related pages/files:
 * - `lib/supabase/server.ts`
 * - `components/archetype-approval-form.tsx`
 * - `lib/archetype.ts`
 * - `lib/loom.ts`
 * - `components/timestamp-frame-preview.tsx`
 * - `app/layout.tsx`
 * - `components/right-sidebar.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";
import ArchetypeApprovalForm from "@/components/archetype-approval-form";
import { ArchetypeKind, archetypeSummary, inferArchetype, suggestArchetypeFromRatio } from "@/lib/archetype";
import { fetchLoomTranscriptSummary } from "@/lib/loom";
import TimestampFramePreview from "@/components/timestamp-frame-preview";

export default async function CoachReviewLogPage({
  searchParams
}: {
  searchParams?: { updated?: string };
}) {
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
  const statusLabel = (value: string | null | undefined) => (value === "resolved" ? "reviewed" : "pending");
  const feedbackScoreLabel = (score: number | null | undefined) => {
    if (score === 5) return "There";
    if (score === 4) return "Almost there";
    if (score === 3) return "Getting closer";
    if (score === 2) return "Needs work";
    if (score === 1) return "Not quite";
    return "Not set";
  };

  async function approveArchetype(formData: FormData) {
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

    const athleteId = String(formData.get("athlete_id") ?? "");
    const shoulderWidth = Number(formData.get("shoulder_width") ?? 0);
    const hipWidth = Number(formData.get("hip_width") ?? 0);
    const postureFeedbackLoomUrl = String(formData.get("posture_feedback_loom_url") ?? "").trim();
    const selectedFinal = String(formData.get("archetype_final") ?? "").trim().toUpperCase();
    const allowed = new Set<ArchetypeKind>(["V", "A", "H"]);
    if (!athleteId || shoulderWidth <= 0 || hipWidth <= 0) {
      redirect("/coach/review-log");
    }
    const finalArchetype: ArchetypeKind = allowed.has(selectedFinal as ArchetypeKind)
      ? (selectedFinal as ArchetypeKind)
      : suggestArchetypeFromRatio(shoulderWidth, hipWidth).archetype;

    const [{ data: profile }, { count: photoCount }] = await Promise.all([
      sb
        .from("profiles")
        .select("id, onboarding_completed, archetype_approved_at")
        .eq("id", athleteId)
        .maybeSingle(),
      sb
        .from("posture_photos")
        .select("id", { count: "exact", head: true })
        .eq("athlete_id", athleteId)
    ]);

    // First-time-only approval, after join + first complete photo set.
    if (!profile?.onboarding_completed || !!profile?.archetype_approved_at || (photoCount ?? 0) < 4) {
      redirect("/coach/review-log");
    }

    const prediction = inferArchetype(shoulderWidth, hipWidth);
    const aiSuggestion = suggestArchetypeFromRatio(shoulderWidth, hipWidth);
    const postureFeedbackInsights = postureFeedbackLoomUrl
      ? await fetchLoomTranscriptSummary(postureFeedbackLoomUrl)
      : null;

    await sb
      .from("profiles")
      .update({
        shoulder_width: shoulderWidth,
        hip_width: hipWidth,
        archetype_ai: aiSuggestion.archetype,
        archetype_final: finalArchetype,
        archetype_confidence: prediction.confidence,
        archetype_notes: archetypeSummary(finalArchetype),
        archetype_approved_by: actionUser.id,
        archetype_approved_at: new Date().toISOString(),
        posture_feedback_loom_url: postureFeedbackLoomUrl || null,
        posture_feedback_insights: postureFeedbackLoomUrl
          ? postureFeedbackInsights ?? "Transcript unavailable automatically. Coach can edit insights in Client Profiles."
          : null
      })
      .eq("id", athleteId);

    redirect("/coach/review-log");
  }

  async function updateRequest(formData: FormData) {
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

    const requestId = String(formData.get("request_id") ?? "");
    await sb
      .from("review_requests")
      .update({
        feedback_score: Number(formData.get("feedback_score") ?? 0) || null,
        quick_notes: String(formData.get("quick_notes") ?? "") || null,
        feedback_text: String(formData.get("feedback_text") ?? "") || null
      })
      .eq("id", requestId)
      .eq("coach_id", targetCoachId);

    redirect(`/coach/review-log?updated=${requestId}`);
  }

  const [{ data: requests }, { data: candidateProfiles }, { data: relationships }] = await Promise.all([
    supabase
      .from("review_requests")
      .select(
        `
        id,
        exercise_id,
        confidence_score,
        status,
        notes,
        submission_video_url,
        ts_top_seconds,
        ts_middle_seconds,
        ts_bottom_seconds,
        feedback_score,
        quick_notes,
        feedback_text,
        created_at,
        athlete:profiles!review_requests_athlete_id_fkey(full_name),
        exercise:exercises(name),
        videos:review_request_videos(video_url, position, duration_seconds)
      `
      )
      .eq("coach_id", scopedCoachId)
      .eq("status", "pending")
      .order("confidence_score", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, onboarding_completed, archetype_approved_at, shoulder_width, hip_width, posture_feedback_loom_url")
      .is("archetype_approved_at", null)
      .eq("onboarding_completed", true),
    supabase
      .from("athlete_relationships")
      .select("athlete_id")
      .eq("coach_id", scopedCoachId)
  ]);

  const exerciseIds = Array.from(
    new Set((requests ?? []).map((request: any) => request.exercise_id).filter(Boolean))
  );
  const { data: repPhotos } = exerciseIds.length
    ? await supabase
        .from("exercise_rep_photos")
        .select("exercise_id, photo_position, image_url, created_at")
        .in("exercise_id", exerciseIds)
        .order("created_at", { ascending: false })
    : { data: [] as any[] };
  const samplePhotoByExerciseAndPosition = new Map<string, string>();
  for (const row of repPhotos ?? []) {
    const key = `${row.exercise_id}:${row.photo_position}`;
    if (!samplePhotoByExerciseAndPosition.has(key)) {
      samplePhotoByExerciseAndPosition.set(key, row.image_url);
    }
  }

  const relatedAthleteIds = new Set((relationships ?? []).map((row) => row.athlete_id));
  const filteredCandidates = (candidateProfiles ?? []).filter((candidate) => relatedAthleteIds.has(candidate.id));
  const candidateIds = filteredCandidates.map((candidate) => candidate.id);
  const { data: photoRows } = candidateIds.length
    ? await supabase
        .from("posture_photos")
        .select("athlete_id, id, photo_slot, photo_url")
        .in("athlete_id", candidateIds)
    : { data: [] as any[] };

  const photoCountByAthlete = new Map<string, number>();
  const photosByAthlete = new Map<string, Record<string, string>>();
  for (const row of photoRows ?? []) {
    photoCountByAthlete.set(row.athlete_id, (photoCountByAthlete.get(row.athlete_id) ?? 0) + 1);
    const photoSet = photosByAthlete.get(row.athlete_id) ?? {};
    photoSet[row.photo_slot] = row.photo_url;
    photosByAthlete.set(row.athlete_id, photoSet);
  }
  const archetypeCandidates = filteredCandidates.filter(
    (candidate) => (photoCountByAthlete.get(candidate.id) ?? 0) >= 4
  );
  const recentlyUpdatedId = searchParams?.updated ?? "";

  return (
    <main className="shell space-y-4">
      <section className="card p-6">
        <p className="badge inline-block">Coach - Review Log</p>
        <h1 className="text-3xl mt-3">Review Log</h1>
        <p className="meta mt-1">Ordered by confidence (lowest first).</p>
      </section>

      <section className="card p-6">
        <h2 className="text-2xl">Archetype First Approval</h2>
        <p className="meta mt-1">
          Separate from request reviews. Only available once after onboarding + first complete 4-photo upload.
        </p>
        <div className="space-y-3 mt-3">
          {archetypeCandidates.map((candidate) => (
            <ArchetypeApprovalForm
              key={candidate.id}
              athleteId={candidate.id}
              fullName={candidate.full_name}
              shoulderWidth={candidate.shoulder_width}
              hipWidth={candidate.hip_width}
              postureFeedbackLoomUrl={candidate.posture_feedback_loom_url}
              frontPhotoUrl={photosByAthlete.get(candidate.id)?.front}
              backPhotoUrl={photosByAthlete.get(candidate.id)?.back}
              photoCount={photoCountByAthlete.get(candidate.id) ?? 0}
              action={approveArchetype}
            />
          ))}
          {!archetypeCandidates.length && (
            <p className="meta">No first-time archetype approvals pending.</p>
          )}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-2xl">Video Review Requests</h2>
        <p className="meta mt-1">Exercise request queue with status, score, and feedback notes.</p>
      </section>

      {(requests ?? []).map((request: any) => {
        const athlete = Array.isArray(request.athlete) ? request.athlete[0] : request.athlete;
        const exercise = Array.isArray(request.exercise) ? request.exercise[0] : request.exercise;
        const requestVideos = Array.isArray(request.videos) ? request.videos : [];
        const requestPhotoByPosition = new Map<string, string>();
        for (const v of requestVideos) {
          if (v.position === 101) requestPhotoByPosition.set("top", v.video_url);
          if (v.position === 102) requestPhotoByPosition.set("middle", v.video_url);
          if (v.position === 103) requestPhotoByPosition.set("bottom", v.video_url);
        }
        return (
          <details key={request.id} className="card p-6" open={false}>
            <summary className="cursor-pointer list-none">
              <div className="flex gap-2 flex-wrap items-center">
                <span className="font-semibold">{athlete?.full_name ?? "Athlete"} - {exercise?.name ?? "Exercise"}</span>
                <span className="badge">Confidence {request.confidence_score}</span>
                <span className="badge">Status {statusLabel(request.status)}</span>
                <span className="badge">Feedback {feedbackScoreLabel(request.feedback_score)}</span>
                {recentlyUpdatedId === request.id && <span className="badge">✓ Saved</span>}
              </div>
            </summary>

            <div className="mt-3">
              <p className="text-sm">Video: {request.submission_video_url ? <a className="underline text-blue-700" href={request.submission_video_url} target="_blank">Open</a> : "-"}</p>
              {!!request.videos?.length && (
                <div className="mt-1 space-y-1">
                  {request.videos.map((video: any) => (
                    <p key={`${request.id}-${video.position}`} className="text-xs">
                      Video {video.position}: <a className="underline text-blue-700" href={video.video_url} target="_blank">Open</a> ({video.duration_seconds ?? "-"}s)
                    </p>
                  ))}
                </div>
              )}
              <p className="text-sm mt-1">Timestamps: top {request.ts_top_seconds ?? "-"}, middle {request.ts_middle_seconds ?? "-"}, bottom {request.ts_bottom_seconds ?? "-"}</p>
              {request.notes && <p className="text-sm mt-1">Request notes: {request.notes}</p>}
              <div className="mt-3 space-y-2">
                {([
                  { key: "top", timestamp: request.ts_top_seconds },
                  { key: "middle", timestamp: request.ts_middle_seconds },
                  { key: "bottom", timestamp: request.ts_bottom_seconds }
                ] as const).map((item) => {
                  const requestPhotoUrl = requestPhotoByPosition.get(item.key);
                  const samplePhotoUrl = samplePhotoByExerciseAndPosition.get(`${request.exercise_id}:${item.key}`);
                  return (
                    <div key={`${request.id}-${item.key}`} className="grid md:grid-cols-2 gap-2">
                      {requestPhotoUrl ? (
                        <div className="border rounded-lg p-2 bg-white">
                          <p className="text-xs meta">Athlete form photo ({item.key})</p>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={requestPhotoUrl} alt={`Athlete ${item.key}`} className="w-full h-32 object-contain rounded mt-1 bg-slate-50" />
                          <p className="text-xs mt-1">Timestamp: {typeof item.timestamp === "number" ? `${item.timestamp.toFixed(1)}s` : "-"}</p>
                        </div>
                      ) : (
                        <TimestampFramePreview
                          videoUrl={request.submission_video_url ?? ""}
                          timestampSeconds={item.timestamp}
                          label={`Athlete form photo (${item.key})`}
                        />
                      )}
                      <div className="border rounded-lg p-2 bg-white">
                        <p className="text-xs meta">Master sample photo ({item.key})</p>
                        {samplePhotoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={samplePhotoUrl} alt={`Master sample ${item.key}`} className="w-full h-32 object-contain rounded mt-1 bg-slate-50" />
                        ) : (
                          <div className="w-full h-32 rounded mt-1 bg-slate-50 flex items-center justify-center text-xs meta">
                            No sample photo
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <form action={updateRequest} className="grid md:grid-cols-2 gap-3 mt-4 border rounded-xl p-3 bg-white">
                <input type="hidden" name="request_id" value={request.id} />
                <label className="text-sm block">
                  Feedback
                  <select className="select mt-1" name="feedback_score" defaultValue={request.feedback_score ?? ""}>
                    <option value="">Not set</option>
                    <option value="5">There</option>
                    <option value="4">Almost there</option>
                    <option value="3">Getting closer</option>
                    <option value="2">Needs work</option>
                    <option value="1">Not quite</option>
                  </select>
                </label>
                <label className="text-sm block md:col-span-2">
                  Quick Notes
                  <input className="input mt-1" name="quick_notes" defaultValue={request.quick_notes ?? ""} />
                </label>
                <label className="text-sm block md:col-span-2">
                  Feedback Text
                  <textarea className="textarea mt-1" name="feedback_text" defaultValue={request.feedback_text ?? ""} />
                </label>
                <div className="md:col-span-2">
                  <button className="btn btn-primary" type="submit">Save Review Update</button>
                </div>
              </form>
            </div>
          </details>
        );
      })}

      {!requests?.length && (
        <section className="card p-6"><p className="meta">No review requests yet.</p></section>
      )}
    </main>
  );
}

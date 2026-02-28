/**
 * AUTO-DOC: File overview
 * Purpose: Next.js route page for `/athlete/request-review`.
 * Related pages/files:
 * - `lib/supabase/server.ts`
 * - `components/request-review-form.tsx`
 * - `components/timestamp-frame-preview.tsx`
 * - `app/layout.tsx`
 * - `components/right-sidebar.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";
import RequestReviewForm from "@/components/request-review-form";
import TimestampFramePreview from "@/components/timestamp-frame-preview";
import ClearTransientQuery from "@/components/clear-transient-query";
import { confidencePhrases } from "@/lib/types";

type ExerciseSamplePhotosByExercise = Record<
  string,
  {
    top?: string;
    middle?: string;
    bottom?: string;
  }
>;

export default async function AthleteRequestReviewPage({
  searchParams
}: {
  // `edit` holds the request ID currently in inline-edit mode (URL-driven, no client state needed)
  searchParams?: { status?: string; error?: string; deleted?: string; edit?: string };
}) {
  const supabase = createSupabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const cookieStore = await cookies();
  const scopedAthleteId = me?.role === "admin" ? cookieStore.get("admin_view_athlete_id")?.value || "" : user.id;
  if (me?.role === "admin" && !scopedAthleteId) redirect("/admin");

    const [{ data: profile }, { data: coachRel }, { data: exercises }, { data: requests }] = await Promise.all([
    supabase.from("profiles").select("role, full_name, share_feedback_publicly").eq("id", scopedAthleteId).maybeSingle(),
    supabase
      .from("athlete_relationships")
      .select("coach_id")
      .eq("athlete_id", scopedAthleteId)
      .limit(1)
      .maybeSingle(),
    supabase.from("exercises").select("id, name, exercise_group").order("name", { ascending: true }),
    supabase
      .from("review_requests")
      // Include updated_at and feedback_category so we can show the edit timestamp
      // and pre-populate the edit form fields
      .select("id, exercise_id, confidence_score, notes, feedback_category, created_at, updated_at, submission_video_url, ts_top_seconds, ts_middle_seconds, ts_bottom_seconds, exercise:exercises(name), videos:review_request_videos(video_url, position, duration_seconds)")
      .eq("athlete_id", scopedAthleteId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  if (profile?.role !== "athlete" && me?.role !== "admin") redirect("/");

  const requestedExerciseIds = (requests ?? [])
    .map((request: any) => request.exercise_id)
    .filter(Boolean);
  const selectableExerciseIds = (exercises ?? []).map((exercise: any) => exercise.id).filter(Boolean);
  const repPhotoExerciseIds = Array.from(new Set([...requestedExerciseIds, ...selectableExerciseIds]));

  const { data: repPhotos } = repPhotoExerciseIds.length
    ? await supabase
        .from("exercise_rep_photos")
        .select("exercise_id, photo_position, image_url, created_at")
        .in("exercise_id", repPhotoExerciseIds)
        .order("created_at", { ascending: false })
    : { data: [] as any[] };

  const samplePhotoByExerciseAndPosition = new Map<string, string>();
  for (const row of repPhotos ?? []) {
    const key = `${row.exercise_id}:${row.photo_position}`;
    if (!samplePhotoByExerciseAndPosition.has(key)) {
      samplePhotoByExerciseAndPosition.set(key, row.image_url);
    }
  }

  const samplePhotosByExercise: ExerciseSamplePhotosByExercise = {};
  for (const row of repPhotos ?? []) {
    if (!row?.exercise_id || !row?.photo_position || !row?.image_url) continue;
    if (!samplePhotosByExercise[row.exercise_id]) {
      samplePhotosByExercise[row.exercise_id] = {};
    }
    const bucket = samplePhotosByExercise[row.exercise_id];
    if (row.photo_position === "top" && !bucket.top) bucket.top = row.image_url;
    if (row.photo_position === "middle" && !bucket.middle) bucket.middle = row.image_url;
    if (row.photo_position === "bottom" && !bucket.bottom) bucket.bottom = row.image_url;
  }

  async function submitRequest(formData: FormData) {
    "use server";
    const sb = createSupabaseServer();
    const {
      data: { user: actionUser }
    } = await sb.auth.getUser();
    if (!actionUser) redirect("/login");
    const { data: actionMe } = await sb.from("profiles").select("role").eq("id", actionUser.id).maybeSingle();
    const actionCookies = await cookies();
    const targetAthleteId =
      actionMe?.role === "admin" ? actionCookies.get("admin_view_athlete_id")?.value || "" : actionUser.id;
    if (!targetAthleteId) redirect("/admin");

    const { data: rel } = await sb
      .from("athlete_relationships")
      .select("coach_id")
      .eq("athlete_id", targetAthleteId)
      .limit(1)
      .maybeSingle();
    const fallbackCoachId = actionMe?.role === "admin" ? actionCookies.get("admin_view_coach_id")?.value || "" : "";
    const resolvedCoachId = rel?.coach_id || fallbackCoachId;
    if (!resolvedCoachId) redirect("/athlete/request-review?error=no_coach");

    const videoUrls = JSON.parse(String(formData.get("request_video_urls") ?? "[]")) as string[];
    const videoDurations = JSON.parse(String(formData.get("request_video_durations") ?? "[]")) as number[];

    function toIntOrNull(value: FormDataEntryValue | null): number | null {
      const parsed = Number(value ?? "");
      if (!Number.isFinite(parsed)) return null;
      return Math.round(parsed);
    }

    function toConfidence(value: FormDataEntryValue | null): number {
      const parsed = Number(value ?? 3);
      if (!Number.isFinite(parsed)) return 3;
      return Math.min(5, Math.max(1, Math.round(parsed)));
    }

    const tsTop = toIntOrNull(formData.get("ts_top_seconds"));
    const tsMiddle = toIntOrNull(formData.get("ts_middle_seconds"));
    const tsBottom = toIntOrNull(formData.get("ts_bottom_seconds"));
    const confidenceScore = toConfidence(formData.get("confidence_score"));

    if (!Array.isArray(videoUrls) || videoUrls.length !== 1) redirect("/athlete/request-review?error=video_required");

    if (videoDurations.some((seconds) => Number(seconds) > 180)) {
      redirect("/athlete/request-review?error=video_too_long");
    }

    const exerciseId = String(formData.get("exercise_id") ?? "").trim();
    if (!exerciseId) redirect("/athlete/request-review?error=exercise_required");

    const { data: request, error: requestInsertError } = await sb
      .from("review_requests")
      .insert({
        athlete_id: targetAthleteId,
        coach_id: resolvedCoachId,
        exercise_id: exerciseId,
        confidence_score: confidenceScore,
        notes: String(formData.get("notes") ?? "") || null,
        submission_video_url: String(formData.get("submission_video_url") ?? "") || null,
        ts_top_seconds: tsTop,
        ts_middle_seconds: tsMiddle,
        ts_bottom_seconds: tsBottom,
        feedback_category: String(formData.get("feedback_category") ?? "") || null,
        status: "pending"
      })
      .select("id")
      .single();

    if (requestInsertError || !request?.id) {
      // Log the actual Supabase error so it shows in Vercel function logs
      console.error("[submitRequest] review_requests insert failed:", requestInsertError?.message, requestInsertError?.details, requestInsertError?.hint);
      redirect("/athlete/request-review?error=submit_failed");
    }

    if (request?.id) {
      for (let i = 0; i < videoUrls.length; i += 1) {
        const url = videoUrls[i];
        if (!url) continue;
        const { error: requestVideoError } = await sb.from("review_request_videos").insert({
          review_request_id: request.id,
          video_url: url,
          duration_seconds: Number(videoDurations[i] ?? 0) || null,
          position: i + 1
        });
        if (requestVideoError) redirect("/athlete/request-review?error=video_link_failed");
      }

      const photoRows = [
        {
          position: 101,
          url: String(formData.get("request_photo_top") ?? "").trim(),
          seconds: tsTop
        },
        {
          position: 102,
          url: String(formData.get("request_photo_middle") ?? "").trim(),
          seconds: tsMiddle
        },
        {
          position: 103,
          url: String(formData.get("request_photo_bottom") ?? "").trim(),
          seconds: tsBottom
        }
      ];
      for (const row of photoRows) {
        if (!row.url) continue;
        const { error: requestPhotoError } = await sb.from("review_request_videos").insert({
          review_request_id: request.id,
          video_url: row.url,
          duration_seconds: row.seconds,
          position: row.position
        });
        if (requestPhotoError) redirect("/athlete/request-review?error=video_link_failed");
      }

      const { data: athleteProfile } = await sb
        .from("profiles")
        .select("full_name, share_feedback_publicly")
        .eq("id", targetAthleteId)
        .maybeSingle();
      if (athleteProfile?.share_feedback_publicly) {
        const { data: exercise } = await sb
          .from("exercises")
          .select("name")
          .eq("id", exerciseId)
          .maybeSingle();
        const { error: boardError } = await sb.from("public_review_board_messages").insert({
          sender_id: targetAthleteId,
          athlete_id: targetAthleteId,
          message_type: "request_submitted",
          message_text: `${athleteProfile?.full_name ?? "Athlete"} submitted a new public review request.`,
          request_id: request.id,
          reviewed_exercises: exercise?.name ? [exercise.name] : []
        });
        if (boardError) {
          console.error("Failed to post board notification", boardError);
        }
      }
    }

    redirect("/athlete/request-review?status=submitted");
  }

  async function deletePendingRequest(formData: FormData) {
    "use server";
    const sb = createSupabaseServer();
    const {
      data: { user: actionUser }
    } = await sb.auth.getUser();
    if (!actionUser) redirect("/login");
    const { data: actionMe } = await sb.from("profiles").select("role").eq("id", actionUser.id).maybeSingle();
    const actionCookies = await cookies();
    const targetAthleteId =
      actionMe?.role === "admin" ? actionCookies.get("admin_view_athlete_id")?.value || "" : actionUser.id;
    if (!targetAthleteId) redirect("/admin");

    const requestId = String(formData.get("request_id") ?? "").trim();
    if (!requestId) redirect("/athlete/request-review?error=delete_failed");

    const { error: deleteError } = await sb
      .from("review_requests")
      .delete()
      .eq("id", requestId)
      .eq("athlete_id", targetAthleteId)
      .eq("status", "pending");

    if (deleteError) {
      redirect("/athlete/request-review?error=delete_failed");
    }
    redirect(`/athlete/request-review?deleted=${requestId}`);
  }

  // Inline edit action — updates notes, confidence, and category on a pending request.
  // Sets updated_at explicitly so both athlete and coach views reflect the edit time.
  async function editPendingRequest(formData: FormData) {
    "use server";
    const sb = createSupabaseServer();
    const {
      data: { user: actionUser }
    } = await sb.auth.getUser();
    if (!actionUser) redirect("/login");
    const { data: actionMe } = await sb.from("profiles").select("role").eq("id", actionUser.id).maybeSingle();
    const actionCookies = await cookies();
    const targetAthleteId =
      actionMe?.role === "admin" ? actionCookies.get("admin_view_athlete_id")?.value || "" : actionUser.id;
    if (!targetAthleteId) redirect("/admin");

    const requestId = String(formData.get("request_id") ?? "").trim();
    if (!requestId) redirect("/athlete/request-review?error=edit_failed");

    const { error: updateError } = await sb
      .from("review_requests")
      .update({
        confidence_score: Number(formData.get("confidence_score") ?? 3),
        notes: String(formData.get("notes") ?? "") || null,
        feedback_category: String(formData.get("feedback_category") ?? "") || null,
        // Stamp updated_at so both athlete and coach views can show when the request was last edited
        updated_at: new Date().toISOString()
      })
      .eq("id", requestId)
      .eq("athlete_id", targetAthleteId)
      .eq("status", "pending");

    if (updateError) {
      redirect("/athlete/request-review?error=edit_failed");
    }
    redirect("/athlete/request-review?status=updated");
  }

  return (
    <main className="shell space-y-4">
      <ClearTransientQuery keys={["error"]} />
      <section className="card p-6">
        <p className="badge inline-block">Athlete - Request Review</p>
        <h1 className="text-3xl mt-3">Request Review</h1>
        {!coachRel?.coach_id && (
          <p className="text-red-700 text-sm mt-2">No coach relationship found yet. Ask admin/coach to link your profile.</p>
        )}
        {searchParams?.status === "submitted" && (
          <p className="text-green-700 text-sm mt-2">Review request submitted. It is now in pending.</p>
        )}
        {searchParams?.status === "updated" && (
          <p className="text-green-700 text-sm mt-2">Request updated successfully.</p>
        )}
        {!!searchParams?.error && (
          <p className="text-red-700 text-sm mt-2">
            Action failed:{" "}
            {searchParams.error === "no_coach" && "no coach relationship is linked yet."}
            {searchParams.error === "video_required" && "upload one video first."}
            {searchParams.error === "video_too_long" && "video must be 3 minutes or less."}
            {searchParams.error === "exercise_required" && "select an exercise."}
            {searchParams.error === "video_link_failed" && "request saved but video link entry failed."}
            {searchParams.error === "submit_failed" && "could not save request."}
            {searchParams.error === "delete_failed" && "could not delete pending request."}
            {searchParams.error === "edit_failed" && "could not update request."}
            {!["no_coach", "video_required", "video_too_long", "exercise_required", "video_link_failed", "submit_failed", "delete_failed", "edit_failed"].includes(searchParams.error) &&
              "unexpected error."}
          </p>
        )}

        <div className="mt-4">
          <RequestReviewForm
            exercises={exercises ?? []}
            samplePhotosByExercise={samplePhotosByExercise}
            action={submitRequest}
          />
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-2xl">Pending Requests</h2>
        <div className="space-y-2 mt-3">
          {(requests ?? []).map((request: any) => {
            const exercise = Array.isArray(request.exercise) ? request.exercise[0] : request.exercise;
            const requestVideos = Array.isArray(request.videos) ? request.videos : [];
            const requestPhotoByPosition = new Map<string, string>();
            for (const v of requestVideos) {
              if (v.position === 101) requestPhotoByPosition.set("top", v.video_url);
              if (v.position === 102) requestPhotoByPosition.set("middle", v.video_url);
              if (v.position === 103) requestPhotoByPosition.set("bottom", v.video_url);
            }

            // When this request is being edited, render an inline edit form card
            // instead of the normal expandable details view.
            const isEditing = searchParams?.edit === request.id;

            if (isEditing) {
              return (
                <div key={request.id} className="border rounded-xl p-4 bg-white">
                  <div className="flex gap-2 flex-wrap items-center justify-between mb-3">
                    <div className="flex gap-2 flex-wrap items-center">
                      <span className="font-semibold">{exercise?.name ?? "Exercise"}</span>
                      <span className="badge">Editing</span>
                    </div>
                    {/* Cancel edit — navigate back without the edit param */}
                    <Link href="/athlete/request-review" className="btn btn-secondary text-xs">
                      Cancel
                    </Link>
                  </div>

                  {/* Show both timestamps when in edit mode */}
                  <p className="text-sm meta">Submitted: {new Date(request.created_at).toLocaleString()}</p>
                  {request.updated_at && (
                    <p className="text-sm meta">Updated: {new Date(request.updated_at).toLocaleString()}</p>
                  )}

                  <form action={editPendingRequest} className="mt-3 space-y-3">
                    <input type="hidden" name="request_id" value={request.id} />
                    <label className="text-sm block">
                      Confidence Score
                      <select className="select mt-1" name="confidence_score" defaultValue={request.confidence_score}>
                        {Object.entries(confidencePhrases).map(([score, phrase]) => (
                          <option key={score} value={score}>{score} - {phrase}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm block">
                      Feedback Category
                      <input
                        className="input mt-1"
                        name="feedback_category"
                        placeholder="breathing, hip shift"
                        defaultValue={request.feedback_category ?? ""}
                      />
                    </label>
                    <label className="text-sm block">
                      Notes / Questions
                      <textarea className="textarea mt-1" name="notes" defaultValue={request.notes ?? ""} />
                    </label>
                    <div className="flex gap-2">
                      <button className="btn btn-primary" type="submit">Save Changes</button>
                      <Link href="/athlete/request-review" className="btn btn-secondary">Cancel</Link>
                    </div>
                  </form>
                </div>
              );
            }

            // Normal (view) mode — expandable details card with edit + delete buttons
            return (
              <details key={request.id} className="border rounded-xl p-3 bg-white" open={false}>
                <summary className="cursor-pointer list-none">
                  <div className="flex gap-2 flex-wrap items-center justify-between">
                    <div className="flex gap-2 flex-wrap items-center">
                      <span className="font-semibold">{exercise?.name ?? "Exercise"}</span>
                      <span className="badge">Confidence {request.confidence_score}</span>
                      {searchParams?.deleted === request.id && <span className="badge">Deleted</span>}
                    </div>
                    <div className="flex gap-2">
                      {/* Edit button — navigates to ?edit=requestId to show inline edit form */}
                      <Link
                        href={`/athlete/request-review?edit=${request.id}`}
                        className="btn btn-secondary"
                        title="Edit pending request"
                        aria-label="Edit pending request"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </Link>
                      {/* Delete button */}
                      <form action={deletePendingRequest}>
                        <input type="hidden" name="request_id" value={request.id} />
                        <button
                          type="submit"
                          className="btn btn-secondary"
                          title="Delete pending request"
                          aria-label="Delete pending request"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M8 6V4h8v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M10 10v6M14 10v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </button>
                      </form>
                    </div>
                  </div>
                </summary>
                <div className="mt-2">
                  {/* Submitted timestamp always shown; Updated shown only if the request has been edited */}
                  <p className="text-sm meta">Submitted: {new Date(request.created_at).toLocaleString()}</p>
                  {request.updated_at && (
                    <p className="text-sm meta">Updated: {new Date(request.updated_at).toLocaleString()}</p>
                  )}
                  {request.notes && <p className="text-sm mt-1">{request.notes}</p>}
                  <div className="space-y-2 mt-3">
                    {([
                      { key: "top", timestamp: request.ts_top_seconds },
                      { key: "middle", timestamp: request.ts_middle_seconds },
                      { key: "bottom", timestamp: request.ts_bottom_seconds }
                    ] as const).map((item) => {
                      const samplePhotoUrl = samplePhotoByExerciseAndPosition.get(`${request.exercise_id}:${item.key}`);
                      const requestPhotoUrl = requestPhotoByPosition.get(item.key);
                      return (
                        <div key={`${request.id}-${item.key}`} className="grid md:grid-cols-2 gap-2">
                          {requestPhotoUrl ? (
                            <div className="border rounded-lg p-2 bg-white">
                              <p className="text-xs meta">Your form photo ({item.key})</p>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={requestPhotoUrl} alt={`Your form photo ${item.key}`} className="w-full h-32 object-contain rounded mt-1 bg-slate-50" />
                              <p className="text-xs mt-1">Timestamp: {typeof item.timestamp === "number" ? `${item.timestamp.toFixed(1)}s` : "-"}</p>
                            </div>
                          ) : (
                            <TimestampFramePreview
                              videoUrl={request.submission_video_url ?? ""}
                              timestampSeconds={item.timestamp}
                              label={`Your form photo (${item.key})`}
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
                </div>
              </details>
            );
          })}
          {!requests?.length && <p className="meta">No requests yet.</p>}
        </div>
      </section>
    </main>
  );
}

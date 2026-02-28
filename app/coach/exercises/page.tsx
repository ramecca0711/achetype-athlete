/**
 * AUTO-DOC: File overview
 * Purpose: Next.js route page for `/coach/exercises`.
 * Related pages/files:
 * - `lib/supabase/server.ts`
 * - `components/exercise-sample-upload-form.tsx`
 * - `components/timestamp-frame-preview.tsx`
 * - `lib/video-screenshots.ts`
 * - `app/layout.tsx`
 * - `components/right-sidebar.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";
import ExerciseSampleUploadForm from "@/components/exercise-sample-upload-form";
import TimestampFramePreview from "@/components/timestamp-frame-preview";
import { generateTimestampScreenshots } from "@/lib/video-screenshots";

export const runtime = "nodejs";

function getArchetypeFilterValue(structuralGoal: string | null | undefined): string {
  const value = String(structuralGoal ?? "").toUpperCase();
  if (value.includes("ARCHETYPE A")) return "A";
  if (value.includes("ARCHETYPE V")) return "V";
  if (value.includes("ARCHETYPE H")) return "H";
  if (value.includes("NARROW ISA")) return "NARROW ISA";
  if (value.includes("WIDE ISA")) return "WIDE ISA";
  return value.trim() ? "OTHER" : "";
}

export default async function CoachExercisesPage({
  searchParams
}: {
  searchParams?: {
    edit?: string;
    updated?: string;
    sample_saved?: string;
    sample_saved_for?: string;
    sample_error?: string;
    sample_warning?: string;
    sample_debug?: string;
    group?: string;
    subgroup?: string;
    exercise?: string;
    archetype?: string;
    deleted?: string;
    delete_error?: string;
    search?: string;
  };
}) {
  const supabase = createSupabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role, approval_status, onboarding_completed").eq("id", user.id).maybeSingle();
  if (me?.approval_status === "pending") redirect("/pending-approval");
  if (me?.role === "coach" && !me?.onboarding_completed) redirect("/coach/onboarding");
  if (me?.role !== "coach" && me?.role !== "admin") redirect("/");
  const cookieStore = await cookies();
  const scopedCoachId = me?.role === "admin" ? cookieStore.get("admin_view_coach_id")?.value || "" : user.id;
  if (me?.role === "admin" && !scopedCoachId) redirect("/admin");

  async function addExercise(formData: FormData) {
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

    const name = String(formData.get("name") ?? "").trim();
    if (!name) {
      redirect("/coach/exercises");
    }

    const payload = {
      name,
      category: String(formData.get("category") ?? "General"),
      exercise_group: String(formData.get("exercise_group") ?? "General"),
      exercise_subgroup: String(formData.get("exercise_subgroup") ?? "") || null,
      structural_goal: String(formData.get("structural_goal") ?? "") || null,
      cues: String(formData.get("cues") ?? "") || null,
      purpose_impact: String(formData.get("purpose_impact") ?? "") || null,
      where_to_feel: String(formData.get("where_to_feel") ?? "") || null,
      dos_examples: String(formData.get("dos_examples") ?? "") || null,
      donts_examples: String(formData.get("donts_examples") ?? "") || null
    };

    const { data: existing } = await sb
      .from("exercises")
      .select("id")
      .ilike("name", name)
      .limit(1)
      .maybeSingle();

    let exerciseId = "";
    if (existing?.id) {
      await sb.from("exercises").update(payload).eq("id", existing.id);
      exerciseId = existing.id;
    } else {
      const { data: inserted } = await sb.from("exercises").insert(payload).select("id").single();
      exerciseId = inserted?.id ?? "";
    }

    const sampleUrls = JSON.parse(String(formData.get("sample_video_urls") ?? "[]")) as string[];
    const sampleDurations = JSON.parse(String(formData.get("sample_video_durations") ?? "[]")) as number[];
    const videoSource = String(formData.get("video_source") ?? "").trim();
    const hasSample = Array.isArray(sampleUrls) && sampleUrls.length === 1 && Boolean(sampleUrls[0]);

    const normalizeSeconds = (value: FormDataEntryValue | null): number | null => {
      const num = Number(String(value ?? "").trim());
      if (!Number.isFinite(num) || num < 0) return null;
      return Math.round(num);
    };

    if (exerciseId && hasSample) {
      if (sampleDurations.some((seconds) => Number(seconds) > 180)) {
        redirect("/coach/exercises?sample_error=duration_limit");
      }

      const { data: latestExisting } = await sb
        .from("exercise_reference_videos")
        .select("loom_url, ts_top_seconds, ts_middle_seconds, ts_bottom_seconds")
        .eq("coach_id", targetCoachId)
        .eq("exercise_id", exerciseId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const submittedTop = normalizeSeconds(formData.get("ts_top_seconds"));
      const submittedMiddle = normalizeSeconds(formData.get("ts_middle_seconds"));
      const submittedBottom = normalizeSeconds(formData.get("ts_bottom_seconds"));
      const resolvedTop = submittedTop ?? latestExisting?.ts_top_seconds ?? null;
      const resolvedMiddle = submittedMiddle ?? latestExisting?.ts_middle_seconds ?? null;
      const resolvedBottom = submittedBottom ?? latestExisting?.ts_bottom_seconds ?? null;
      const resolvedLoomUrl = String(formData.get("loom_url") ?? "").trim() || latestExisting?.loom_url || "";

      let referenceId = "";
      const { data: existingReference } = await sb
        .from("exercise_reference_videos")
        .select("id")
        .eq("coach_id", targetCoachId)
        .eq("exercise_id", exerciseId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingReference?.id) {
        const { error: referenceUpdateError } = await sb
          .from("exercise_reference_videos")
          .update({
            loom_url: resolvedLoomUrl,
            audience: "all",
            feedback_category: null,
            cue_notes: null,
            ts_top_seconds: resolvedTop,
            ts_middle_seconds: resolvedMiddle,
            ts_bottom_seconds: resolvedBottom
          })
          .eq("id", existingReference.id);
        if (referenceUpdateError) {
          redirect("/coach/exercises?sample_error=reference_insert_failed");
        }
        referenceId = existingReference.id;
      } else {
        const { data: insertedReference, error: referenceInsertError } = await sb
          .from("exercise_reference_videos")
          .insert({
            exercise_id: exerciseId,
            coach_id: targetCoachId,
            loom_url: resolvedLoomUrl,
            audience: "all",
            feedback_category: null,
            cue_notes: null,
            ts_top_seconds: resolvedTop,
            ts_middle_seconds: resolvedMiddle,
            ts_bottom_seconds: resolvedBottom
          })
          .select("id")
          .single();
        if (referenceInsertError || !insertedReference?.id) {
          redirect("/coach/exercises?sample_error=reference_insert_failed");
        }
        referenceId = insertedReference.id;
      }

      const duration = Number(sampleDurations[0] ?? 0) || null;
      const { data: existingAsset } = await sb
        .from("exercise_reference_video_assets")
        .select("id")
        .eq("reference_video_id", referenceId)
        .eq("position", 1)
        .limit(1)
        .maybeSingle();
      if (existingAsset?.id) {
        const { error: assetUpdateError } = await sb
          .from("exercise_reference_video_assets")
          .update({
            video_url: sampleUrls[0],
            duration_seconds: duration
          })
          .eq("id", existingAsset.id);
        if (assetUpdateError) {
          redirect("/coach/exercises?sample_error=asset_insert_failed");
        }
      } else {
        const { error: assetInsertError } = await sb.from("exercise_reference_video_assets").insert({
          reference_video_id: referenceId,
          video_url: sampleUrls[0],
          duration_seconds: duration,
          position: 1
        });
        if (assetInsertError) {
          redirect("/coach/exercises?sample_error=asset_insert_failed");
        }
      }

      let generatedPhotoUrls: Partial<Record<"top" | "middle" | "bottom", string>> = {};
      if (videoSource === "link" && sampleUrls[0]) {
        try {
          const frameBuffers = await generateTimestampScreenshots(sampleUrls[0], {
            top: resolvedTop,
            middle: resolvedMiddle,
            bottom: resolvedBottom
          });
          for (const slot of ["top", "middle", "bottom"] as const) {
            const frame = frameBuffers[slot];
            if (!frame?.buffer) continue;
            const uploadPath = `${targetCoachId}/exercise-${exerciseId}-sample-${slot}-${Date.now()}.jpg`;
            const uploadBody = Buffer.from(new Uint8Array(frame.buffer));
            const { error: uploadErr } = await sb.storage
              .from("exercise-sample-videos")
              .upload(uploadPath, uploadBody, {
                upsert: true,
                contentType: "image/jpeg",
                cacheControl: "3600"
              });
            if (!uploadErr) {
              const { data: publicData } = sb.storage.from("exercise-sample-videos").getPublicUrl(uploadPath);
              generatedPhotoUrls[slot] = publicData.publicUrl;
            }
          }
        } catch {
          // Non-blocking for add-exercise flow
        }
      }

      const topPhoto = String(formData.get("photo_top") ?? "").trim() || generatedPhotoUrls.top || "";
      const middlePhoto = String(formData.get("photo_middle") ?? "").trim() || generatedPhotoUrls.middle || "";
      const bottomPhoto = String(formData.get("photo_bottom") ?? "").trim() || generatedPhotoUrls.bottom || "";

      for (const [position, photoUrl] of [
        ["top", topPhoto],
        ["middle", middlePhoto],
        ["bottom", bottomPhoto]
      ] as const) {
        if (!photoUrl) continue;
        const { data: existingPhoto } = await sb
          .from("exercise_rep_photos")
          .select("id")
          .eq("exercise_id", exerciseId)
          .eq("position", position)
          .limit(1)
          .maybeSingle();
        if (existingPhoto?.id) {
          await sb
            .from("exercise_rep_photos")
            .update({ url: photoUrl, source: "coach_sample", uploaded_by: targetCoachId })
            .eq("id", existingPhoto.id);
        } else {
          await sb.from("exercise_rep_photos").insert({
            exercise_id: exerciseId,
            position,
            url: photoUrl,
            source: "coach_sample",
            uploaded_by: targetCoachId
          });
        }
      }
    }

    redirect("/coach/exercises");
  }

  async function addReferenceVideo(formData: FormData) {
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

    const sampleUrls = JSON.parse(String(formData.get("sample_video_urls") ?? "[]")) as string[];
    const sampleDurations = JSON.parse(String(formData.get("sample_video_durations") ?? "[]")) as number[];
    const exerciseId = String(formData.get("exercise_id") ?? "").trim();
    const videoSource = String(formData.get("video_source") ?? "").trim();

    const normalizeSeconds = (value: FormDataEntryValue | null): number | null => {
      const num = Number(String(value ?? "").trim());
      if (!Number.isFinite(num) || num < 0) return null;
      return Math.round(num);
    };

    if (!exerciseId) {
      redirect("/coach/exercises?sample_error=missing_exercise");
    }

    if (!Array.isArray(sampleUrls) || sampleUrls.length !== 1) {
      redirect(`/coach/exercises?edit=${exerciseId}&sample_error=missing_video`);
    }

    if (sampleDurations.some((seconds) => Number(seconds) > 180)) {
      redirect(`/coach/exercises?edit=${exerciseId}&sample_error=duration_limit`);
    }

    const { data: latestExisting } = await sb
      .from("exercise_reference_videos")
      .select("loom_url, ts_top_seconds, ts_middle_seconds, ts_bottom_seconds")
      .eq("coach_id", targetCoachId)
      .eq("exercise_id", exerciseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const submittedTop = normalizeSeconds(formData.get("ts_top_seconds"));
    const submittedMiddle = normalizeSeconds(formData.get("ts_middle_seconds"));
    const submittedBottom = normalizeSeconds(formData.get("ts_bottom_seconds"));
    const resolvedTop = submittedTop ?? latestExisting?.ts_top_seconds ?? null;
    const resolvedMiddle = submittedMiddle ?? latestExisting?.ts_middle_seconds ?? null;
    const resolvedBottom = submittedBottom ?? latestExisting?.ts_bottom_seconds ?? null;
    const resolvedLoomUrl = String(formData.get("loom_url") ?? "").trim() || latestExisting?.loom_url || "";

    let referenceId = "";
    const { data: existingReference } = await sb
      .from("exercise_reference_videos")
      .select("id")
      .eq("coach_id", targetCoachId)
      .eq("exercise_id", exerciseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingReference?.id) {
      const { error: referenceUpdateError } = await sb
        .from("exercise_reference_videos")
        .update({
          loom_url: resolvedLoomUrl,
          audience: "all",
          feedback_category: null,
          cue_notes: null,
          ts_top_seconds: resolvedTop,
          ts_middle_seconds: resolvedMiddle,
          ts_bottom_seconds: resolvedBottom
        })
        .eq("id", existingReference.id);
      if (referenceUpdateError) {
        redirect(`/coach/exercises?edit=${exerciseId}&sample_error=reference_insert_failed`);
      }
      referenceId = existingReference.id;
    } else {
      const { data: insertedReference, error: referenceInsertError } = await sb
        .from("exercise_reference_videos")
        .insert({
          exercise_id: exerciseId,
          coach_id: targetCoachId,
          loom_url: resolvedLoomUrl,
          audience: "all",
          feedback_category: null,
          cue_notes: null,
          ts_top_seconds: resolvedTop,
          ts_middle_seconds: resolvedMiddle,
          ts_bottom_seconds: resolvedBottom
        })
        .select("id")
        .single();
      if (referenceInsertError || !insertedReference?.id) {
        redirect(`/coach/exercises?edit=${exerciseId}&sample_error=reference_insert_failed`);
      }
      referenceId = insertedReference.id;
    }

    for (let i = 0; i < sampleUrls.length; i += 1) {
      const url = sampleUrls[i];
      if (!url) continue;
      const position = i + 1;
      const { data: existingAsset } = await sb
        .from("exercise_reference_video_assets")
        .select("id")
        .eq("reference_video_id", referenceId)
        .eq("position", position)
        .limit(1)
        .maybeSingle();
      if (existingAsset?.id) {
        const { error: assetUpdateError } = await sb
          .from("exercise_reference_video_assets")
          .update({
            video_url: url,
            duration_seconds: Number(sampleDurations[i] ?? 0) || null
          })
          .eq("id", existingAsset.id);
        if (assetUpdateError) {
          redirect(`/coach/exercises?edit=${exerciseId}&sample_error=asset_insert_failed`);
        }
      } else {
        const { error: assetInsertError } = await sb.from("exercise_reference_video_assets").insert({
          reference_video_id: referenceId,
          video_url: url,
          duration_seconds: Number(sampleDurations[i] ?? 0) || null,
          position
        });
        if (assetInsertError) {
          redirect(`/coach/exercises?edit=${exerciseId}&sample_error=asset_insert_failed`);
        }
      }
    }

    let generatedPhotoUrls: Partial<Record<"top" | "middle" | "bottom", string>> = {};
    let frameCaptureWarning = "";
    if (videoSource === "link" && sampleUrls[0]) {
      try {
        const frameBuffers = await generateTimestampScreenshots(sampleUrls[0], {
          top: resolvedTop,
          middle: resolvedMiddle,
          bottom: resolvedBottom
        });

        for (const slot of ["top", "middle", "bottom"] as const) {
          const frame = frameBuffers[slot];
          if (!frame) continue;
          const path = `${actionUser.id}/exercise-rep-${exerciseId}-${slot}-${Date.now()}.jpg`;
          const { error: frameUploadError } = await sb.storage
            .from("exercise-sample-videos")
            .upload(path, frame, { upsert: true, cacheControl: "3600", contentType: "image/jpeg" });
          if (frameUploadError) continue;
          const { data: framePublic } = sb.storage.from("exercise-sample-videos").getPublicUrl(path);
          generatedPhotoUrls[slot] = framePublic.publicUrl;
        }
      } catch (error) {
        frameCaptureWarning = error instanceof Error ? error.message.slice(0, 120) : "frame_capture_failed";
      }
    }

    const positions = ["top", "middle", "bottom"] as const;
    for (const pos of positions) {
      const url = String(formData.get(`photo_${pos}`) ?? "").trim() || generatedPhotoUrls[pos] || "";
      if (!url) continue;
      const { data: existingPhoto } = await sb
        .from("exercise_rep_photos")
        .select("id")
        .eq("exercise_id", exerciseId)
        .eq("photo_position", pos)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingPhoto?.id) {
        const { error: photoUpdateError } = await sb
          .from("exercise_rep_photos")
          .update({ image_url: url })
          .eq("id", existingPhoto.id);
        if (photoUpdateError) {
          redirect(`/coach/exercises?edit=${exerciseId}&sample_error=rep_photo_failed`);
        }
      } else {
        const { error: photoInsertError } = await sb.from("exercise_rep_photos").insert({
          exercise_id: exerciseId,
          photo_position: pos,
          image_url: url
        });
        if (photoInsertError) {
          redirect(`/coach/exercises?edit=${exerciseId}&sample_error=rep_photo_failed`);
        }
      }
    }

    redirect(
      `/coach/exercises?sample_saved=1&sample_saved_for=${exerciseId}${
        frameCaptureWarning
          ? `&sample_warning=frame_capture_unavailable&sample_debug=${encodeURIComponent(frameCaptureWarning)}`
          : ""
      }`
    );
  }

  async function updateExercise(formData: FormData) {
    "use server";
    const sb = createSupabaseServer();
    const {
      data: { user: actionUser }
    } = await sb.auth.getUser();
    if (!actionUser) redirect("/login");
    const { data: actionMe } = await sb.from("profiles").select("role").eq("id", actionUser.id).maybeSingle();
    if (actionMe?.role !== "coach" && actionMe?.role !== "admin") redirect("/");

    const exerciseId = String(formData.get("exercise_id") ?? "").trim();
    if (!exerciseId) redirect("/coach/exercises");

    await sb
      .from("exercises")
      .update({
        name: String(formData.get("name") ?? "").trim(),
        category: String(formData.get("category") ?? "").trim() || "General",
        exercise_group: String(formData.get("exercise_group") ?? "").trim() || "Needs Setup",
        exercise_subgroup: String(formData.get("exercise_subgroup") ?? "").trim() || null,
        structural_goal: String(formData.get("structural_goal") ?? "").trim() || null,
        cues: String(formData.get("cues") ?? "").trim() || null,
        purpose_impact: String(formData.get("purpose_impact") ?? "").trim() || null,
        where_to_feel: String(formData.get("where_to_feel") ?? "").trim() || null,
        dos_examples: String(formData.get("dos_examples") ?? "").trim() || null,
        donts_examples: String(formData.get("donts_examples") ?? "").trim() || null
      })
      .eq("id", exerciseId);

    redirect(`/coach/exercises?updated=${exerciseId}`);
  }

  async function deleteExercise(formData: FormData) {
    "use server";
    const sb = createSupabaseServer();
    const {
      data: { user: actionUser }
    } = await sb.auth.getUser();
    if (!actionUser) redirect("/login");
    const { data: actionMe } = await sb.from("profiles").select("role").eq("id", actionUser.id).maybeSingle();
    if (actionMe?.role !== "coach" && actionMe?.role !== "admin") redirect("/");

    const exerciseId = String(formData.get("exercise_id") ?? "").trim();
    if (!exerciseId) redirect("/coach/exercises?delete_error=missing_id");

    const { error } = await sb.from("exercises").delete().eq("id", exerciseId);
    if (error) {
      redirect("/coach/exercises?delete_error=in_use");
    }
    redirect(`/coach/exercises?deleted=${exerciseId}`);
  }

  const [{ data: exercises }, { data: videos }, { data: coachFeedbackRows }] = await Promise.all([
    supabase
      .from("exercises")
      .select("id, name, category, exercise_group, exercise_subgroup, structural_goal, cues, purpose_impact, where_to_feel, dos_examples, donts_examples")
      .order("name", { ascending: true }),
    supabase
      .from("exercise_reference_videos")
      .select("id, exercise_id, loom_url, cue_notes, ts_top_seconds, ts_middle_seconds, ts_bottom_seconds")
      .eq("coach_id", scopedCoachId)
      .order("created_at", { ascending: false })
      .limit(300),
    // All feedback notes this coach has given across all athletes, grouped by exercise
    supabase
      .from("review_requests")
      .select("exercise_id, feedback_text, quick_notes, feedback_score, created_at")
      .eq("coach_id", scopedCoachId)
      .order("created_at", { ascending: true }),
  ]);
  const exerciseIds = (exercises ?? []).map((exercise) => exercise.id);
  const [{ data: repPhotos }] = await Promise.all([
    exerciseIds.length
      ? supabase
          .from("exercise_rep_photos")
          .select("exercise_id, photo_position, image_url, created_at")
          .in("exercise_id", exerciseIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as any[] })
  ]);

  const videosByExercise = new Map<string, any[]>();
  for (const video of videos ?? []) {
    const arr = videosByExercise.get(video.exercise_id) ?? [];
    arr.push(video);
    videosByExercise.set(video.exercise_id, arr);
  }
  const repPhotoByExerciseAndPosition = new Map<string, string>();
  for (const row of repPhotos ?? []) {
    const key = `${row.exercise_id}:${row.photo_position}`;
    if (!repPhotoByExerciseAndPosition.has(key)) {
      repPhotoByExerciseAndPosition.set(key, row.image_url);
    }
  }

  // Aggregate all feedback notes this coach has given, grouped by exercise_id
  type CoachFeedbackEntry = { date: string; score: number | null; text: string | null; notes: string | null };
  const coachFeedbackByExercise = new Map<string, CoachFeedbackEntry[]>();
  for (const row of coachFeedbackRows ?? []) {
    // Only include rows where the coach actually wrote something
    if (!row.feedback_text && !row.quick_notes) continue;
    const arr = coachFeedbackByExercise.get(row.exercise_id) ?? [];
    arr.push({ date: row.created_at, score: row.feedback_score ?? null, text: row.feedback_text ?? null, notes: row.quick_notes ?? null });
    coachFeedbackByExercise.set(row.exercise_id, arr);
  }

  const currentEditId = searchParams?.edit ?? "";
  const sampleSavedForId = searchParams?.sample_saved_for ?? "";
  const selectedGroup = String(searchParams?.group ?? "").trim();
  const selectedSubgroup = String(searchParams?.subgroup ?? "").trim();
  const selectedExerciseId = String(searchParams?.exercise ?? "").trim();
  const selectedArchetype = String(searchParams?.archetype ?? "").trim().toUpperCase();

  const allExercises = exercises ?? [];
  const groupOptions = Array.from(
    new Set(allExercises.map((exercise) => String(exercise.exercise_group ?? "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const groupScopedExercises = selectedGroup
    ? allExercises.filter((exercise) => String(exercise.exercise_group ?? "").trim() === selectedGroup)
    : allExercises;
  const subgroupOptions = Array.from(
    new Set(groupScopedExercises.map((exercise) => String(exercise.exercise_subgroup ?? "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const subgroupScopedExercises = selectedSubgroup
    ? groupScopedExercises.filter((exercise) => String(exercise.exercise_subgroup ?? "").trim() === selectedSubgroup)
    : groupScopedExercises;
  const archetypeOptions = Array.from(
    new Set(allExercises.map((exercise) => getArchetypeFilterValue(exercise.structural_goal)).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const archetypeScopedExercises = selectedArchetype
    ? subgroupScopedExercises.filter(
        (exercise) => getArchetypeFilterValue(exercise.structural_goal) === selectedArchetype
      )
    : subgroupScopedExercises;
  const exerciseOptions = archetypeScopedExercises
    .map((exercise) => ({ id: exercise.id, name: exercise.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  // Text search filter — case-insensitive substring match on exercise name
  const selectedSearch = String(searchParams?.search ?? "").trim().toLowerCase();
  const filteredExercises = selectedExerciseId
    ? archetypeScopedExercises.filter((exercise) => exercise.id === selectedExerciseId)
    : selectedSearch
    ? archetypeScopedExercises.filter((exercise) => exercise.name.toLowerCase().includes(selectedSearch))
    : archetypeScopedExercises;
  const groupedFiltered = filteredExercises.reduce<Record<string, typeof filteredExercises>>((acc, exercise) => {
    const key = String(exercise.exercise_group ?? "Unassigned");
    acc[key] = acc[key] ?? [];
    acc[key].push(exercise);
    return acc;
  }, {});
  const sortedGroups = Object.keys(groupedFiltered).sort((a, b) => a.localeCompare(b));

  return (
    <main className="shell space-y-4">
      <section className="card p-6">
        <p className="badge inline-block">Coach - Exercise Database (Edit)</p>
        <h1 className="text-3xl mt-3">Exercise Database</h1>
      </section>

      <section className="card p-6">
        <details open={false}>
          <summary className="cursor-pointer list-none">
            <h2 className="text-2xl">Add Exercise</h2>
          </summary>
          <div className="mt-3 space-y-4">
            <form action={addExercise} className="grid md:grid-cols-2 gap-3">
              <input className="input" name="name" placeholder="Exercise name" required />
              <input className="input" name="category" placeholder="Category (e.g. Category II)" required />
              <input className="input" name="exercise_group" placeholder="Group/type" required />
              <input className="input" name="exercise_subgroup" placeholder="Subgroup" />
              <input className="input md:col-span-2" name="structural_goal" placeholder="Archetype / structural goal" />
              <input className="input md:col-span-2" name="cues" placeholder="Cues" />
              <input className="input md:col-span-2" name="purpose_impact" placeholder="Purpose/impact" />
              <input className="input md:col-span-2" name="where_to_feel" placeholder="Where to feel" />
              <textarea className="textarea md:col-span-2" name="dos_examples" placeholder="Do examples" />
              <textarea className="textarea md:col-span-2" name="donts_examples" placeholder="Don't examples" />
              <div className="metric p-3 md:col-span-2">
                <h3 className="text-lg">Sample Video + Rep Points (Top/Middle/Bottom)</h3>
                <ExerciseSampleUploadForm
                  exercises={(exercises ?? []).map((exercise) => ({
                    id: exercise.id,
                    name: exercise.name,
                    category: exercise.category,
                    exercise_group: exercise.exercise_group,
                    exercise_subgroup: exercise.exercise_subgroup,
                    structural_goal: exercise.structural_goal,
                    cues: exercise.cues,
                    purpose_impact: exercise.purpose_impact,
                    where_to_feel: exercise.where_to_feel,
                    dos_examples: exercise.dos_examples,
                    donts_examples: exercise.donts_examples
                  }))}
                  action={addReferenceVideo}
                  embeddedInParentForm
                  hideExerciseSelect
                  showSubmitButton={false}
                />
              </div>
              <button className="btn btn-primary md:col-span-2" type="submit">Save Exercise</button>
            </form>
          </div>
        </details>
      </section>

      <section className="card p-6">
        <h2 className="text-2xl">Current Exercises</h2>
        {!!searchParams?.delete_error && (
          <p className="text-sm text-red-700 mt-2">
            Delete failed: {searchParams.delete_error === "in_use" ? "exercise is in use and cannot be deleted." : "missing exercise id."}
          </p>
        )}
        <form className="grid md:grid-cols-4 gap-3 mt-3" method="get">
          <label className="text-sm block">
            Group
            <select className="select mt-1" name="group" defaultValue={selectedGroup}>
              <option value="">All groups</option>
              {groupOptions.map((group) => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          </label>
          <label className="text-sm block">
            Subgroup
            <select className="select mt-1" name="subgroup" defaultValue={selectedSubgroup}>
              <option value="">All subgroups</option>
              {subgroupOptions.map((subgroup) => (
                <option key={subgroup} value={subgroup}>{subgroup}</option>
              ))}
            </select>
          </label>
          <label className="text-sm block">
            Exercise
            <select className="select mt-1" name="exercise" defaultValue={selectedExerciseId}>
              <option value="">All exercises</option>
              {exerciseOptions.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>{exercise.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm block">
            Archetype
            <select className="select mt-1" name="archetype" defaultValue={selectedArchetype}>
              <option value="">All archetypes</option>
              {archetypeOptions.map((archetype) => (
                <option key={archetype} value={archetype}>{archetype}</option>
              ))}
            </select>
          </label>
          <label className="text-sm block md:col-span-4">
            Search by name
            <input className="input mt-1" type="text" name="search" placeholder="Type to filter by name..." defaultValue={selectedSearch} />
          </label>
          <div className="md:col-span-4">
            <button className="btn btn-primary" type="submit">Apply Filters</button>
          </div>
        </form>
        <div className="space-y-2 mt-3">
          {sortedGroups.map((group) => (
            <section key={`group-${group}`} className="space-y-2">
              <h3 className="text-lg font-semibold">{group} ({groupedFiltered[group]?.length ?? 0})</h3>
              <div className="space-y-2">
                {(groupedFiltered[group] ?? []).map((exercise) => {
            const isEditing = currentEditId === exercise.id;
            return (
            <details key={exercise.id} className="metric p-3" open={isEditing}>
              <summary className="cursor-pointer list-none">
              {(() => {
                const exerciseVideos = videosByExercise.get(exercise.id) ?? [];
                const latestVideo = exerciseVideos[0];
                const missingFields = [
                  !exercise.category ? "category" : null,
                  !exercise.exercise_group || exercise.exercise_group === "Needs Setup" ? "group/type" : null,
                  !exercise.exercise_subgroup ? "subgroup" : null,
                  !exercise.structural_goal ? "structural goal" : null,
                  !exercise.cues ? "cues" : null,
                  !exercise.purpose_impact ? "purpose/impact" : null,
                  !exercise.where_to_feel ? "where to feel" : null,
                  !exercise.dos_examples ? "do examples" : null,
                  !exercise.donts_examples ? "don't examples" : null,
                  exerciseVideos.length === 0 ? "sample video" : null,
                  exerciseVideos.length > 0 && latestVideo?.ts_top_seconds == null ? "top timestamp" : null,
                  exerciseVideos.length > 0 && latestVideo?.ts_middle_seconds == null ? "middle timestamp" : null,
                  exerciseVideos.length > 0 && latestVideo?.ts_bottom_seconds == null ? "bottom timestamp" : null
                ].filter(Boolean) as string[];

                return (
                  <>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="font-semibold">{exercise.name} ({exercise.exercise_group})</p>
                      <div className="flex items-center gap-2">
                        {sampleSavedForId === exercise.id && (
                          <span className="badge text-green-700">✓ Sample saved</span>
                        )}
                        {searchParams?.deleted === exercise.id && (
                          <span className="badge text-green-700">✓ Deleted</span>
                        )}
                        <form action={deleteExercise}>
                          <input type="hidden" name="exercise_id" value={exercise.id} />
                          <button className="badge" type="submit" title="Delete exercise" aria-label="Delete exercise">
                            🗑️
                          </button>
                        </form>
                        <a
                          href={isEditing ? "/coach/exercises" : `/coach/exercises?edit=${exercise.id}`}
                          className="badge"
                        >
                          {isEditing ? "Done" : "Edit"}
                        </a>
                      </div>
                    </div>
                    {!!missingFields.length && (
                      <p className="text-xs text-red-700 mt-1">
                        Missing info: {missingFields.join(", ")}
                      </p>
                    )}
                    {!missingFields.length && <p className="text-xs text-green-700 mt-1">Complete</p>}
                    {latestVideo?.loom_url && (
                      <p className="text-xs meta mt-1 truncate">Latest sample: {latestVideo.loom_url}</p>
                    )}
                  </>
                );
              })()}
              </summary>
              <div className="mt-3 space-y-3">
              {(() => {
                const exerciseVideos = videosByExercise.get(exercise.id) ?? [];
                const latestVideo = exerciseVideos[0];
                const infoRows = [
                  { label: "Name", value: exercise.name, missing: !exercise.name },
                  { label: "Category", value: exercise.category, missing: !exercise.category },
                  { label: "Group/type", value: exercise.exercise_group, missing: !exercise.exercise_group || exercise.exercise_group === "Needs Setup" },
                  { label: "Subgroup", value: exercise.exercise_subgroup, missing: !exercise.exercise_subgroup },
                  { label: "Structural goal", value: exercise.structural_goal, missing: !exercise.structural_goal },
                  { label: "Cues", value: exercise.cues, missing: !exercise.cues },
                  { label: "Purpose/impact", value: exercise.purpose_impact, missing: !exercise.purpose_impact },
                  { label: "Where to feel", value: exercise.where_to_feel, missing: !exercise.where_to_feel },
                  { label: "Do examples", value: exercise.dos_examples, missing: !exercise.dos_examples },
                  { label: "Don't examples", value: exercise.donts_examples, missing: !exercise.donts_examples },
                  { label: "Sample video", value: latestVideo?.loom_url ?? null, missing: exerciseVideos.length === 0 },
                  { label: "Top timestamp", value: latestVideo?.ts_top_seconds != null ? `${latestVideo.ts_top_seconds}s` : null, missing: exerciseVideos.length > 0 && latestVideo?.ts_top_seconds == null },
                  { label: "Middle timestamp", value: latestVideo?.ts_middle_seconds != null ? `${latestVideo.ts_middle_seconds}s` : null, missing: exerciseVideos.length > 0 && latestVideo?.ts_middle_seconds == null },
                  { label: "Bottom timestamp", value: latestVideo?.ts_bottom_seconds != null ? `${latestVideo.ts_bottom_seconds}s` : null, missing: exerciseVideos.length > 0 && latestVideo?.ts_bottom_seconds == null }
                ];

                return (
                  <div className="grid md:grid-cols-2 gap-2 text-sm">
                    {infoRows.map((row) => {
                      const isMissingValue =
                        row.missing || row.value === null || row.value === undefined || String(row.value).trim() === "";
                      return (
                        <p key={`${exercise.id}-${row.label}`} className="text-slate-800">
                          <span className="meta">{row.label}:</span>{" "}
                          {isMissingValue ? (
                            <span className="text-red-700 font-medium">Missing</span>
                          ) : (
                            row.value
                          )}
                        </p>
                      );
                    })}
                  </div>
                );
              })()}
              {(() => {
                const exerciseVideos = videosByExercise.get(exercise.id) ?? [];
                const latestVideo = exerciseVideos[0];
                if (!latestVideo?.loom_url) return null;

                return (
                  <details className="metric p-3" open={false}>
                    <summary className="cursor-pointer list-none">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-sm font-semibold">Saved Sample (latest)</p>
                        <span className="badge">highlighted</span>
                      </div>
                      <p className="text-xs mt-1 truncate">
                        <a className="plain-link" href={latestVideo.loom_url} target="_blank">
                          {latestVideo.loom_url}
                        </a>
                      </p>
                    </summary>
                    <div className="mt-3 grid md:grid-cols-3 gap-2">
                      {([
                        { key: "top", label: "Top frame", ts: latestVideo.ts_top_seconds },
                        { key: "middle", label: "Middle frame", ts: latestVideo.ts_middle_seconds },
                        { key: "bottom", label: "Bottom frame", ts: latestVideo.ts_bottom_seconds }
                      ] as const).map((item) => {
                        const storedImageUrl = repPhotoByExerciseAndPosition.get(`${exercise.id}:${item.key}`);
                        if (storedImageUrl) {
                          return (
                            <div key={`${exercise.id}-${item.key}`} className="border rounded-lg p-2 bg-white">
                              <p className="text-xs meta">{item.label}</p>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={storedImageUrl}
                                alt={`${exercise.name} ${item.label}`}
                                className="w-full h-32 object-contain rounded mt-1 bg-slate-50"
                              />
                              <p className="text-xs mt-1">Timestamp: {typeof item.ts === "number" ? `${item.ts.toFixed(1)}s` : "-"}</p>
                              <a className="text-xs underline text-blue-700 mt-1 inline-block" href={storedImageUrl} target="_blank">
                                Open captured image
                              </a>
                            </div>
                          );
                        }

                        return (
                          <TimestampFramePreview
                            key={`${exercise.id}-${item.key}`}
                            videoUrl={latestVideo.loom_url}
                            timestampSeconds={item.ts}
                            label={item.label}
                          />
                        );
                      })}
                    </div>
                  </details>
                );
              })()}
              {/* Feedback history: shows all notes this coach has given for this exercise across all athletes */}
              {(coachFeedbackByExercise.get(exercise.id) ?? []).length > 0 && (
                <div className="mt-3 border-t pt-3">
                  <h4 className="text-sm font-semibold mb-2">
                    Feedback Given ({coachFeedbackByExercise.get(exercise.id)!.length} note{coachFeedbackByExercise.get(exercise.id)!.length !== 1 ? "s" : ""})
                  </h4>
                  <div className="space-y-2">
                    {(coachFeedbackByExercise.get(exercise.id) ?? []).map((entry, i) => (
                      <div key={i} className="metric p-2 text-sm">
                        {/* Date and score for quick reference */}
                        <p className="meta text-xs">
                          {entry.date ? new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                          {entry.score != null ? ` · Score: ${entry.score}/5` : ""}
                        </p>
                        {entry.text && <p className="mt-1">{entry.text}</p>}
                        {entry.notes && <p className="meta mt-1">{entry.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isEditing && (
                <div className="metric p-3 space-y-3">
                  {searchParams?.edit === exercise.id && searchParams?.sample_saved === "1" && (
                    <p className="text-xs text-green-700">Sample video and timestamps saved.</p>
                  )}
                  {searchParams?.edit === exercise.id && searchParams?.sample_warning === "frame_capture_unavailable" && (
                    <p className="text-xs text-amber-700">
                      Screenshot capture unavailable for this link. Saved video/timestamps only.
                      {searchParams?.sample_debug ? ` (debug: ${searchParams.sample_debug})` : ""}
                    </p>
                  )}
                  {searchParams?.edit === exercise.id && !!searchParams?.sample_error && (
                    <p className="text-xs text-red-700">
                      Save failed:{" "}
                      {searchParams.sample_error === "missing_exercise" && "exercise not selected."}
                      {searchParams.sample_error === "missing_video" && "provide one uploaded or loaded video link."}
                      {searchParams.sample_error === "duration_limit" && "video is longer than 3 minutes."}
                      {searchParams.sample_error === "reference_insert_failed" && "could not save video reference row."}
                      {searchParams.sample_error === "asset_insert_failed" && "could not save video asset row."}
                      {searchParams.sample_error === "rep_photo_failed" && "could not save timestamp screenshot(s)."}
                      {!["missing_exercise", "missing_video", "duration_limit", "reference_insert_failed", "asset_insert_failed", "rep_photo_failed"].includes(searchParams.sample_error) &&
                        "unexpected error."}
                    </p>
                  )}
                  <form action={updateExercise} className="grid md:grid-cols-2 gap-2">
                    <input type="hidden" name="exercise_id" value={exercise.id} />
                    <label className="text-sm block">Exercise name
                      <input className="input mt-1" name="name" defaultValue={exercise.name} required />
                    </label>
                    <label className="text-sm block">Category
                      <input className="input mt-1" name="category" defaultValue={exercise.category ?? ""} required />
                    </label>
                    <label className="text-sm block">Group/type
                      <input className="input mt-1" name="exercise_group" defaultValue={exercise.exercise_group ?? ""} required />
                    </label>
                    <label className="text-sm block">Subgroup
                      <input className="input mt-1" name="exercise_subgroup" defaultValue={exercise.exercise_subgroup ?? ""} />
                    </label>
                    <label className="text-sm block md:col-span-2">Structural goal
                      <input className="input mt-1" name="structural_goal" defaultValue={exercise.structural_goal ?? ""} />
                    </label>
                    <label className="text-sm block md:col-span-2">Cues
                      <input className="input mt-1" name="cues" defaultValue={exercise.cues ?? ""} />
                    </label>
                    <label className="text-sm block md:col-span-2">Purpose/impact
                      <input className="input mt-1" name="purpose_impact" defaultValue={exercise.purpose_impact ?? ""} />
                    </label>
                    <label className="text-sm block md:col-span-2">Where to feel
                      <input className="input mt-1" name="where_to_feel" defaultValue={exercise.where_to_feel ?? ""} />
                    </label>
                    <label className="text-sm block md:col-span-2">Do examples
                      <textarea className="textarea mt-1" name="dos_examples" defaultValue={exercise.dos_examples ?? ""} />
                    </label>
                    <label className="text-sm block md:col-span-2">Don&apos;t examples
                      <textarea className="textarea mt-1" name="donts_examples" defaultValue={exercise.donts_examples ?? ""} />
                    </label>
                    <button className="btn btn-secondary md:col-span-2" type="submit">Save Exercise Details</button>
                  </form>

                  <div>
                    <h3 className="text-base font-semibold">Sample Video Source (1 file or 1 link)</h3>
                    {(() => {
                      const latestVideo = (videosByExercise.get(exercise.id) ?? [])[0];
                      return (
                    <ExerciseSampleUploadForm
                      fixedExerciseId={exercise.id}
                      initialVideoUrl={latestVideo?.loom_url ?? ""}
                      initialTopTs={latestVideo?.ts_top_seconds ?? null}
                      initialMiddleTs={latestVideo?.ts_middle_seconds ?? null}
                      initialBottomTs={latestVideo?.ts_bottom_seconds ?? null}
                      exercises={(exercises ?? []).map((item) => ({
                        id: item.id,
                        name: item.name,
                        category: item.category,
                        exercise_group: item.exercise_group,
                        exercise_subgroup: item.exercise_subgroup,
                        structural_goal: item.structural_goal,
                        cues: item.cues,
                        purpose_impact: item.purpose_impact,
                        where_to_feel: item.where_to_feel,
                        dos_examples: item.dos_examples,
                        donts_examples: item.donts_examples
                      }))}
                      action={addReferenceVideo}
                    />
                      );
                    })()}
                  </div>
                </div>
              )}
              </div>
            </details>
          );
        })}
              </div>
            </section>
          ))}
          {!sortedGroups.length && <p className="meta text-sm">No exercises match current filters.</p>}
        </div>
      </section>
    </main>
  );
}

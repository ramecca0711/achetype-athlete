/**
 * AUTO-DOC: File overview
 * Purpose: Next.js route page for `/coach/clients`.
 * Related pages/files:
 * - `lib/supabase/server.ts`
 * - `lib/loom.ts`
 * - `components/program-load-form.tsx`
 * - `app/layout.tsx`
 * - `components/right-sidebar.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";
import { fetchLoomTranscriptSummary } from "@/lib/loom";
import ProgramLoadForm from "@/components/program-load-form";

export const runtime = "nodejs";

function parseTrainerizeContext(url: string): { workoutPlanId?: string; userId?: string } {
  const workoutPlanId = url.match(/workoutPlanID=(\d+)/i)?.[1];
  const userId = url.match(/userID=(\d+)/i)?.[1];
  return { workoutPlanId, userId };
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

type ParsedDay = {
  title: string;
  notes: string | null;
  exercises: string[];
};

function cleanExerciseName(line: string): string {
  return line
    .replace(/^[\-\*\u2022]+\s*/, "")
    .replace(/^\d+[\).\-\s]+/, "")
    .trim();
}

function parseProgramStructure(raw: string): ParsedDay[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const dayHeaderRegex =
    /^(day\s*\d+|week\s*\d+\s*day\s*\d+|week\s*\d+|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;

  const days: ParsedDay[] = [];
  let current: ParsedDay | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const isHeader = dayHeaderRegex.test(line);

    if (isHeader) {
      if (current) days.push(current);
      current = { title: line, notes: null, exercises: [] };
      continue;
    }

    const exercise = cleanExerciseName(line);
    if (!exercise) continue;

    if (!current) current = { title: "Day 1", notes: null, exercises: [] };
    current.exercises.push(exercise);
  }

  if (current) days.push(current);
  return days;
}

function parseTrainerizeProgramStructure(raw: string): ParsedDay[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const headerRegex = /^\d+\s+[A-Za-z][A-Za-z0-9 ,&()\/\-\+]+$/;
  const headerExclude = /(weeks?\s*\(|2\/\d+\/\d+|of\s+\d+|minutes?|regular workout|tracking sheet|exercise name)/i;
  const noiseRegex =
    /^(format:|print$|dismiss$|previous stats$|exercise$|instructions$|repeat new set$|rest for\b|superset of\b|notes on following segment:|▶+)$/i;

  const dayMap = new Map<string, ParsedDay>();
  let currentKey = "";

  const ensureDay = (title: string) => {
    const key = title.toLowerCase();
    if (!dayMap.has(key)) {
      dayMap.set(key, { title: `Day ${dayMap.size + 1} - ${title}`, notes: null, exercises: [] });
    }
    currentKey = key;
  };

  for (const line of lines) {
    if (noiseRegex.test(line)) continue;
    if (line.startsWith("http")) continue;
    if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(line)) continue;
    if (/^\d+\/\d+$/.test(line)) continue;

    if (headerRegex.test(line) && !headerExclude.test(line) && line.length <= 60) {
      ensureDay(line);
      continue;
    }

    if (!currentKey) continue;

    let candidate = line;
    if (line.includes("\t")) {
      candidate = line.split("\t")[0]?.trim() ?? line;
    } else if (line.includes(" reps x ")) {
      candidate = line.split(" reps x ")[0]?.trim() ?? line;
    }

    candidate = cleanExerciseName(candidate);

    if (!candidate) continue;
    if (candidate.length < 3 || candidate.length > 90) continue;
    if (/^(name|date|set\s*\d+|reps?|lbs?|kg|previous stats)$/i.test(candidate)) continue;
    if (!/[a-z]/i.test(candidate)) continue;
    if (/(created by|last updated|short on time\?|in this phase|the stack|tracking sheet|exercise name)/i.test(candidate)) continue;

    const day = dayMap.get(currentKey);
    if (!day) continue;
    if (!day.exercises.some((existing) => existing.toLowerCase() === candidate.toLowerCase())) {
      day.exercises.push(candidate);
    }
  }

  return Array.from(dayMap.values()).filter((day) => day.exercises.length > 0);
}

function extractExerciseNamesFromText(raw: string): string[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => cleanExerciseName(line))
    .filter(Boolean);
  const dayHeaderRegex =
    /^(day\s*\d+|week\s*\d+\s*day\s*\d+|week\s*\d+|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
  const noiseRegex =
    /^(page\s*\d+|notes?|rest|warm[\s-]?up|cool[\s-]?down|tempo|sets?|reps?|lbs?|kg|%|minutes?|seconds?)$/i;

  const candidates = lines.filter((line) => {
    if (dayHeaderRegex.test(line)) return false;
    if (noiseRegex.test(line)) return false;
    if (!/[a-z]/i.test(line)) return false;
    if (line.length < 3 || line.length > 90) return false;
    return true;
  });

  return dedupe(candidates);
}

async function extractPdfTextFromBuffer(buffer: Buffer): Promise<string> {
  const pdfParseImport = await import("pdf-parse");
  const pdfParse = ((pdfParseImport as any).default ?? pdfParseImport) as (data: Buffer) => Promise<{ text?: string }>;
  const parsed = await pdfParse(buffer);
  return (parsed?.text ?? "").trim();
}

function inferProgramImportPathFromUrl(sourcePdfUrl: string): string {
  const marker = "/storage/v1/object/public/program-imports/";
  const idx = sourcePdfUrl.indexOf(marker);
  if (idx < 0) return "";
  const raw = sourcePdfUrl.slice(idx + marker.length);
  const path = raw.split("?")[0] ?? "";
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

async function extractPdfTextFromSource(
  sb: ReturnType<typeof createSupabaseServer>,
  sourcePdfPath: string,
  sourcePdfUrl: string
): Promise<string> {
  const parseAttempts: string[] = [];
  const resolvedPath = sourcePdfPath || inferProgramImportPathFromUrl(sourcePdfUrl);

  if (resolvedPath) {
    const { data, error } = await sb.storage.from("program-imports").download(resolvedPath);
    if (!error && data) {
      try {
        const parsed = await extractPdfTextFromBuffer(Buffer.from(await data.arrayBuffer()));
        if (parsed) return parsed;
        parseAttempts.push("storage-buffer-empty");
      } catch (error) {
        parseAttempts.push(
          `storage-buffer-failed:${error instanceof Error ? error.message.slice(0, 50) : "unknown"}`
        );
      }
    } else {
      parseAttempts.push(
        `storage-download-failed:${error?.message?.slice(0, 50) ?? "unknown"}`
      );
    }
  }

  if (sourcePdfUrl) {
    try {
      const response = await fetch(sourcePdfUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to download PDF (${response.status})`);
      }
      const parsedFromFetch = await extractPdfTextFromBuffer(Buffer.from(await response.arrayBuffer()));
      if (parsedFromFetch) return parsedFromFetch;
      parseAttempts.push("url-fetch-empty");
    } catch (error) {
      parseAttempts.push(
        `url-fetch-failed:${error instanceof Error ? error.message.slice(0, 50) : "unknown"}`
      );
    }
  }

  throw new Error(`No PDF source available (${parseAttempts.join(",") || "none"})`);
}

export default async function CoachClientsPage({
  searchParams
}: {
  searchParams?: {
    saved?: string;
    save_error?: string;
    loaded?: string;
    source?: string;
    load_error?: string;
    load_warning?: string;
    load_debug?: string;
  };
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

  async function loadProgramSource(formData: FormData) {
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

    const athleteId = String(formData.get("athlete_id") ?? "").trim();
    const sourceType = String(formData.get("source_type") ?? "trainerize_link");
    const sourceUrl = String(formData.get("source_url") ?? "").trim();
    const sourcePdfUrl = String(formData.get("source_pdf_url") ?? "").trim();
    const sourcePdfPath = String(formData.get("source_pdf_path") ?? "").trim();
    const customProgramName = String(formData.get("program_name") ?? "").trim();
    let parsedExerciseNames: string[] = [];
    let parsedDaysFromText: ParsedDay[] = [];
    let extractedPdfText = "";
    let pdfParseFailed = false;
    let pdfParseDebug = "";

    if (!athleteId) redirect("/coach/clients?load_error=missing_athlete");
    if (sourceType === "trainerize_link" && !sourceUrl) redirect(`/coach/clients?load_error=missing_source_url&loaded=${athleteId}`);
    if (sourceType === "pdf_upload" && !sourcePdfUrl) redirect(`/coach/clients?load_error=missing_pdf&loaded=${athleteId}`);

    if (sourceType === "pdf_upload") {
      try {
        extractedPdfText = await extractPdfTextFromSource(sb, sourcePdfPath, sourcePdfUrl);
        parsedDaysFromText = parseTrainerizeProgramStructure(extractedPdfText);
        if (!parsedDaysFromText.length) {
          parsedDaysFromText = parseProgramStructure(extractedPdfText);
        }
        parsedExerciseNames = dedupe(
          parsedDaysFromText.length
            ? parsedDaysFromText.flatMap((day) => day.exercises)
            : extractExerciseNamesFromText(extractedPdfText)
        );
      } catch (error) {
        pdfParseFailed = true;
        pdfParseDebug = error instanceof Error ? error.message.slice(0, 120) : "pdf_extract_failed";
      }
    }

    const { data: relationship } = await sb
      .from("athlete_relationships")
      .select("id")
      .eq("athlete_id", athleteId)
      .eq("coach_id", targetCoachId)
      .maybeSingle();

    if (!relationship) {
      redirect(`/coach/clients?load_error=no_relationship&loaded=${athleteId}`);
    }

    let programName = customProgramName;
    let programSummary = "";
    let firstDayTitle = "Imported Program - Review";
    let firstDayNotes = "Imported from external source. Review and complete day-by-day structure.";
    let sourceCopyLines: string[] = [];

    if (sourceType === "trainerize_link") {
      const ctx = parseTrainerizeContext(sourceUrl);
      programName = programName || `Trainerize Plan ${ctx.workoutPlanId ?? ""}`.trim();
      sourceCopyLines = [
        "Program copy from uploaded source",
        "Source type: Trainerize link",
        `Source URL: ${sourceUrl}`,
        ctx.workoutPlanId ? `workoutPlanID: ${ctx.workoutPlanId}` : "",
        ctx.userId ? `userID: ${ctx.userId}` : "",
        "Auto-parsing from Trainerize link is limited; exercises may need manual coach add."
      ].filter(Boolean);
      programSummary = sourceCopyLines.join("\n");
      firstDayNotes = "Loaded from Trainerize source. Confirm imported structure and add exercises.";
    } else {
      programName = programName || "PDF Imported Program";
      sourceCopyLines = [
        "Program copy from uploaded source",
        "Source type: PDF upload",
        `Source file: ${sourcePdfUrl}`,
        pdfParseFailed ? "PDF text parse failed; loaded source-only shell for manual coach completion." : "",
        parsedDaysFromText.length ? `Detected ${parsedDaysFromText.length} day sections from PDF.` : "No day sections detected from PDF.",
        parsedExerciseNames.length ? `Extracted ${parsedExerciseNames.length} exercise names from PDF.` : "No exercise names detected from PDF.",
        ...parsedExerciseNames.slice(0, 30).map((name) => `- ${name}`)
      ].filter(Boolean);
      programSummary = sourceCopyLines.join("\n");
      firstDayNotes = "Loaded from uploaded PDF. Confirm plan details and add exercises.";
    }

    const { data: program } = await sb
      .from("programs")
      .insert({
        athlete_id: athleteId,
        coach_id: targetCoachId,
        name: programName,
        summary: programSummary
      })
      .select("id")
      .single();

    if (program?.id) {
      const daysToCreate: ParsedDay[] =
        parsedDaysFromText.length > 0
          ? parsedDaysFromText
          : [
              {
                title: firstDayTitle,
                notes: firstDayNotes,
                exercises: parsedExerciseNames
              }
            ];

      const { data: existingExercises } = await sb.from("exercises").select("id, name");
      const existingByLower = new Map(
        (existingExercises ?? []).map((exercise) => [exercise.name.trim().toLowerCase(), exercise])
      );

      async function resolveExerciseIds(names: string[]): Promise<string[]> {
        const resolvedIds: string[] = [];

        for (const exerciseName of names) {
          const key = exerciseName.toLowerCase();
          const existing = existingByLower.get(key);

          if (existing?.id) {
            resolvedIds.push(existing.id);
            continue;
          }

          const { data: inserted } = await sb
            .from("exercises")
            .insert({
              name: exerciseName,
              exercise_group: "Needs Setup",
              cues: null,
              purpose_impact: null,
              where_to_feel: null,
              dos_examples: null,
              donts_examples: null
            })
            .select("id, name")
            .single();

          if (inserted?.id) {
            existingByLower.set(inserted.name.trim().toLowerCase(), inserted);
            resolvedIds.push(inserted.id);
          }
        }

        return resolvedIds;
      }

      for (let dayIndex = 0; dayIndex < daysToCreate.length; dayIndex += 1) {
        const dayDef = daysToCreate[dayIndex];
        const { data: day } = await sb
          .from("program_days")
          .insert({
            program_id: program.id,
            day_index: dayIndex + 1,
            title: dayDef.title || `Day ${dayIndex + 1}`,
            notes: dayDef.notes ?? (dayIndex === 0 ? firstDayNotes : null)
          })
          .select("id")
          .single();

        if (!day?.id) continue;

        const dayExerciseNames =
          dayDef.exercises.length > 0
            ? dayDef.exercises
            : dayIndex === 0
              ? parsedExerciseNames
              : [];
        const resolvedIds = await resolveExerciseIds(dayExerciseNames);

        for (let i = 0; i < resolvedIds.length; i += 1) {
          await sb.from("program_day_exercises").insert({
            program_day_id: day.id,
            exercise_id: resolvedIds[i],
            position: i + 1,
            prescription: "reps_weight"
          });
        }
      }
    }

    redirect(
      `/coach/clients?loaded=${athleteId}&source=${encodeURIComponent(sourceType)}${
        pdfParseFailed ? `&load_warning=pdf_parse_failed&load_debug=${encodeURIComponent(pdfParseDebug)}` : ""
      }`
    );
  }

  async function savePostureFeedback(formData: FormData) {
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

    const athleteId = String(formData.get("athlete_id") ?? "").trim();
    const loomUrl = String(formData.get("posture_feedback_loom_url") ?? "").trim();
    if (!athleteId) redirect("/coach/clients");

    const { data: relationship } = await sb
      .from("athlete_relationships")
      .select("id")
      .eq("athlete_id", athleteId)
      .eq("coach_id", targetCoachId)
      .maybeSingle();
    if (!relationship) redirect("/coach/clients");

    const insights = loomUrl
      ? (await fetchLoomTranscriptSummary(loomUrl))
        ?? "Transcript unavailable automatically for this Loom link."
      : null;

    const { error } = await sb
      .from("profiles")
      .update({
        posture_feedback_loom_url: loomUrl || null,
        posture_feedback_insights: insights
      })
      .eq("id", athleteId);

    if (error) {
      redirect(`/coach/clients?save_error=update_failed&saved=${athleteId}`);
    }

    redirect(`/coach/clients?saved=${athleteId}`);
  }

  const { data: links } = await supabase
    .from("athlete_relationships")
    .select(
      "athlete:profiles!athlete_relationships_athlete_id_fkey(id, full_name, email, member_since, training_experience, weekly_training_days, gender, age, height_inches, weight_lbs, onboarding_completed, posture_photos_required, posture_feedback_loom_url, posture_feedback_insights)"
    )
    .eq("coach_id", scopedCoachId);

  const athletes = (links ?? [])
    .map((row: any) => (Array.isArray(row.athlete) ? row.athlete[0] : row.athlete))
    .filter(Boolean);

  const athleteIds = athletes.map((a: any) => a.id);

  const { data: requests } = athleteIds.length
    ? await supabase
        .from("review_requests")
        .select("id, athlete_id, status")
        .in("athlete_id", athleteIds)
    : { data: [] as any[] };

  const metrics = new Map<string, { open: number; closed: number }>();
  for (const athlete of athletes) {
    metrics.set(athlete.id, { open: 0, closed: 0 });
  }
  for (const request of requests ?? []) {
    const cur = metrics.get(request.athlete_id);
    if (!cur) continue;
    if (request.status === "resolved") cur.closed += 1;
    else cur.open += 1;
  }

  return (
    <main className="shell space-y-4">
      <section className="card p-6">
        <p className="badge inline-block">Coach - Client Profiles / Dashboard</p>
        <h1 className="text-3xl mt-3">Clients Dashboard</h1>
      </section>

      <section className="card p-6">
        <div className="space-y-2">
          {athletes.map((athlete: any) => {
            const m = metrics.get(athlete.id) ?? { open: 0, closed: 0 };
            return (
              <details key={athlete.id} className="border rounded-xl p-3 bg-white" open={false}>
                <summary className="cursor-pointer list-none">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-semibold">{athlete.full_name}</p>
                      <p className="text-sm meta">{athlete.email}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <span className="badge">Open {m.open}</span>
                      <span className="badge">Closed {m.closed}</span>
                    </div>
                  </div>
                </summary>

                <div className="mt-3">
                  <p className="text-xs meta mt-1">Member since: {athlete.member_since ?? "-"}</p>

                  <div className="grid md:grid-cols-3 gap-2 mt-3 text-sm">
                    <p><span className="meta">Training experience:</span> {athlete.training_experience ?? "Not set"}</p>
                    <p><span className="meta">Weekly training days:</span> {athlete.weekly_training_days ?? "Not set"}</p>
                    <p><span className="meta">Gender:</span> {athlete.gender ?? "Not set"}</p>
                    <p><span className="meta">Age:</span> {athlete.age ?? "Not set"}</p>
                    <p><span className="meta">Height (in):</span> {athlete.height_inches ?? "Not set"}</p>
                    <p><span className="meta">Weight (lbs):</span> {athlete.weight_lbs ?? "Not set"}</p>
                  </div>

                  <div className="flex gap-2 flex-wrap mt-3">
                    <span className="badge">
                      Onboarding {athlete.onboarding_completed ? "complete" : "incomplete"}
                    </span>
                    <span className="badge">
                      Photos {athlete.posture_photos_required ? "needed" : "complete"}
                    </span>
                  </div>

                  <form action={savePostureFeedback} className="mt-4 border rounded-lg p-3 bg-slate-50 space-y-2">
                    <input type="hidden" name="athlete_id" value={athlete.id} />
                    <label className="text-sm block">
                      Posture Feedback Loom Link
                      <input
                        className="input mt-1"
                        type="url"
                        name="posture_feedback_loom_url"
                        defaultValue={athlete.posture_feedback_loom_url ?? ""}
                        placeholder="https://www.loom.com/share/..."
                      />
                    </label>
                    <div className="flex items-center gap-2">
                      <button className="btn btn-primary" type="submit">Submit Posture Feedback</button>
                      {searchParams?.saved === athlete.id && !searchParams?.save_error && <span className="badge">✓ Saved</span>}
                      {searchParams?.saved === athlete.id && searchParams?.save_error === "update_failed" && (
                        <span className="text-xs text-red-700">Save failed. Check DB policy/connection and retry.</span>
                      )}
                    </div>
                  </form>

                  <div className="mt-4 border rounded-lg p-3 bg-slate-50">
                    <h3 className="text-lg">Load Program</h3>
                    <ProgramLoadForm
                      fixedAthleteId={athlete.id}
                      fixedAthleteLabel={`${athlete.full_name} (${athlete.email})`}
                      action={loadProgramSource}
                    />
                    {searchParams?.loaded === athlete.id && searchParams?.source && !searchParams?.load_error && (
                      <p className="text-xs text-green-700 mt-2">
                        Program loaded from {searchParams.source === "pdf_upload" ? "PDF upload" : "Trainerize link"}.
                      </p>
                    )}
                    {searchParams?.loaded === athlete.id && searchParams?.load_warning === "pdf_parse_failed" && (
                      <p className="text-xs text-amber-700 mt-2">
                        PDF text parsing was limited. Program shell loaded; fill missing details in exercise database/client profile.
                        {searchParams?.load_debug ? ` (debug: ${searchParams.load_debug})` : ""}
                      </p>
                    )}
                    {searchParams?.loaded === athlete.id && !!searchParams?.load_error && (
                      <p className="text-xs text-red-700 mt-2">
                        Load failed:{" "}
                        {searchParams.load_error === "missing_athlete" && "select athlete first."}
                        {searchParams.load_error === "missing_source_url" && "add a Trainerize source link."}
                        {searchParams.load_error === "missing_pdf" && "upload a PDF first."}
                        {searchParams.load_error === "no_relationship" && "athlete is not assigned to this coach."}
                        {!["missing_athlete", "missing_source_url", "missing_pdf", "no_relationship"].includes(searchParams.load_error) &&
                          "unexpected error."}
                      </p>
                    )}
                  </div>
                </div>
              </details>
            );
          })}
          {!athletes.length && <p className="meta">No clients linked yet.</p>}
        </div>
      </section>
    </main>
  );
}

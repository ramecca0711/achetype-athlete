/**
 * AUTO-DOC: File overview
 * Purpose: Next.js route page for `/athlete/exercises`.
 * Related pages/files:
 * - `lib/supabase/server.ts`
 * - `app/layout.tsx`
 * - `components/right-sidebar.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";

function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|mov|m4v|webm|ogg)(\?|$)/i.test(url) || /\/storage\/v1\/object\/public\//i.test(url);
}

function parseYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.replace("/", "").trim() || null;
    if (parsed.hostname.includes("youtube.com")) {
      const v = parsed.searchParams.get("v");
      if (v) return v;
      const parts = parsed.pathname.split("/").filter(Boolean);
      const shortsIndex = parts.findIndex((p) => p === "shorts");
      if (shortsIndex >= 0 && parts[shortsIndex + 1]) return parts[shortsIndex + 1];
      const embedIndex = parts.findIndex((p) => p === "embed");
      if (embedIndex >= 0 && parts[embedIndex + 1]) return parts[embedIndex + 1];
    }
  } catch {
    return null;
  }
  return null;
}

function toEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("loom.com")) {
      const parts = parsed.pathname.split("/").filter(Boolean);
      const shareId = parts[parts.length - 1] ?? "";
      if (shareId) return `https://www.loom.com/embed/${shareId}`;
    }
    const youtubeId = parseYouTubeId(url);
    if (youtubeId) return `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0`;
  } catch {
    return null;
  }
  return null;
}

function getArchetypeFilterValue(structuralGoal: string | null | undefined): string {
  const value = String(structuralGoal ?? "").toUpperCase();
  if (value.includes("ARCHETYPE A")) return "A";
  if (value.includes("ARCHETYPE V")) return "V";
  if (value.includes("ARCHETYPE H")) return "H";
  if (value.includes("NARROW ISA")) return "NARROW ISA";
  if (value.includes("WIDE ISA")) return "WIDE ISA";
  return value.trim() ? "OTHER" : "";
}

export default async function AthleteExercisesPage({
  searchParams
}: {
  searchParams?: { group?: string; subgroup?: string; exercise?: string; archetype?: string };
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

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", scopedAthleteId).maybeSingle();
  if (profile?.role !== "athlete" && me?.role !== "admin") redirect("/");

  const refQuery = supabase
    .from("exercise_reference_videos")
    .select("id, exercise_id, loom_url, audience, feedback_category, cue_notes")
    .order("created_at", { ascending: false });

  const [{ data: exercises }, { data: references }, { data: assets }] = await Promise.all([
    supabase
      .from("exercises")
      .select("id, name, category, exercise_group, exercise_subgroup, structural_goal, cues, purpose_impact, where_to_feel, dos_examples, donts_examples")
      .order("name", { ascending: true }),
    refQuery,
    supabase
      .from("exercise_reference_video_assets")
      .select("reference_video_id, video_url, position, duration_seconds")
      .order("position", { ascending: true })
  ]);

  const referencesByExercise = new Map<string, any[]>();
  for (const ref of references ?? []) {
    if (referencesByExercise.has(ref.exercise_id)) continue;
    referencesByExercise.set(ref.exercise_id, [ref]);
  }
  const assetsByReference = new Map<string, any[]>();
  for (const asset of assets ?? []) {
    const existing = assetsByReference.get(asset.reference_video_id) ?? [];
    existing.push(asset);
    assetsByReference.set(asset.reference_video_id, existing);
  }
  const exerciseIds = (exercises ?? []).map((item) => item.id);
  const [{ data: repPhotos }] = await Promise.all([
    exerciseIds.length
      ? supabase
          .from("exercise_rep_photos")
          .select("exercise_id, photo_position, image_url, created_at")
          .in("exercise_id", exerciseIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as any[] })
  ]);
  const samplePhotoByExerciseAndPosition = new Map<string, string>();
  for (const row of repPhotos ?? []) {
    const key = `${row.exercise_id}:${row.photo_position}`;
    if (!samplePhotoByExerciseAndPosition.has(key)) {
      samplePhotoByExerciseAndPosition.set(key, row.image_url);
    }
  }

  const allExercises = exercises ?? [];
  const allGroups = Array.from(
    new Set(
      allExercises
        .map((exercise) => (exercise.exercise_group ?? "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
  const selectedGroup = (searchParams?.group ?? "").trim();
  const groupScopedExercises = selectedGroup
    ? allExercises.filter((exercise) => (exercise.exercise_group ?? "").trim() === selectedGroup)
    : allExercises;
  const subgroupOptions = Array.from(
    new Set(
      groupScopedExercises
        .map((exercise) => (exercise.exercise_subgroup ?? "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
  const selectedSubgroup = (searchParams?.subgroup ?? "").trim();
  const subgroupScopedExercises = selectedSubgroup
    ? groupScopedExercises.filter((exercise) => (exercise.exercise_subgroup ?? "").trim() === selectedSubgroup)
    : groupScopedExercises;
  const archetypeOptions = Array.from(
    new Set(allExercises.map((exercise) => getArchetypeFilterValue(exercise.structural_goal)).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const selectedArchetype = (searchParams?.archetype ?? "").trim().toUpperCase();
  const archetypeScopedExercises = selectedArchetype
    ? subgroupScopedExercises.filter((exercise) => getArchetypeFilterValue(exercise.structural_goal) === selectedArchetype)
    : subgroupScopedExercises;
  const exerciseOptions = archetypeScopedExercises
    .map((exercise) => ({ id: exercise.id, name: exercise.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const selectedExerciseId = (searchParams?.exercise ?? "").trim();
  const filteredExercises = selectedExerciseId
    ? archetypeScopedExercises.filter((exercise) => exercise.id === selectedExerciseId)
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
        <p className="badge inline-block">Athlete - Exercise Database</p>
        <h1 className="text-3xl mt-3">Exercise Database (View Only)</h1>

        <form className="grid md:grid-cols-4 gap-3 mt-4" method="get">
          <label className="text-sm block">
            Group
            <select className="select mt-1" name="group" defaultValue={selectedGroup}>
              <option value="">All groups</option>
              {allGroups.map((group) => (
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
          <div className="md:col-span-4">
            <button className="btn btn-primary" type="submit">Apply Filters</button>
          </div>
        </form>
      </section>

      {sortedGroups.map((group) => (
        <section key={`group-${group}`} className="card p-6">
          <h2 className="text-2xl">{group} ({groupedFiltered[group]?.length ?? 0})</h2>
          <div className="mt-3 space-y-3">
      {(groupedFiltered[group] ?? []).map((exercise) => {
        const refs = referencesByExercise.get(exercise.id) ?? [];
        return (
          <details key={exercise.id} className="metric p-3" open={false}>
            <summary className="cursor-pointer list-none">
              <h3 className="text-xl">{exercise.name}</h3>
            </summary>
            <div className="mt-2">
            <p className="meta">Category: {exercise.category ?? <span className="text-red-700">Missing</span>}</p>
            <p className="meta">Group: {exercise.exercise_group}</p>
            <p className="meta">Subgroup: {exercise.exercise_subgroup ?? <span className="text-red-700">Missing</span>}</p>
            <p className="text-sm mt-1"><span className="font-semibold">Structural goal:</span> {exercise.structural_goal ?? <span className="text-red-700">Missing</span>}</p>
            <p className="text-sm mt-2"><span className="font-semibold">Cues:</span> {exercise.cues ?? <span className="text-red-700">Missing</span>}</p>
            <p className="text-sm mt-1"><span className="font-semibold">Where to feel:</span> {exercise.where_to_feel ?? <span className="text-red-700">Missing</span>}</p>
            <p className="text-sm mt-1"><span className="font-semibold">Purpose:</span> {exercise.purpose_impact ?? <span className="text-red-700">Missing</span>}</p>
            <p className="text-sm mt-1"><span className="font-semibold">Do:</span> {exercise.dos_examples ?? <span className="text-red-700">Missing</span>}</p>
            <p className="text-sm mt-1"><span className="font-semibold">Don&apos;t:</span> {exercise.donts_examples ?? <span className="text-red-700">Missing</span>}</p>
            <div className="mt-3 space-y-2">
              {refs.map((ref) => (
                <div key={ref.id} className="border rounded-lg p-3 bg-white">
                  <p className="text-sm">
                    <span className="font-semibold">Sample video:</span>{" "}
                    {ref.loom_url ? (
                      <a className="underline text-blue-700" href={ref.loom_url} target="_blank">Open Link</a>
                    ) : (
                      <span className="text-red-700">Missing</span>
                    )}
                  </p>
                  {isDirectVideoUrl(ref.loom_url) ? (
                    <video className="w-full max-h-72 rounded border mt-2 bg-black" controls src={ref.loom_url} />
                  ) : toEmbedUrl(ref.loom_url) ? (
                    <div className="mt-2 rounded border overflow-hidden bg-black">
                      <iframe
                        src={toEmbedUrl(ref.loom_url) ?? ""}
                        className="w-full h-[260px]"
                        allow="autoplay; encrypted-media; picture-in-picture"
                        allowFullScreen
                        title={`${exercise.name} sample video`}
                      />
                    </div>
                  ) : null}
                  <p className="text-xs meta mt-1">Audience: {ref.audience} | Category: {ref.feedback_category ?? "-"}</p>
                  {ref.cue_notes && <p className="text-xs mt-1">{ref.cue_notes}</p>}
                  <p className="text-xs mt-1">
                    Rep frames: top {ref.ts_top_seconds ?? "-"}s, middle {ref.ts_middle_seconds ?? "-"}s, bottom {ref.ts_bottom_seconds ?? "-"}s
                  </p>
                  <div className="grid md:grid-cols-3 gap-2 mt-2">
                    {([
                      { key: "top", label: "Top sample image" },
                      { key: "middle", label: "Middle sample image" },
                      { key: "bottom", label: "Bottom sample image" }
                    ] as const).map((item) => {
                      const photoUrl = samplePhotoByExerciseAndPosition.get(`${exercise.id}:${item.key}`);
                      return (
                        <div key={`${exercise.id}-${ref.id}-${item.key}`} className="border rounded p-2 bg-slate-50">
                          <p className="text-xs meta">{item.label}</p>
                          {photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={photoUrl} alt={`${exercise.name} ${item.label}`} className="w-full h-24 object-contain rounded mt-1 bg-white" />
                          ) : (
                            <div className="w-full h-24 rounded mt-1 bg-white border border-dashed flex items-center justify-center text-xs meta">
                              <span className="text-red-700">Missing</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {(assetsByReference.get(ref.id) ?? []).map((asset: any) => (
                    <p key={`${ref.id}-${asset.position}`} className="text-xs mt-1">
                      Sample clip {asset.position}:{" "}
                      <a className="underline text-blue-700" href={asset.video_url} target="_blank">
                        Open
                      </a>{" "}
                      ({asset.duration_seconds ?? "-"}s)
                    </p>
                  ))}
                </div>
              ))}
              {!refs.length && <p className="text-sm text-red-700">Sample video: Missing</p>}
            </div>
            </div>
          </details>
        );
      })}
          </div>
        </section>
      ))}
      {!sortedGroups.length && (
        <section className="card p-6">
          <p className="meta">No exercises match current filters.</p>
        </section>
      )}
    </main>
  );
}

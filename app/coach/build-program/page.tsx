/**
 * AUTO-DOC: File overview
 * Purpose: Next.js route page for `/coach/build-program`.
 * Related pages/files:
 * - `lib/supabase/server.ts`
 * - `app/layout.tsx`
 * - `components/right-sidebar.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function CoachBuildProgramPage() {
  const supabase = createSupabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

  if (me?.role === "admin") redirect("/admin");
  if (me?.role !== "coach") redirect("/athlete");

  async function createProgram(formData: FormData) {
    "use server";

    const sb = createSupabaseServer();
    const {
      data: { user: actionUser }
    } = await sb.auth.getUser();
    if (!actionUser) redirect("/login");

    const athleteId = String(formData.get("athlete_id") ?? "");
    const programName = String(formData.get("program_name") ?? "").trim();
    const programSummary = String(formData.get("program_summary") ?? "").trim();
    const dayIndex = Number(formData.get("day_index") ?? 1);
    const dayTitle = String(formData.get("day_title") ?? "").trim();
    const dayNotes = String(formData.get("day_notes") ?? "").trim();

    if (!athleteId || !programName || !dayTitle) {
      redirect("/coach/build-program");
    }

    const { data: relationship } = await sb
      .from("athlete_relationships")
      .select("id")
      .eq("athlete_id", athleteId)
      .eq("coach_id", actionUser.id)
      .maybeSingle();

    if (!relationship) {
      redirect("/coach/build-program");
    }

    const { data: program } = await sb
      .from("programs")
      .insert({
        athlete_id: athleteId,
        coach_id: actionUser.id,
        name: programName,
        summary: programSummary || null
      })
      .select("id")
      .single();

    if (program?.id) {
      await sb.from("program_days").insert({
        program_id: program.id,
        day_index: dayIndex,
        title: dayTitle,
        notes: dayNotes || null
      });
    }

    redirect("/coach/build-program");
  }

  async function addExercise(formData: FormData) {
    "use server";

    const sb = createSupabaseServer();
    const {
      data: { user: actionUser }
    } = await sb.auth.getUser();
    if (!actionUser) redirect("/login");

    const dayId = String(formData.get("program_day_id") ?? "");
    const exerciseId = String(formData.get("exercise_id") ?? "");

    if (!dayId || !exerciseId) redirect("/coach/build-program");

    const { data: day } = await sb
      .from("program_days")
      .select("id, program:programs(coach_id)")
      .eq("id", dayId)
      .maybeSingle();

    const dayProgram = Array.isArray(day?.program) ? day.program[0] : day?.program;

    if (!day || dayProgram?.coach_id !== actionUser.id) {
      redirect("/coach/build-program");
    }

    const { data: existing } = await sb
      .from("program_day_exercises")
      .select("position")
      .eq("program_day_id", dayId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const position = (existing?.position ?? 0) + 1;

    await sb.from("program_day_exercises").insert({
      program_day_id: dayId,
      exercise_id: exerciseId,
      position,
      set_count: Number(formData.get("set_count") ?? 0) || null,
      rep_target: String(formData.get("rep_target") ?? "") || null,
      weight_target_lbs: Number(formData.get("weight_target_lbs") ?? 0) || null,
      time_target_seconds: Number(formData.get("time_target_seconds") ?? 0) || null,
      focus: String(formData.get("focus") ?? "") || null,
      personal_notes: String(formData.get("personal_notes") ?? "") || null,
      dos: String(formData.get("dos") ?? "") || null,
      donts: String(formData.get("donts") ?? "") || null,
      prescription: String(formData.get("prescription") ?? "reps_weight")
    });

    redirect("/coach/build-program");
  }

  const [{ data: athletes }, { data: programs }, { data: days }, { data: exercises }] = await Promise.all([
    supabase
      .from("athlete_relationships")
      .select("athlete:profiles!athlete_relationships_athlete_id_fkey(id, full_name, email)")
      .eq("coach_id", user.id),
    supabase
      .from("programs")
      .select("id, name, athlete_id, athlete:profiles!programs_athlete_id_fkey(full_name)")
      .eq("coach_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("program_days")
      .select("id, day_index, title, program:programs!inner(id, coach_id, name)")
      .eq("program.coach_id", user.id)
      .order("day_index", { ascending: true }),
    supabase
      .from("exercises")
      .select("id, name, exercise_group")
      .order("name", { ascending: true })
  ]);

  return (
    <main className="shell space-y-4">
      <section className="card p-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="badge inline-block">Coach Program Builder</p>
          <div className="flex gap-2">
            <Link href="/" className="btn btn-secondary">Home</Link>
            <Link href="/coach/queue" className="btn btn-secondary">Queue</Link>
          </div>
        </div>
        <h1 className="text-3xl mt-3">Build Program</h1>
        <p className="meta mt-1">Create program/day blocks and add exercises with prescription + measurement inputs.</p>
      </section>

      <section className="card p-6">
        <h2 className="text-2xl">1) Create Program + First Day</h2>
        <form action={createProgram} className="grid md:grid-cols-2 gap-3 mt-4">
          <label className="text-sm block">
            Athlete
            <select className="select mt-1" name="athlete_id" required>
              <option value="">Select athlete</option>
              {(athletes ?? []).map((row: any) => {
                const athlete = Array.isArray(row.athlete) ? row.athlete[0] : row.athlete;
                if (!athlete?.id) return null;
                return (
                  <option key={athlete.id} value={athlete.id}>
                    {athlete.full_name} ({athlete.email})
                  </option>
                );
              })}
            </select>
          </label>

          <label className="text-sm block">
            Program Name
            <input className="input mt-1" name="program_name" required />
          </label>

          <label className="text-sm block md:col-span-2">
            Program Summary
            <textarea className="textarea mt-1" name="program_summary" />
          </label>

          <label className="text-sm block">
            Day Number
            <input className="input mt-1" type="number" min={1} name="day_index" defaultValue={1} required />
          </label>

          <label className="text-sm block">
            Day Title
            <input className="input mt-1" name="day_title" placeholder="Day 1 Foundation" required />
          </label>

          <label className="text-sm block md:col-span-2">
            Day Notes
            <textarea className="textarea mt-1" name="day_notes" />
          </label>

          <div className="md:col-span-2">
            <button className="btn btn-primary" type="submit">Create Program</button>
          </div>
        </form>
      </section>

      <section className="card p-6">
        <h2 className="text-2xl">2) Add Exercises to a Day</h2>
        <form action={addExercise} className="grid md:grid-cols-3 gap-3 mt-4">
          <label className="text-sm block md:col-span-2">
            Program Day
            <select className="select mt-1" name="program_day_id" required>
              <option value="">Select day</option>
              {(days ?? []).map((day: any) => {
                const program = Array.isArray(day.program) ? day.program[0] : day.program;
                return (
                  <option key={day.id} value={day.id}>
                    {program?.name} - Day {day.day_index}: {day.title}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="text-sm block">
            Exercise
            <select className="select mt-1" name="exercise_id" required>
              <option value="">Select exercise</option>
              {(exercises ?? []).map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name} ({exercise.exercise_group})
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm block">
            Prescription (how measured)
            <select className="select mt-1" name="prescription" defaultValue="reps_weight">
              <option value="reps_weight">reps_weight</option>
              <option value="time">time</option>
              <option value="mixed">mixed</option>
            </select>
          </label>

          <label className="text-sm block">
            Sets
            <input className="input mt-1" name="set_count" type="number" min={1} />
          </label>

          <label className="text-sm block">
            Rep Target
            <input className="input mt-1" name="rep_target" placeholder="8-10" />
          </label>

          <label className="text-sm block">
            Weight Target (lbs)
            <input className="input mt-1" name="weight_target_lbs" type="number" step="0.1" />
          </label>

          <label className="text-sm block">
            Time Target (seconds)
            <input className="input mt-1" name="time_target_seconds" type="number" />
          </label>

          <label className="text-sm block md:col-span-2">
            Focus
            <input className="input mt-1" name="focus" />
          </label>

          <label className="text-sm block md:col-span-3">
            Personal Notes
            <textarea className="textarea mt-1" name="personal_notes" />
          </label>

          <label className="text-sm block md:col-span-3">
            Do
            <textarea className="textarea mt-1" name="dos" />
          </label>

          <label className="text-sm block md:col-span-3">
            Don&apos;t
            <textarea className="textarea mt-1" name="donts" />
          </label>

          <div className="md:col-span-3">
            <button className="btn btn-primary" type="submit">Add Exercise to Day</button>
          </div>
        </form>
      </section>

      <section className="card p-6">
        <h2 className="text-2xl">Current Programs</h2>
        <div className="space-y-2 mt-3">
          {(programs ?? []).map((program: any) => {
            const athlete = Array.isArray(program.athlete) ? program.athlete[0] : program.athlete;
            return (
              <div key={program.id} className="border rounded-xl p-3 bg-white">
                <p className="font-semibold">{program.name}</p>
                <p className="text-sm meta">Athlete: {athlete?.full_name ?? program.athlete_id}</p>
              </div>
            );
          })}
          {!programs?.length && <p className="meta">No programs yet.</p>}
        </div>
      </section>
    </main>
  );
}

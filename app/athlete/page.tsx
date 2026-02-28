/**
 * AUTO-DOC: File overview
 * Purpose: Next.js route page for `/athlete`.
 * Related pages/files:
 * - `lib/supabase/server.ts`
 * - `lib/archetype.ts`
 * - `app/layout.tsx`
 * - `components/right-sidebar.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";
import { archetypeSummary, inferArchetype } from "@/lib/archetype";

export default async function AthletePage() {
  const supabase = createSupabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (me?.role === "coach") {
    redirect("/coach/queue");
  }

  const cookieStore = await cookies();
  const scopedAthleteId =
    me?.role === "admin" ? cookieStore.get("admin_view_athlete_id")?.value || "" : user.id;

  if (me?.role === "admin" && !scopedAthleteId) {
    return (
      <main className="shell space-y-4">
        <section className="card p-6">
          <p className="badge inline-block">Athlete View</p>
          <h1 className="text-4xl mt-3">Select Athlete Context</h1>
          <p className="meta mt-2">Go to Admin and choose an athlete in &quot;Admin View Context&quot; first.</p>
        </section>
      </main>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, member_since, goals, archetype_ai, archetype_final, archetype_confidence, shoulder_width, hip_width, onboarding_completed, posture_photos_required")
    .eq("id", scopedAthleteId)
    .maybeSingle();

  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  const { data: programs } = await supabase
    .from("programs")
    .select("id, name, summary")
    .eq("athlete_id", scopedAthleteId)
    .order("created_at", { ascending: false })
    .limit(1);

  const activeProgram = programs?.[0];

  if (!activeProgram) {
    return (
      <main className="shell space-y-4">
        <section className="card p-6">
          <p className="badge inline-block">Athlete Portal</p>
          <h1 className="text-4xl mt-3">{profile?.full_name ?? "Athlete"}</h1>
          <p className="meta mt-2">No active program yet. Ask Gunther to assign your day-by-day plan.</p>
        </section>
      </main>
    );
  }

  const [{ data: days }, { data: submissionMetrics }] = await Promise.all([
    supabase
      .from("program_days")
      .select("id, day_index, title, notes")
      .eq("program_id", activeProgram.id)
      .order("day_index", { ascending: true }),
    supabase.from("exercise_submissions").select("reps_completed, weight_lbs").eq("athlete_id", scopedAthleteId)
  ]);

  const totalWorkouts = days?.length ?? 0;
  const totalReps = (submissionMetrics ?? []).reduce((acc, row) => acc + (row.reps_completed ?? 0), 0);
  const totalWeight = (submissionMetrics ?? []).reduce((acc, row) => acc + Number(row.weight_lbs ?? 0), 0);

  const aiFromMetrics =
    profile?.shoulder_width && profile?.hip_width
      ? inferArchetype(Number(profile.shoulder_width), Number(profile.hip_width))
      : null;

  const displayedArchetype = profile?.archetype_final ?? profile?.archetype_ai ?? aiFromMetrics?.archetype;

  return (
    <main className="shell space-y-5">
      <section className="card p-6">
        <p className="badge inline-block">Athlete View</p>
        <h1 className="text-4xl mt-3">{profile?.full_name ?? "Athlete"}</h1>
        {profile?.posture_photos_required && (
          <p className="text-red-700 text-sm mt-2">
            Posture photos are still needed. Please update your{" "}
            <Link href="/athlete/profile" className="underline">
              profile
            </Link>.
          </p>
        )}
        <p className="meta mt-1">{activeProgram.name}</p>
        <p className="mt-3">
          {activeProgram.summary ? "Program source copy loaded below." : "Your personalized progression plan."}
        </p>

        {!!activeProgram.summary && (
          <div className="border rounded-xl p-3 bg-white mt-3">
            <p className="text-xs meta uppercase tracking-wide">Program Copy</p>
            <pre className="text-sm mt-2 whitespace-pre-wrap font-sans">{activeProgram.summary}</pre>
          </div>
        )}

        <div className="grid md:grid-cols-4 gap-3 mt-5">
          <div className="metric">
            <p className="text-sm meta">Member Since</p>
            <p className="font-semibold">{profile?.member_since ?? "-"}</p>
          </div>
          <div className="metric">
            <p className="text-sm meta">Workouts</p>
            <p className="font-semibold">{totalWorkouts}</p>
          </div>
          <div className="metric">
            <p className="text-sm meta">Reps</p>
            <p className="font-semibold">{totalReps}</p>
          </div>
          <div className="metric">
            <p className="text-sm meta">Lbs Logged</p>
            <p className="font-semibold">{Math.round(totalWeight)}</p>
          </div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-2xl">Archetype Snapshot (AI + Coach Approval)</h2>
        <p className="meta mt-2">
          Current type: <span className="font-semibold text-black">{displayedArchetype ?? "Pending"}</span>
        </p>
        {displayedArchetype && (
          <p className="mt-1 text-sm">{archetypeSummary(displayedArchetype as "V" | "A" | "H")}</p>
        )}
        <p className="text-sm mt-1">
          Shoulder width: {profile?.shoulder_width ?? "-"} | Hip width: {profile?.hip_width ?? "-"}
        </p>
        <p className="text-sm mt-1">AI confidence: {profile?.archetype_confidence ?? aiFromMetrics?.confidence ?? "-"}</p>
      </section>

      {!!profile?.goals?.length && (
        <section className="card p-6">
          <h2 className="text-2xl">Goals For You</h2>
          <div className="flex flex-wrap gap-2 mt-3">
            {profile.goals.map((goal: string) => (
              <span key={goal} className="badge">
                {goal}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="card p-6">
        <h2 className="text-2xl">Profile</h2>
        <p className="meta mt-2">Update intro survey answers and posture photo URLs anytime.</p>
        <div className="flex gap-2 flex-wrap mt-3">
          <Link href="/athlete/profile" className="btn btn-secondary inline-block">
            Your Profile
          </Link>
          <Link href="/athlete/exercises" className="btn btn-secondary inline-block">
            Exercise Database
          </Link>
          <Link href="/athlete/request-review" className="btn btn-secondary inline-block">
            Request Review
          </Link>
          <Link href="/athlete/feedback" className="btn btn-secondary inline-block">
            Your Feedback
          </Link>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-2xl">Program Table of Contents (By Day Number)</h2>
        <div className="mt-4 space-y-2">
          {days?.map((day) => (
            <Link key={day.id} href={`/athlete/day/${day.id}`} className="block border rounded-xl p-3 hover:bg-blue-50">
              <p className="text-sm meta">Day {day.day_index}</p>
              <p className="font-semibold">{day.title}</p>
              {day.notes && <p className="text-sm meta mt-1">{day.notes}</p>}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

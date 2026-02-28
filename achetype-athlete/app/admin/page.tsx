/**
 * AUTO-DOC: File overview
 * Purpose: Next.js route page for `/admin`.
 * Related pages/files:
 * - `lib/supabase/server.ts`
 * - `app/layout.tsx`
 * - `components/right-sidebar.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";
import AdminDeleteMemberButton from "@/components/admin-delete-member-button";

async function assertAdmin() {
  const sb = createSupabaseServer();
  const {
    data: { user }
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: actor } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (actor?.role !== "admin") redirect("/");

  return { sb, user };
}

export default async function AdminPage() {
  const supabase = createSupabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") redirect("/");

  async function updateRole(formData: FormData) {
    "use server";
    const { sb } = await assertAdmin();

    const profileId = String(formData.get("profile_id") ?? "");
    const role = String(formData.get("role") ?? "athlete");

    if (!profileId || !["athlete", "coach", "admin"].includes(role)) {
      revalidatePath("/admin");
      return;
    }

    await sb.from("profiles").update({ role }).eq("id", profileId);
    revalidatePath("/admin");
  }

  async function assignAthlete(formData: FormData) {
    "use server";
    const { sb } = await assertAdmin();

    const athleteId = String(formData.get("athlete_id") ?? "");
    const coachId = String(formData.get("coach_id") ?? "");
    if (!athleteId || !coachId) {
      revalidatePath("/admin");
      return;
    }

    await sb
      .from("athlete_relationships")
      .insert({ athlete_id: athleteId, coach_id: coachId });

    revalidatePath("/admin");
  }

  async function setAdminViewContext(formData: FormData) {
    "use server";
    await assertAdmin();

    const coachId = String(formData.get("view_coach_id") ?? "").trim();
    const athleteId = String(formData.get("view_athlete_id") ?? "").trim();

    const cookieStore = await cookies();
    if (coachId) {
      cookieStore.set("admin_view_coach_id", coachId, { path: "/", sameSite: "lax" });
    }
    if (athleteId) {
      cookieStore.set("admin_view_athlete_id", athleteId, { path: "/", sameSite: "lax" });
    }

    revalidatePath("/admin");
  }

  async function deleteProfile(formData: FormData) {
    "use server";
    // Only admins can delete members; assertAdmin() guards this
    const { sb } = await assertAdmin();

    const profileId = String(formData.get("profile_id") ?? "").trim();
    if (!profileId) {
      revalidatePath("/admin");
      return;
    }

    // Delete the profile row; cascade handles related athlete_relationships rows
    await sb.from("profiles").delete().eq("id", profileId);
    revalidatePath("/admin");
  }

  const [
    { data: profiles },
    { data: athletes },
    { data: coaches },
    { data: assignments },
    { count: athleteCount },
    { count: coachCount },
    { count: pendingCount }
  ] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role, member_since").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, email").eq("role", "athlete").order("full_name", { ascending: true }),
    supabase.from("profiles").select("id, full_name, email").eq("role", "coach").order("full_name", { ascending: true }),
    supabase
      .from("athlete_relationships")
      .select(
        "id, athlete:profiles!athlete_relationships_athlete_id_fkey(full_name,email), coach:profiles!athlete_relationships_coach_id_fkey(full_name,email)"
      )
      .order("id", { ascending: false }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "athlete"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "coach"),
    supabase.from("exercise_submissions").select("id", { count: "exact", head: true }).eq("status", "pending_review")
  ]);

  const cookieStore = await cookies();
  const selectedCoachId = cookieStore.get("admin_view_coach_id")?.value ?? "";
  const selectedAthleteId = cookieStore.get("admin_view_athlete_id")?.value ?? "";

  return (
    <main className="shell space-y-4">
      <section className="card p-6">
        <p className="badge inline-block">Admin</p>
        <h1 className="text-4xl mt-3">Platform Control</h1>
        <p className="meta mt-1">Manage roles, assignments, and admin view context.</p>

        <div className="grid md:grid-cols-3 gap-3 mt-4">
          <div className="metric"><p className="meta text-sm">Athletes</p><p className="font-semibold">{athleteCount ?? 0}</p></div>
          <div className="metric"><p className="meta text-sm">Coaches</p><p className="font-semibold">{coachCount ?? 0}</p></div>
          <div className="metric"><p className="meta text-sm">Pending Submissions</p><p className="font-semibold">{pendingCount ?? 0}</p></div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-2xl">Admin View Context</h2>
        <p className="meta mt-1">Pick a coach and athlete to load those subtabs while signed in as admin.</p>
        <form action={setAdminViewContext} className="grid md:grid-cols-2 gap-3 mt-4">
          <label className="text-sm block">
            Coach Context
            <select className="select mt-1" name="view_coach_id" defaultValue={selectedCoachId}>
              <option value="">Select coach</option>
              {(coaches ?? []).map((coach) => (
                <option key={coach.id} value={coach.id}>{coach.full_name} ({coach.email})</option>
              ))}
            </select>
          </label>
          <label className="text-sm block">
            Athlete Context
            <select className="select mt-1" name="view_athlete_id" defaultValue={selectedAthleteId}>
              <option value="">Select athlete</option>
              {(athletes ?? []).map((athlete) => (
                <option key={athlete.id} value={athlete.id}>{athlete.full_name} ({athlete.email})</option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2">
            <button className="btn btn-primary" type="submit">Save View Context</button>
          </div>
        </form>
      </section>

      <section className="card p-6">
        <h2 className="text-2xl">Coach & Athlete Assignments</h2>
        <form action={assignAthlete} className="grid md:grid-cols-2 gap-3 mt-4">
          <label className="text-sm block">
            Athlete
            <select className="select mt-1" name="athlete_id" required>
              <option value="">Select athlete</option>
              {(athletes ?? []).map((athlete) => (
                <option key={athlete.id} value={athlete.id}>{athlete.full_name} ({athlete.email})</option>
              ))}
            </select>
          </label>
          <label className="text-sm block">
            Coach
            <select className="select mt-1" name="coach_id" required>
              <option value="">Select coach</option>
              {(coaches ?? []).map((coach) => (
                <option key={coach.id} value={coach.id}>{coach.full_name} ({coach.email})</option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2">
            <button className="btn btn-primary" type="submit">Assign Athlete to Coach</button>
          </div>
        </form>

        <div className="space-y-2 mt-4">
          {(assignments ?? []).map((row: any) => {
            const athlete = Array.isArray(row.athlete) ? row.athlete[0] : row.athlete;
            const coach = Array.isArray(row.coach) ? row.coach[0] : row.coach;
            return (
              <div key={row.id} className="border rounded-xl p-3 bg-white">
                <p className="text-sm"><span className="font-semibold">Athlete:</span> {athlete?.full_name ?? "-"} ({athlete?.email ?? "-"})</p>
                <p className="text-sm"><span className="font-semibold">Coach:</span> {coach?.full_name ?? "-"} ({coach?.email ?? "-"})</p>
              </div>
            );
          })}
          {!assignments?.length && <p className="meta">No assignments yet.</p>}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-2xl">User Roles</h2>
        <div className="space-y-2 mt-3">
          {(profiles ?? []).map((profile) => (
            // Each row: name/email | role select | Save | Delete (trash can with confirm)
            <div key={profile.id} className="border rounded-xl p-3 bg-white grid md:grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
              <div>
                <p className="font-semibold">{profile.full_name}</p>
                <p className="text-sm meta">{profile.email} · Member since {profile.member_since}</p>
              </div>
              {/* Role update form — only wraps the select + save button */}
              <form action={updateRole} className="contents">
                <input type="hidden" name="profile_id" value={profile.id} />
                <select name="role" className="select" defaultValue={profile.role}>
                  <option value="athlete">athlete</option>
                  <option value="coach">coach</option>
                  <option value="admin">admin</option>
                </select>
                <button className="btn btn-primary" type="submit">Save</button>
              </form>
              {/* Delete button — separate form with client-side confirm dialog */}
              <AdminDeleteMemberButton
                profileId={profile.id}
                fullName={profile.full_name ?? ""}
                email={profile.email ?? ""}
                action={deleteProfile}
              />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

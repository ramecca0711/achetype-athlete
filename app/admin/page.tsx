/**
 * AUTO-DOC: File overview
 * Purpose: Next.js route page for `/admin`.
 * Related pages/files:
 * - `lib/supabase/server.ts`
 * - `app/layout.tsx`
 * - `components/right-sidebar.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
import Link from "next/link";
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

  const { data: actor } = await sb.from("profiles").select("role, approval_status").eq("id", user.id).maybeSingle();
  if (actor?.approval_status === "pending") redirect("/pending-approval");
  if (actor?.role !== "admin") redirect("/");

  return { sb, user };
}

export default async function AdminPage({
  searchParams
}: {
  searchParams?: { edit_assignment?: string; deleted?: string; delete_error?: string; survey_tab?: string };
}) {
  const supabase = createSupabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role, approval_status").eq("id", user.id).maybeSingle();
  if (me?.approval_status === "pending") redirect("/pending-approval");
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

  async function updateAssignment(formData: FormData) {
    "use server";
    const { sb } = await assertAdmin();

    const assignmentId = String(formData.get("assignment_id") ?? "").trim();
    const athleteId = String(formData.get("athlete_id") ?? "").trim();
    const coachId = String(formData.get("coach_id") ?? "").trim();
    if (!assignmentId || !athleteId || !coachId) {
      revalidatePath("/admin");
      return;
    }

    await sb
      .from("athlete_relationships")
      .update({ athlete_id: athleteId, coach_id: coachId })
      .eq("id", assignmentId);

    redirect("/admin");
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
      redirect("/admin?delete_error=1");
    }

    // Delete from auth.users via SECURITY DEFINER RPC so the email is fully released.
    // This cascades to public.profiles through FK.
    const { error } = await sb.rpc("admin_delete_user", { target_user_id: profileId });
    if (error) {
      console.error("Failed to delete profile", error);
      redirect("/admin?delete_error=1");
    }
    redirect(`/admin?deleted=${profileId}`);
  }

  async function approveAccount(formData: FormData) {
    "use server";
    // Flip approval_status to 'approved' — allows the user to access the portal
    const { sb } = await assertAdmin();
    const profileId = String(formData.get("profile_id") ?? "").trim();
    if (!profileId) return;
    await sb.from("profiles").update({ approval_status: "approved" }).eq("id", profileId);
    revalidatePath("/admin");
  }

  async function rejectAccount(formData: FormData) {
    "use server";
    // Mark as rejected so the user stays in the waiting room and can be informed manually
    const { sb } = await assertAdmin();
    const profileId = String(formData.get("profile_id") ?? "").trim();
    if (!profileId) return;
    await sb.from("profiles").update({ approval_status: "rejected" }).eq("id", profileId);
    revalidatePath("/admin");
  }

  const cookieStore = await cookies();
  const selectedCoachId = cookieStore.get("admin_view_coach_id")?.value ?? "";
  const selectedAthleteId = cookieStore.get("admin_view_athlete_id")?.value ?? "";

  const [
    { data: profiles },
    { data: athletes },
    { data: coaches },
    { data: assignments },
    { count: athleteCount },
    { count: coachCount },
    { count: pendingCount },
    // Fetch coach/admin accounts that are awaiting approval
    { data: pendingApprovals }
  ] = await Promise.all([
    // Include approval_status so the User Roles table can show pending state
    supabase.from("profiles").select("id, full_name, email, role, member_since, approval_status").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, email").eq("role", "athlete").order("full_name", { ascending: true }),
    supabase.from("profiles").select("id, full_name, email").eq("role", "coach").order("full_name", { ascending: true }),
    supabase
      .from("athlete_relationships")
      .select(
        "id, athlete_id, coach_id, athlete:profiles!athlete_relationships_athlete_id_fkey(full_name,email), coach:profiles!athlete_relationships_coach_id_fkey(full_name,email)"
      )
      .order("id", { ascending: false }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "athlete"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "coach"),
    supabase.from("exercise_submissions").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    // Pending approval queue: coach and admin accounts not yet approved
    supabase.from("profiles").select("id, full_name, email, role, member_since").in("role", ["coach", "admin"]).eq("approval_status", "pending").order("created_at", { ascending: true }),
  ]);

  const activeSurveyTab = searchParams?.survey_tab === "coach" ? "coach" : "athlete";

  return (
    <main className="shell space-y-4">
      <section className="card p-6">
        <p className="badge inline-block">Admin</p>
        <h1 className="text-4xl mt-3">Platform Control</h1>
        <p className="meta mt-1">Manage roles, assignments, and admin view context.</p>
        {searchParams?.deleted && (
          <p className="text-green-700 text-sm mt-2">Member deleted successfully.</p>
        )}
        {searchParams?.delete_error && (
          <p className="text-red-700 text-sm mt-2">Delete failed. Check policies and try again.</p>
        )}

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
        <h2 className="text-2xl">Survey Preview</h2>
        <p className="meta mt-1">Design preview of new account survey forms.</p>

        {/* Tab navigation */}
        <div className="flex mt-4 border-b border-gray-200">
          <Link
            href="/admin?survey_tab=athlete"
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeSurveyTab === "athlete" ? "border-[#bd9256] text-[#bd9256]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Athlete Survey
          </Link>
          <Link
            href="/admin?survey_tab=coach"
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeSurveyTab === "coach" ? "border-[#bd9256] text-[#bd9256]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Coach Survey
          </Link>
        </div>

        {activeSurveyTab === "athlete" ? (
          /* Athlete Onboarding Survey — static blank preview matching /onboarding */
          <div className="mt-5 max-w-3xl">
            <div className="card p-6">
              <p className="badge inline-block">Athlete Onboarding</p>
              <h3 className="text-3xl mt-3">Welcome</h3>
              <p className="meta mt-2">
                Complete your intro survey and upload 4 posture photos (front, back, left, right). You can skip and update later in profile.
              </p>
              <fieldset disabled className="space-y-3 mt-5">
                <label className="text-sm block">
                  Full Name
                  <input className="input mt-1" placeholder="Jane Smith" />
                </label>
                <label className="text-sm block">
                  Training Experience
                  <input className="input mt-1" placeholder="Beginner / Intermediate / Advanced" />
                </label>
                <label className="text-sm block">
                  Weekly Training Days
                  <input className="input mt-1" type="number" min={1} max={7} />
                </label>
                <label className="text-sm block">
                  Gender
                  <select className="select mt-1">
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non_binary">Non-binary</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </label>
                <label className="text-sm block">
                  Birthday
                  <input className="input mt-1" type="date" />
                </label>
                <label className="text-sm block">
                  Units
                  <select className="select mt-1">
                    <option value="imperial">Imperial (ft/in, lbs)</option>
                    <option value="metric">Metric (cm, kg)</option>
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-sm block">
                    Height (ft)
                    <input className="input mt-1" type="number" min={0} step="1" />
                  </label>
                  <label className="text-sm block">
                    Height (in)
                    <input className="input mt-1" type="number" min={0} step="0.1" />
                  </label>
                </div>
                <label className="text-sm block">
                  Height (cm, for metric)
                  <input className="input mt-1" type="number" min={0} step="0.1" />
                </label>
                <label className="text-sm block">
                  Weight (lbs, for imperial)
                  <input className="input mt-1" type="number" min={0} step="0.1" />
                </label>
                <label className="text-sm block">
                  Weight (kg, for metric)
                  <input className="input mt-1" type="number" min={0} step="0.1" />
                </label>
                <label className="text-sm block">
                  Goals (comma separated)
                  <input className="input mt-1" placeholder="Strength, posture, shoulder stability" />
                </label>
                <label className="text-sm block">
                  Injuries
                  <textarea className="textarea mt-1" />
                </label>
                <label className="text-sm block">
                  Imbalances / Notes
                  <textarea className="textarea mt-1" />
                </label>
                <label className="text-sm block">
                  Additional Intro Notes
                  <textarea className="textarea mt-1" />
                </label>
                <label className="text-sm block">
                  Public Review Board Visibility
                  <select className="select mt-1">
                    <option value="private">Private (do not auto-share my requests/notifications)</option>
                    <option value="public">Public (share my requests/notifications on Public Review Board)</option>
                  </select>
                </label>
                <div className="grid md:grid-cols-2 gap-3">
                  {(["front", "back", "left", "right"] as const).map((slot) => (
                    <div key={slot} className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
                      <p className="text-sm font-medium capitalize text-gray-500">{slot} photo</p>
                      <p className="text-xs meta mt-1">Upload area</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 flex-wrap pt-2">
                  <button className="btn btn-primary" type="button">Submit Onboarding</button>
                </div>
              </fieldset>
            </div>
          </div>
        ) : (
          /* Coach Onboarding Survey — static blank preview matching /coach/onboarding */
          <div className="mt-5 max-w-3xl">
            <div className="card p-6">
              <p className="badge inline-block">Coach Onboarding</p>
              <h3 className="text-3xl mt-3">Complete Your Coach Setup</h3>
              <p className="meta mt-2">
                This one-time questionnaire appears after approval. You can edit this information later in Coach Profile.
              </p>
              <fieldset disabled className="space-y-3 mt-5">
                <label className="text-sm block">
                  Full Name
                  <input className="input mt-1" placeholder="Coach Name" />
                </label>
                <label className="text-sm block">
                  Gender
                  <select className="select mt-1">
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non_binary">Non-binary</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </label>
                <label className="text-sm block">
                  Birthday
                  <input className="input mt-1" type="date" />
                </label>
                <label className="text-sm block">
                  Setup Notes
                  <textarea className="textarea mt-1" />
                </label>
                <div className="pt-2">
                  <button className="btn btn-primary" type="button">Complete Coach Setup</button>
                </div>
              </fieldset>
            </div>
          </div>
        )}
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
            const isEditingAssignment = searchParams?.edit_assignment === row.id;
            return (
              <div key={row.id} className="border rounded-xl p-3 bg-white">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-sm"><span className="font-semibold">Athlete:</span> {athlete?.full_name ?? "-"} ({athlete?.email ?? "-"})</p>
                    <p className="text-sm"><span className="font-semibold">Coach:</span> {coach?.full_name ?? "-"} ({coach?.email ?? "-"})</p>
                  </div>
                  {isEditingAssignment ? (
                    <Link href="/admin" className="btn btn-secondary">Cancel</Link>
                  ) : (
                    <Link href={`/admin?edit_assignment=${row.id}`} className="btn btn-secondary">Edit</Link>
                  )}
                </div>
                {isEditingAssignment && (
                  <form action={updateAssignment} className="grid md:grid-cols-2 gap-3 mt-3">
                    <input type="hidden" name="assignment_id" value={row.id} />
                    <label className="text-sm block">
                      Athlete
                      <select className="select mt-1" name="athlete_id" defaultValue={row.athlete_id}>
                        {(athletes ?? []).map((a: any) => (
                          <option key={a.id} value={a.id}>{a.full_name} ({a.email})</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm block">
                      Coach
                      <select className="select mt-1" name="coach_id" defaultValue={row.coach_id}>
                        {(coaches ?? []).map((c: any) => (
                          <option key={c.id} value={c.id}>{c.full_name} ({c.email})</option>
                        ))}
                      </select>
                    </label>
                    <div className="md:col-span-2">
                      <button className="btn btn-primary" type="submit">Save Assignment</button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
          {!assignments?.length && <p className="meta">No assignments yet.</p>}
        </div>
      </section>

      {/* Pending Approvals — coach and admin accounts waiting for sign-off */}
      <section className="card p-6">
        <h2 className="text-2xl">Pending Approvals</h2>
        <p className="meta mt-1">
          New coach and admin accounts require approval before they can access the portal.
        </p>
        <div className="space-y-2 mt-3">
          {(pendingApprovals ?? []).map((pending: any) => (
            <div key={pending.id} className="border rounded-xl p-3 bg-white flex flex-wrap gap-2 items-center justify-between">
              <div>
                <p className="font-semibold">{pending.full_name ?? "(no name yet)"}</p>
                <p className="text-sm meta">
                  {pending.email} · <span className="badge">{pending.role}</span>
                  {pending.member_since && <span> · Registered {pending.member_since}</span>}
                </p>
              </div>
              <div className="flex gap-2">
                {/* Approve button — sets approval_status = 'approved', unblocks the user */}
                <form action={approveAccount}>
                  <input type="hidden" name="profile_id" value={pending.id} />
                  <button className="btn btn-primary" type="submit">Approve</button>
                </form>
                {/* Reject button — sets approval_status = 'rejected', keeps user in waiting room */}
                <form action={rejectAccount}>
                  <input type="hidden" name="profile_id" value={pending.id} />
                  <button className="btn btn-danger" type="submit">Reject</button>
                </form>
              </div>
            </div>
          ))}
          {!pendingApprovals?.length && (
            <p className="meta">No accounts pending approval.</p>
          )}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-2xl">User Roles</h2>
        <div className="space-y-2 mt-3">
          {(profiles ?? []).map((profile: any) => (
            // Each row: name/email | pending badge? | role select | Save | Delete
            <div key={profile.id} className="border rounded-xl p-3 bg-white grid md:grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
              <div>
                <p className="font-semibold">
                  {profile.full_name}
                  {/* Surface pending status inline so admin can see at a glance */}
                  {profile.approval_status === "pending" && (
                    <span className="badge ml-2" style={{ color: "#b45309", borderColor: "#fcd34d" }}>pending</span>
                  )}
                  {profile.approval_status === "rejected" && (
                    <span className="badge ml-2" style={{ color: "#b91c1c", borderColor: "#fca5a5" }}>rejected</span>
                  )}
                </p>
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

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
    { data: pendingApprovals },
    { data: surveyProfile },
    { data: surveyPhotos }
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
    // Survey preview: fetch selected athlete's full profile data
    selectedAthleteId
      ? supabase.from("profiles").select("full_name, training_experience, weekly_training_days, goals, injuries, imbalances, intro_survey_notes, gender, birth_date, age, height_inches, weight_lbs, share_feedback_publicly").eq("id", selectedAthleteId).maybeSingle()
      : Promise.resolve({ data: null }) as any,
    // Survey preview: fetch selected athlete's posture photos
    selectedAthleteId
      ? supabase.from("posture_photos").select("photo_slot, photo_url").eq("athlete_id", selectedAthleteId)
      : Promise.resolve({ data: [] }) as any,
  ]);

  const activeSurveyTab = searchParams?.survey_tab === "photos" ? "photos" : "survey";
  const surveyHeightInches = Number((surveyProfile as any)?.height_inches ?? 0) || 0;
  const surveyFeet = surveyHeightInches > 0 ? Math.floor(surveyHeightInches / 12) : null;
  const surveyInchPart = surveyHeightInches > 0 ? Number((surveyHeightInches % 12).toFixed(1)) : null;
  const surveyPhotoMap = new Map(((surveyPhotos ?? []) as any[]).map((p) => [p.photo_slot, p.photo_url]));

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
        <p className="meta mt-1">Read-only preview of the selected athlete&apos;s intro survey responses.</p>

        {!selectedAthleteId ? (
          <p className="meta text-sm mt-4">Select an athlete in Admin View Context above to preview their survey.</p>
        ) : (
          <>
            {/* Tab navigation */}
            <div className="flex mt-4 border-b border-gray-200">
              <Link
                href="/admin?survey_tab=survey"
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeSurveyTab === "survey" ? "border-[#bd9256] text-[#bd9256]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                Onboarding Survey
              </Link>
              <Link
                href="/admin?survey_tab=photos"
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeSurveyTab === "photos" ? "border-[#bd9256] text-[#bd9256]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                Profile Survey
              </Link>
            </div>

            {activeSurveyTab === "survey" ? (
              /* Tab 1: Onboarding Survey — form-style layout matching the onboarding page */
              <div className="mt-5 max-w-2xl">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
                  <p className="badge inline-block">Athlete Onboarding</p>
                </div>
                <h3 className="text-xl">Welcome{(surveyProfile as any)?.full_name ? `, ${(surveyProfile as any).full_name}` : ""}</h3>
                <p className="meta text-sm mt-1 mb-4">Intro survey and posture photo upload.</p>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-sm">Full Name</p>
                    <p className="input mt-1 bg-slate-50">{(surveyProfile as any)?.full_name || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm">Training Experience</p>
                    <p className="input mt-1 bg-slate-50">{(surveyProfile as any)?.training_experience || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm">Weekly Training Days</p>
                    <p className="input mt-1 bg-slate-50">{(surveyProfile as any)?.weekly_training_days ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm">Gender</p>
                    <p className="input mt-1 bg-slate-50">{(surveyProfile as any)?.gender || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm">Birthday</p>
                    <p className="input mt-1 bg-slate-50">{(surveyProfile as any)?.birth_date || "-"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-sm">Height (ft)</p>
                      <p className="input mt-1 bg-slate-50">{surveyFeet ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm">Height (in)</p>
                      <p className="input mt-1 bg-slate-50">{surveyInchPart ?? "-"}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm">Weight (lbs)</p>
                    <p className="input mt-1 bg-slate-50">{(surveyProfile as any)?.weight_lbs ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm">Goals (comma separated)</p>
                    <p className="input mt-1 bg-slate-50">{((surveyProfile as any)?.goals ?? []).join(", ") || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm">Injuries</p>
                    <p className="textarea mt-1 bg-slate-50 whitespace-pre-line">{(surveyProfile as any)?.injuries || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm">Imbalances / Notes</p>
                    <p className="textarea mt-1 bg-slate-50 whitespace-pre-line">{(surveyProfile as any)?.imbalances || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm">Additional Intro Notes</p>
                    <p className="textarea mt-1 bg-slate-50 whitespace-pre-line">{(surveyProfile as any)?.intro_survey_notes || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm">Public Review Board Visibility</p>
                    <p className="input mt-1 bg-slate-50">{(surveyProfile as any)?.share_feedback_publicly ? "Public" : "Private"}</p>
                  </div>
                  <div>
                    <p className="text-sm">Posture Photos</p>
                    <p className="input mt-1 bg-slate-50">{["front", "back", "left", "right"].filter((s) => !!surveyPhotoMap.get(s)).length} / 4 uploaded</p>
                  </div>
                </div>
              </div>
            ) : (
              /* Tab 2: Profile Survey — sectioned layout matching the athlete profile page */
              <div className="space-y-4 mt-5">
                <section className="border rounded-xl p-4 bg-white">
                  <h3 className="text-xl">Basic Info</h3>
                  <div className="grid md:grid-cols-2 gap-3 mt-3 text-sm">
                    <p><span className="meta">Name:</span> {(surveyProfile as any)?.full_name ?? "-"}</p>
                    <p><span className="meta">Gender:</span> {(surveyProfile as any)?.gender ?? "-"}</p>
                    <p><span className="meta">Birthday:</span> {(surveyProfile as any)?.birth_date ?? "-"}</p>
                    <p><span className="meta">Age:</span> {(surveyProfile as any)?.age ?? "-"}</p>
                    <p><span className="meta">Height:</span> {surveyFeet != null ? `${surveyFeet} ft ${surveyInchPart} in` : "-"}</p>
                    <p><span className="meta">Weight:</span> {(surveyProfile as any)?.weight_lbs ?? "-"} lbs</p>
                  </div>
                </section>

                <section className="border rounded-xl p-4 bg-white">
                  <h3 className="text-xl">Training Profile</h3>
                  <div className="space-y-2 mt-3 text-sm">
                    <p><span className="meta">Experience:</span> {(surveyProfile as any)?.training_experience ?? "-"}</p>
                    <p><span className="meta">Days/week:</span> {(surveyProfile as any)?.weekly_training_days ?? "-"}</p>
                    <p><span className="meta">Goals:</span> {((surveyProfile as any)?.goals ?? []).length ? ((surveyProfile as any)?.goals ?? []).join(", ") : "-"}</p>
                    <p><span className="meta">Public review board:</span> {(surveyProfile as any)?.share_feedback_publicly ? "Public" : "Private"}</p>
                  </div>
                </section>

                <section className="border rounded-xl p-4 bg-white">
                  <h3 className="text-xl">Injuries And Notes</h3>
                  <div className="space-y-2 mt-3 text-sm">
                    <p><span className="meta">Injuries:</span> {(surveyProfile as any)?.injuries ?? "-"}</p>
                    <p><span className="meta">Imbalances:</span> {(surveyProfile as any)?.imbalances ?? "-"}</p>
                    <p><span className="meta">Intro notes:</span> {(surveyProfile as any)?.intro_survey_notes ?? "-"}</p>
                  </div>
                </section>

                <section className="border rounded-xl p-4 bg-white">
                  <h3 className="text-xl">Posture Photos</h3>
                  <div className="grid md:grid-cols-2 gap-3 mt-3">
                    {(["front", "back", "left", "right"] as const).map((slot) => {
                      const url = surveyPhotoMap.get(slot);
                      return (
                        <div key={slot} className="border rounded-xl p-3">
                          <p className="text-sm font-medium capitalize">{slot}</p>
                          {url ? (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt={`${slot} posture`} className="w-full rounded-lg object-cover" style={{ maxHeight: "200px" }} />
                            </a>
                          ) : (
                            <p className="meta text-sm mt-1">Not uploaded</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}
          </>
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

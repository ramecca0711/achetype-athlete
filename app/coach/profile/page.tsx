/**
 * AUTO-DOC: File overview
 * Purpose: Next.js route page for `/coach/profile`.
 * Related pages/files:
 * - `lib/supabase/server.ts`
 * - `app/layout.tsx`
 * - `components/right-sidebar.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function CoachProfilePage({
  searchParams
}: {
  searchParams?: { edit?: string };
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, email, member_since, intro_survey_notes, gender, birth_date, age")
    .eq("id", scopedCoachId)
    .maybeSingle();

  if (profile?.role !== "coach" && me?.role !== "admin") redirect("/");
  const isEditMode = searchParams?.edit === "1";

  async function saveCoachProfile(formData: FormData) {
    "use server";

    const sb = createSupabaseServer();
    const {
      data: { user: actionUser }
    } = await sb.auth.getUser();
    if (!actionUser) redirect("/login");

    const { data: actionMe } = await sb.from("profiles").select("role").eq("id", actionUser.id).maybeSingle();
    if (actionMe?.role !== "coach" && actionMe?.role !== "admin") redirect("/");

    const actionCookies = await cookies();
    const formCoachId = String(formData.get("target_coach_id") ?? "").trim();
    const targetCoachId =
      actionMe?.role === "admin" ? actionCookies.get("admin_view_coach_id")?.value || formCoachId : actionUser.id;
    if (!targetCoachId) redirect("/admin");

    const birthDateRaw = String(formData.get("birth_date") ?? "").trim();
    const parsedBirthDate = birthDateRaw ? new Date(`${birthDateRaw}T00:00:00`) : null;
    const calculatedAge =
      parsedBirthDate && !Number.isNaN(parsedBirthDate.getTime())
        ? Math.max(
            0,
            new Date().getFullYear() -
              parsedBirthDate.getFullYear() -
              (new Date().getMonth() < parsedBirthDate.getMonth() ||
              (new Date().getMonth() === parsedBirthDate.getMonth() &&
                new Date().getDate() < parsedBirthDate.getDate())
                ? 1
                : 0)
          )
        : null;

    const { error: updateError } = await sb
      .from("profiles")
      .update({
        full_name: String(formData.get("full_name") ?? "Coach"),
        intro_survey_notes: String(formData.get("intro_survey_notes") ?? "") || null,
        gender: String(formData.get("gender") ?? "") || null,
        birth_date: birthDateRaw || null,
        age: calculatedAge
      })
      .eq("id", targetCoachId);

    if (updateError) {
      console.error("Failed to update coach profile", updateError);
      redirect("/coach/profile");
    }

    redirect("/coach/profile");
  }

  return (
    <main className="shell space-y-4">
      <section className="card p-6">
        <p className="text-sm">
          <Link href="/" className="plain-link">Home</Link> /{" "}
          <Link href="/coach/queue" className="plain-link">Coach Dashboard</Link> / Profile
        </p>
        <div className="flex items-start justify-between gap-4 mt-3 flex-wrap">
          <div>
            <h1 className="text-3xl">{profile?.full_name ?? "Coach Profile"}</h1>
            <p className="meta text-sm mt-1">
              Coach information from setup. You can edit this profile any time.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {profile?.member_since && <span className="badge">Member since {profile.member_since}</span>}
            <span className="badge">Role coach</span>
            {isEditMode ? (
              <Link href="/coach/profile" className="btn btn-secondary">
                Cancel Edit
              </Link>
            ) : (
              <Link href="/coach/profile?edit=1" className="btn btn-secondary inline-flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M14.06 4.94l3.75 3.75 1.41-1.41a1 1 0 000-1.41L17.47 3.53a1 1 0 00-1.41 0l-2 1.41z" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                Edit Profile
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="card p-6">
        {isEditMode ? (
          <form action={saveCoachProfile} className="space-y-4">
            <input type="hidden" name="target_coach_id" value={scopedCoachId} readOnly />
            <section className="border rounded-xl p-4 bg-white">
              <h2 className="text-xl">Basic Info</h2>
              <div className="grid md:grid-cols-2 gap-3 mt-3">
                <label className="text-sm block">Full Name
                  <input className="input mt-1" name="full_name" defaultValue={profile?.full_name ?? ""} required />
                </label>
                <label className="text-sm block">Gender
                  <select className="select mt-1" name="gender" defaultValue={profile?.gender ?? ""}>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non_binary">Non-binary</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </label>
                <label className="text-sm block">Birthday
                  <input className="input mt-1" type="date" name="birth_date" defaultValue={profile?.birth_date ?? ""} />
                </label>
                <div className="text-sm block">
                  <p>Calculated age</p>
                  <p className="input mt-1 bg-slate-50">{profile?.age ?? "-"}</p>
                </div>
              </div>
            </section>

            <section className="border rounded-xl p-4 bg-white">
              <h2 className="text-xl">Coaching Profile</h2>
              <div className="grid md:grid-cols-2 gap-3 mt-3">
                <label className="text-sm block md:col-span-2">Setup Notes
                  <textarea className="textarea mt-1" name="intro_survey_notes" defaultValue={profile?.intro_survey_notes ?? ""} />
                </label>
              </div>
            </section>

            <div className="flex justify-end">
              <button className="btn btn-primary" type="submit">Save Profile</button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <section className="border rounded-xl p-4 bg-white">
              <h2 className="text-xl">Basic Info</h2>
              <div className="grid md:grid-cols-2 gap-3 mt-3 text-sm">
                <p><span className="meta">Name:</span> {profile?.full_name ?? "-"}</p>
                <p><span className="meta">Email:</span> {profile?.email ?? "-"}</p>
                <p><span className="meta">Gender:</span> {profile?.gender ?? "-"}</p>
                <p><span className="meta">Birthday:</span> {profile?.birth_date ?? "-"}</p>
                <p><span className="meta">Age:</span> {profile?.age ?? "-"}</p>
              </div>
            </section>

            <section className="border rounded-xl p-4 bg-white">
              <h2 className="text-xl">Coaching Profile</h2>
              <div className="space-y-2 mt-3 text-sm">
                <p><span className="meta">Setup notes:</span> {profile?.intro_survey_notes ?? "-"}</p>
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

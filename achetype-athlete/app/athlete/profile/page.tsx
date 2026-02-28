/**
 * AUTO-DOC: File overview
 * Purpose: Next.js route page for `/athlete/profile`.
 * Related pages/files:
 * - `lib/supabase/server.ts`
 * - `components/posture-photo-input.tsx`
 * - `app/layout.tsx`
 * - `components/right-sidebar.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";
import PosturePhotoInput from "@/components/posture-photo-input";

type Slot = "front" | "back" | "left" | "right";
const slots: Slot[] = ["front", "back", "left", "right"];

export default async function AthleteProfilePage({
  searchParams
}: {
  searchParams?: { edit?: string };
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

  const [{ data: profile }, { data: photos }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, role, full_name, member_since, onboarding_completed, training_experience, weekly_training_days, goals, injuries, imbalances, intro_survey_notes, posture_photos_required, gender, birth_date, age, height_inches, weight_lbs, share_feedback_publicly, archetype_ai, archetype_final, archetype_confidence, archetype_notes, archetype_approved_at, posture_feedback_loom_url, posture_feedback_insights")
      .eq("id", scopedAthleteId)
      .maybeSingle(),
    supabase
      .from("posture_photos")
      .select("photo_slot, photo_url")
      .eq("athlete_id", scopedAthleteId)
  ]);

  if (profile?.role !== "athlete" && me?.role !== "admin") redirect("/");
  const isEditMode = searchParams?.edit === "1";
  const displayArchetype = profile?.archetype_final ?? profile?.archetype_ai;
  const archetypeStatus = profile?.archetype_final
    ? "Coach approved"
    : profile?.archetype_ai
      ? "AI suggested (pending coach)"
      : "Pending";

  const photoMap = new Map((photos ?? []).map((p) => [p.photo_slot, p.photo_url]));
  const uploadedPhotoCount = slots.filter((slot) => !!photoMap.get(slot)).length;

  async function saveProfile(formData: FormData) {
    "use server";

    const sb = createSupabaseServer();
    const {
      data: { user: actionUser }
    } = await sb.auth.getUser();

    if (!actionUser) redirect("/login");
    const { data: actionMe } = await sb.from("profiles").select("role").eq("id", actionUser.id).maybeSingle();
    const actionCookies = await cookies();
    const formAthleteId = String(formData.get("target_athlete_id") ?? "").trim();
    const targetAthleteId =
      actionMe?.role === "admin"
        ? actionCookies.get("admin_view_athlete_id")?.value || formAthleteId
        : actionUser.id;
    if (!targetAthleteId) redirect("/admin");

    const goalsRaw = String(formData.get("goals") ?? "").trim();
    const goals = goalsRaw
      ? goalsRaw
          .split(",")
          .map((g) => g.trim())
          .filter(Boolean)
      : [];

    const photoInputs = slots.map((slot) => ({
      slot,
      url: String(formData.get(`photo_${slot}`) ?? "").trim()
    }));
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

    const hasAllFour = photoInputs.every((i) => !!i.url);
    const { data: existingProfile } = await sb
      .from("profiles")
      .select("archetype_ai, archetype_approved_at")
      .eq("id", targetAthleteId)
      .maybeSingle();
    const shouldQueueArchetype =
      hasAllFour &&
      !existingProfile?.archetype_approved_at &&
      (!existingProfile?.archetype_ai || existingProfile.archetype_ai.trim() === "");

    const profileUpdate: Record<string, unknown> = {
      full_name: String(formData.get("full_name") ?? "Member"),
      training_experience: String(formData.get("training_experience") ?? "") || null,
      weekly_training_days: Number(formData.get("weekly_training_days") ?? 0) || null,
      goals,
      injuries: String(formData.get("injuries") ?? "") || null,
      imbalances: String(formData.get("imbalances") ?? "") || null,
      intro_survey_notes: String(formData.get("intro_survey_notes") ?? "") || null,
      gender: String(formData.get("gender") ?? "") || null,
      birth_date: birthDateRaw || null,
      age: calculatedAge,
      height_inches: Number(formData.get("height_inches") ?? 0) || null,
      weight_lbs: Number(formData.get("weight_lbs") ?? 0) || null,
      share_feedback_publicly: String(formData.get("share_feedback_publicly") ?? "private") === "public",
      posture_photos_required: !hasAllFour
    };
    if (shouldQueueArchetype) {
      profileUpdate.archetype_ai = "pending_approval";
      profileUpdate.archetype_notes = "Awaiting first coach archetype approval.";
    }

    const { error: profileUpdateError } = await sb
      .from("profiles")
      .update(profileUpdate)
      .eq("id", targetAthleteId);
    if (profileUpdateError) {
      console.error("Failed to update profile", profileUpdateError);
      redirect("/athlete/profile");
    }

    for (const item of photoInputs) {
      if (!item.url) continue;
      const { error: photoUpsertError } = await sb.from("posture_photos").upsert(
        { athlete_id: targetAthleteId, photo_slot: item.slot, photo_url: item.url },
        { onConflict: "athlete_id,photo_slot" }
      );
      if (photoUpsertError) {
        console.error("Failed to save posture photo", photoUpsertError);
        redirect("/athlete/profile");
      }
    }

    redirect("/athlete/profile");
  }

  return (
    <main className="shell space-y-4">
      <section className="card p-6">
        <p className="text-sm">
          <Link href="/" className="plain-link">Home</Link> /{" "}
          <Link href="/athlete" className="plain-link">Athlete Dashboard</Link> / Profile
        </p>
        <div className="flex items-start justify-between gap-4 mt-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-3xl">{profile?.full_name ?? "Athlete Profile"}</h1>
              <p className="meta text-sm mt-1">
                Initial setup happens once at signup. You can edit this profile any time.
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <span className="badge">
              Onboarding {profile?.onboarding_completed ? "complete" : "incomplete"}
            </span>
            <span className="badge">
              Posture photos {uploadedPhotoCount}/4
            </span>
            {profile?.member_since && <span className="badge">Member since {profile.member_since}</span>}
            {isEditMode ? (
              <Link href="/athlete/profile" className="btn btn-secondary">
                Cancel Edit
              </Link>
            ) : (
              <Link href="/athlete/profile?edit=1" className="btn btn-secondary inline-flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M14.06 4.94l3.75 3.75 1.41-1.41a1 1 0 000-1.41L17.47 3.53a1 1 0 00-1.41 0l-2 1.41z" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                Edit Profile
              </Link>
            )}
          </div>
        </div>
        {profile?.posture_photos_required && (
          <p className="text-red-700 text-sm mt-3">
            Posture photos still needed (front, back, left, right).
          </p>
        )}
      </section>

      <section className="card p-6">
        <div className="border rounded-xl p-5 bg-white">
          <p className="text-xs meta uppercase tracking-wide">Archetype</p>
          <div className="flex items-end justify-between gap-3 flex-wrap mt-1">
            <div>
              <p className="text-4xl font-semibold leading-none">{displayArchetype ?? "-"}</p>
              <p className="meta text-sm mt-2">{archetypeStatus}</p>
            </div>
          </div>
          {profile?.archetype_notes && <p className="text-sm mt-3">{profile.archetype_notes}</p>}
          {profile?.archetype_approved_at && (
            <p className="text-xs meta mt-2">Approved on {new Date(profile.archetype_approved_at).toLocaleString()}</p>
          )}
        </div>
      </section>

      <section className="card p-6">
        <div className="border rounded-xl p-5 bg-white">
          <p className="text-xs meta uppercase tracking-wide">Posture Photo Feedback</p>
          {profile?.posture_feedback_loom_url ? (
            <>
              <p className="text-sm mt-2">
                <a className="plain-link" href={profile.posture_feedback_loom_url} target="_blank">Open posture feedback Loom video</a>
              </p>
              <p className="text-sm mt-3 whitespace-pre-line">
                {profile?.posture_feedback_insights ?? "Insights are not available yet for this Loom video."}
              </p>
            </>
          ) : (
            <p className="meta text-sm mt-2">
              No posture feedback Loom linked yet. It will appear here after coach submits feedback.
            </p>
          )}
        </div>
      </section>

      <section className="card p-6">
        {isEditMode ? (
          <form action={saveProfile} className="space-y-4">
            <input type="hidden" name="target_athlete_id" value={scopedAthleteId} readOnly />
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
                <label className="text-sm block">Height (inches)
                  <input className="input mt-1" type="number" min={0} step="0.1" name="height_inches" defaultValue={profile?.height_inches ?? ""} />
                </label>
                <label className="text-sm block">Weight (lbs)
                  <input className="input mt-1" type="number" min={0} step="0.1" name="weight_lbs" defaultValue={profile?.weight_lbs ?? ""} />
                </label>
              </div>
            </section>

            <section className="border rounded-xl p-4 bg-white">
              <h2 className="text-xl">Training Profile</h2>
              <div className="grid md:grid-cols-2 gap-3 mt-3">
                <label className="text-sm block">Training Experience
                  <input className="input mt-1" name="training_experience" defaultValue={profile?.training_experience ?? ""} />
                </label>
                <label className="text-sm block">Weekly Training Days
                  <input className="input mt-1" type="number" min={1} max={7} name="weekly_training_days" defaultValue={profile?.weekly_training_days ?? ""} />
                </label>
                <label className="text-sm block md:col-span-2">Goals (comma separated)
                  <input className="input mt-1" name="goals" defaultValue={(profile?.goals ?? []).join(", ")} />
                </label>
                <label className="text-sm block md:col-span-2">Public Review Board Visibility
                  <select className="select mt-1" name="share_feedback_publicly" defaultValue={profile?.share_feedback_publicly ? "public" : "private"}>
                    <option value="private">Private (do not auto-share my requests/notifications)</option>
                    <option value="public">Public (share my requests/notifications on Public Review Board)</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="border rounded-xl p-4 bg-white">
              <h2 className="text-xl">Injuries And Notes</h2>
              <div className="space-y-3 mt-3">
                <label className="text-sm block">Injuries
                  <textarea className="textarea mt-1" name="injuries" defaultValue={profile?.injuries ?? ""} />
                </label>
                <label className="text-sm block">Imbalances
                  <textarea className="textarea mt-1" name="imbalances" defaultValue={profile?.imbalances ?? ""} />
                </label>
                <label className="text-sm block">Intro Notes
                  <textarea className="textarea mt-1" name="intro_survey_notes" defaultValue={profile?.intro_survey_notes ?? ""} />
                </label>
              </div>
            </section>

            <section className="border rounded-xl p-4 bg-white">
              <h2 className="text-xl">Posture Photos</h2>
              <p className="meta text-sm mt-1">
                Upload front, back, left, and right photos. This can be completed later and updated any time.
              </p>
              <div className="grid md:grid-cols-2 gap-3 mt-3">
                {slots.map((slot) => (
                  <PosturePhotoInput
                    key={slot}
                    athleteId={scopedAthleteId}
                    slot={slot}
                    initialUrl={photoMap.get(slot) ?? ""}
                  />
                ))}
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
                <p><span className="meta">Gender:</span> {profile?.gender ?? "-"}</p>
                <p><span className="meta">Birthday:</span> {profile?.birth_date ?? "-"}</p>
                <p><span className="meta">Age:</span> {profile?.age ?? "-"}</p>
                <p><span className="meta">Height:</span> {profile?.height_inches ?? "-"} in</p>
                <p><span className="meta">Weight:</span> {profile?.weight_lbs ?? "-"} lbs</p>
              </div>
            </section>

            <section className="border rounded-xl p-4 bg-white">
              <h2 className="text-xl">Training Profile</h2>
              <div className="space-y-2 mt-3 text-sm">
                <p><span className="meta">Experience:</span> {profile?.training_experience ?? "-"}</p>
                <p><span className="meta">Days/week:</span> {profile?.weekly_training_days ?? "-"}</p>
                <p><span className="meta">Goals:</span> {(profile?.goals ?? []).length ? (profile?.goals ?? []).join(", ") : "-"}</p>
                <p><span className="meta">Public review board:</span> {profile?.share_feedback_publicly ? "Public" : "Private"}</p>
              </div>
            </section>

            <section className="border rounded-xl p-4 bg-white">
              <h2 className="text-xl">Injuries And Notes</h2>
              <div className="space-y-2 mt-3 text-sm">
                <p><span className="meta">Injuries:</span> {profile?.injuries ?? "-"}</p>
                <p><span className="meta">Imbalances:</span> {profile?.imbalances ?? "-"}</p>
                <p><span className="meta">Intro notes:</span> {profile?.intro_survey_notes ?? "-"}</p>
              </div>
            </section>

            <section className="border rounded-xl p-4 bg-white">
              <h2 className="text-xl">Posture Photos</h2>
              <div className="grid md:grid-cols-2 gap-3 mt-3">
                {slots.map((slot) => (
                  <div key={slot} className="border rounded-xl p-3">
                    <p className="text-sm font-medium">{slot.toUpperCase()}</p>
                    {photoMap.get(slot) ? (
                      <a className="plain-link text-sm" href={photoMap.get(slot)} target="_blank">View uploaded photo</a>
                    ) : (
                      <p className="meta text-sm">Not uploaded</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

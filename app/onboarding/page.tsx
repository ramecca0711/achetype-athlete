/**
 * AUTO-DOC: File overview
 * Purpose: Next.js route page for `/onboarding`.
 * Related pages/files:
 * - `lib/supabase/server.ts`
 * - `components/posture-photo-input.tsx`
 * - `app/layout.tsx`
 * - `components/right-sidebar.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import PosturePhotoInput from "@/components/posture-photo-input";

type Slot = "front" | "back" | "left" | "right";
const slots: Slot[] = ["front", "back", "left", "right"];

export default async function OnboardingPage() {
  const supabase = createSupabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, onboarding_completed, full_name, training_experience, weekly_training_days, goals, injuries, imbalances, intro_survey_notes, gender, birth_date, age, height_inches, weight_lbs, share_feedback_publicly")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "coach") {
    redirect("/coach/clients");
  }

  if (profile?.role === "admin") {
    redirect("/admin");
  }

  if (profile?.onboarding_completed) {
    redirect("/athlete");
  }

  async function submitOnboarding(formData: FormData) {
    "use server";

    const sb = createSupabaseServer();
    const {
      data: { user: actionUser }
    } = await sb.auth.getUser();

    if (!actionUser) {
      redirect("/login");
    }

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

    const hasAllFour = photoInputs.every((item) => !!item.url);
    const { data: existingProfile } = await sb
      .from("profiles")
      .select("archetype_ai, archetype_approved_at")
      .eq("id", actionUser.id)
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
      onboarding_completed: true,
      posture_photos_required: !hasAllFour
    };
    if (shouldQueueArchetype) {
      profileUpdate.archetype_ai = "pending_approval";
      profileUpdate.archetype_notes = "Awaiting first coach archetype approval.";
    }

    await sb
      .from("profiles")
      .update(profileUpdate)
      .eq("id", actionUser.id);

    for (const item of photoInputs) {
      if (!item.url) continue;
      await sb.from("posture_photos").upsert(
        {
          athlete_id: actionUser.id,
          photo_slot: item.slot,
          photo_url: item.url
        },
        { onConflict: "athlete_id,photo_slot" }
      );
    }

    redirect("/athlete");
  }

  async function skipForNow() {
    "use server";
    const sb = createSupabaseServer();
    const {
      data: { user: actionUser }
    } = await sb.auth.getUser();
    if (!actionUser) redirect("/login");

    await sb
      .from("profiles")
      .update({ onboarding_completed: true, posture_photos_required: true })
      .eq("id", actionUser.id);

    redirect("/athlete");
  }

  return (
    <main className="shell space-y-4">
      <section className="card p-6 max-w-3xl">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="badge inline-block">Athlete Onboarding</p>
          <Link href="/" className="btn btn-secondary">
            Home
          </Link>
        </div>
        <h1 className="text-3xl mt-3">Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}</h1>
        <p className="meta mt-2">
          Complete your intro survey and upload 4 posture photos (front, back, left, right). You can skip and update later in profile.
        </p>

        <form action={submitOnboarding} className="space-y-3 mt-5">
          <label className="text-sm block">
            Full Name
            <input className="input mt-1" name="full_name" defaultValue={profile?.full_name ?? ""} required />
          </label>

          <label className="text-sm block">
            Training Experience
            <input className="input mt-1" name="training_experience" defaultValue={profile?.training_experience ?? ""} placeholder="Beginner / Intermediate / Advanced" />
          </label>

          <label className="text-sm block">
            Weekly Training Days
            <input className="input mt-1" type="number" min={1} max={7} name="weekly_training_days" defaultValue={profile?.weekly_training_days ?? ""} />
          </label>

          <label className="text-sm block">
            Gender
            <select className="select mt-1" name="gender" defaultValue={profile?.gender ?? ""}>
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="non_binary">Non-binary</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </label>

          <label className="text-sm block">
            Birthday
            <input className="input mt-1" type="date" name="birth_date" defaultValue={profile?.birth_date ?? ""} />
          </label>

          <label className="text-sm block">
            Height (inches)
            <input className="input mt-1" type="number" min={0} step="0.1" name="height_inches" defaultValue={profile?.height_inches ?? ""} />
          </label>

          <label className="text-sm block">
            Weight (lbs)
            <input className="input mt-1" type="number" min={0} step="0.1" name="weight_lbs" defaultValue={profile?.weight_lbs ?? ""} />
          </label>

          <label className="text-sm block">
            Goals (comma separated)
            <input className="input mt-1" name="goals" defaultValue={(profile?.goals ?? []).join(", ")} placeholder="Strength, posture, shoulder stability" />
          </label>

          <label className="text-sm block">
            Injuries
            <textarea className="textarea mt-1" name="injuries" defaultValue={profile?.injuries ?? ""} />
          </label>

          <label className="text-sm block">
            Imbalances / Notes
            <textarea className="textarea mt-1" name="imbalances" defaultValue={profile?.imbalances ?? ""} />
          </label>

          <label className="text-sm block">
            Additional Intro Notes
            <textarea className="textarea mt-1" name="intro_survey_notes" defaultValue={profile?.intro_survey_notes ?? ""} />
          </label>

          <label className="text-sm block">
            Public Review Board Visibility
            <select className="select mt-1" name="share_feedback_publicly" defaultValue={profile?.share_feedback_publicly ? "public" : "private"}>
              <option value="private">Private (do not auto-share my requests/notifications)</option>
              <option value="public">Public (share my requests/notifications on Public Review Board)</option>
            </select>
          </label>

          <div className="grid md:grid-cols-2 gap-3">
            {slots.map((slot) => (
              <PosturePhotoInput key={slot} athleteId={user.id} slot={slot} />
            ))}
          </div>

          <div className="flex gap-2 flex-wrap pt-2">
            <button className="btn btn-primary" type="submit">
              Submit Onboarding
            </button>
          </div>
        </form>

        <form action={skipForNow} className="mt-3">
          <button className="btn btn-secondary" type="submit">
            Skip For Now (flag photos as needed)
          </button>
        </form>
      </section>
    </main>
  );
}

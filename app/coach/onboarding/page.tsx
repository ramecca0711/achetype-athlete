/**
 * AUTO-DOC: File overview
 * Purpose: Next.js route page for `/coach/onboarding`.
 * Related pages/files:
 * - `lib/supabase/server.ts`
 * - `app/page.tsx`
 * - `app/coach/profile/page.tsx`
 * - `app/layout.tsx`
 * - `components/right-sidebar.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import CoachOnboardingFields from "@/components/coach-onboarding-fields";

export default async function CoachOnboardingPage() {
  const supabase = createSupabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, approval_status, onboarding_completed, full_name, intro_survey_notes, gender, birth_date")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "admin") redirect("/admin");
  if (profile?.role !== "coach") redirect("/");
  if (profile?.approval_status === "pending") redirect("/pending-approval");
  if (profile?.onboarding_completed) redirect("/coach/queue");

  async function submitCoachOnboarding(formData: FormData) {
    "use server";

    const sb = createSupabaseServer();
    const {
      data: { user: actionUser }
    } = await sb.auth.getUser();
    if (!actionUser) redirect("/login");

    const { data: actionProfile } = await sb
      .from("profiles")
      .select("role, approval_status")
      .eq("id", actionUser.id)
      .maybeSingle();

    if (actionProfile?.role !== "coach") redirect("/");
    if (actionProfile?.approval_status === "pending") redirect("/pending-approval");

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

    await sb
      .from("profiles")
      .update({
        full_name: String(formData.get("full_name") ?? "Coach"),
        intro_survey_notes: String(formData.get("intro_survey_notes") ?? "") || null,
        gender: String(formData.get("gender") ?? "") || null,
        birth_date: birthDateRaw || null,
        age: calculatedAge,
        onboarding_completed: true
      })
      .eq("id", actionUser.id);

    redirect("/coach/queue");
  }

  return (
    <main className="shell space-y-4">
      <section className="card p-6 max-w-3xl">
        <p className="badge inline-block">Coach Onboarding</p>
        <h1 className="text-3xl mt-3">Complete Your Coach Setup</h1>
        <p className="meta mt-2">
          This one-time questionnaire appears after approval. You can edit this information later in Coach Profile.
        </p>

        <form action={submitCoachOnboarding} className="space-y-3 mt-5">
          <CoachOnboardingFields defaults={profile ?? undefined} />

          <div className="pt-2">
            <button className="btn btn-primary" type="submit">
              Complete Coach Setup
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

/**
 * AUTO-DOC: File overview
 * Purpose: Next.js route page for `/admin/survey-preview`.
 * Related pages/files:
 * - `app/admin/page.tsx`
 * - `app/onboarding/page.tsx`
 * - `app/coach/onboarding/page.tsx`
 * - `components/athlete-onboarding-fields.tsx`
 * - `components/coach-onboarding-fields.tsx`
 * Note: Interactive design preview only — forms do not save any data.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import AthleteOnboardingFields from "@/components/athlete-onboarding-fields";
import CoachOnboardingFields from "@/components/coach-onboarding-fields";

export default async function AdminSurveyPreviewPage({
  searchParams
}: {
  searchParams?: { survey_tab?: string };
}) {
  const supabase = createSupabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role, approval_status")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.approval_status === "pending") redirect("/pending-approval");
  if (me?.role !== "admin") redirect("/");

  const activeSurveyTab = searchParams?.survey_tab === "coach" ? "coach" : "athlete";

  return (
    <main className="shell space-y-4">
      <section className="card p-6">
        <p className="text-sm">
          <Link href="/admin" className="plain-link">Admin</Link> / Survey Preview
        </p>
        <h1 className="text-3xl mt-3">Survey Preview</h1>
        <p className="meta mt-1">
          Interactive design preview of new account onboarding forms. Fields are fillable but submit does not save any data.
        </p>
      </section>

      <section className="card p-6">
        {/* Tab navigation */}
        <div className="flex border-b border-gray-200">
          <Link
            href="/admin/survey-preview?survey_tab=athlete"
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeSurveyTab === "athlete" ? "border-[#bd9256] text-[#bd9256]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Athlete Survey
          </Link>
          <Link
            href="/admin/survey-preview?survey_tab=coach"
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeSurveyTab === "coach" ? "border-[#bd9256] text-[#bd9256]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Coach Survey
          </Link>
        </div>

        {activeSurveyTab === "athlete" ? (
          <div className="mt-5 max-w-3xl">
            <div className="card p-6">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="badge inline-block">Athlete Onboarding</p>
                <span className="btn btn-secondary">Home</span>
              </div>
              <h2 className="text-3xl mt-3">Welcome</h2>
              <p className="meta mt-2">
                Complete your intro survey and upload 4 posture photos (front, back, left, right). You can skip and update later in profile.
              </p>

              {/* No action — fields are interactive but nothing submits to DB */}
              <form className="space-y-3 mt-5">
                <AthleteOnboardingFields />

                <div className="flex gap-2 flex-wrap pt-2">
                  <button className="btn btn-primary" type="button">
                    Submit Onboarding
                  </button>
                </div>
              </form>

              <div className="mt-3">
                <button className="btn btn-secondary" type="button">
                  Skip For Now (flag photos as needed)
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 max-w-3xl">
            <div className="card p-6">
              <p className="badge inline-block">Coach Onboarding</p>
              <h2 className="text-3xl mt-3">Complete Your Coach Setup</h2>
              <p className="meta mt-2">
                This one-time questionnaire appears after approval. You can edit this information later in Coach Profile.
              </p>

              {/* No action — fields are interactive but nothing submits to DB */}
              <form className="space-y-3 mt-5">
                <CoachOnboardingFields />

                <div className="pt-2">
                  <button className="btn btn-primary" type="button">
                    Complete Coach Setup
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

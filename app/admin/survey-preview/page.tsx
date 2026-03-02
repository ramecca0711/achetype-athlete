/**
 * AUTO-DOC: File overview
 * Purpose: Next.js route page for `/admin/survey-preview`.
 * Related pages/files:
 * - `app/admin/page.tsx`
 * - `app/onboarding/page.tsx`
 * - `app/coach/onboarding/page.tsx`
 * Note: Interactive design preview only — forms do not save any data.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

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
          /* Athlete Onboarding — matches /onboarding exactly, no action so nothing saves */
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
                <label className="text-sm block">
                  Full Name
                  <input className="input mt-1" name="full_name" placeholder="Jane Smith" />
                </label>

                <label className="text-sm block">
                  Training Experience
                  <input className="input mt-1" name="training_experience" placeholder="Beginner / Intermediate / Advanced" />
                </label>

                <label className="text-sm block">
                  Weekly Training Days
                  <input className="input mt-1" type="number" min={1} max={7} name="weekly_training_days" />
                </label>

                <label className="text-sm block">
                  Gender
                  <select className="select mt-1" name="gender">
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non_binary">Non-binary</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </label>

                <label className="text-sm block">
                  Birthday
                  <input className="input mt-1" type="date" name="birth_date" />
                </label>

                <label className="text-sm block">
                  Units
                  <select className="select mt-1" name="measurement_unit">
                    <option value="imperial">Imperial (ft/in, lbs)</option>
                    <option value="metric">Metric (cm, kg)</option>
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="text-sm block">
                    Height (ft)
                    <input className="input mt-1" type="number" min={0} step="1" name="height_feet" />
                  </label>
                  <label className="text-sm block">
                    Height (in)
                    <input className="input mt-1" type="number" min={0} step="0.1" name="height_inches_part" />
                  </label>
                </div>

                <label className="text-sm block">
                  Height (cm, for metric)
                  <input className="input mt-1" type="number" min={0} step="0.1" name="height_cm" />
                </label>

                <label className="text-sm block">
                  Weight (lbs, for imperial)
                  <input className="input mt-1" type="number" min={0} step="0.1" name="weight_lbs_input" />
                </label>

                <label className="text-sm block">
                  Weight (kg, for metric)
                  <input className="input mt-1" type="number" min={0} step="0.1" name="weight_kg" />
                </label>

                <label className="text-sm block">
                  Goals (comma separated)
                  <input className="input mt-1" name="goals" placeholder="Strength, posture, shoulder stability" />
                </label>

                <label className="text-sm block">
                  Injuries
                  <textarea className="textarea mt-1" name="injuries" />
                </label>

                <label className="text-sm block">
                  Imbalances / Notes
                  <textarea className="textarea mt-1" name="imbalances" />
                </label>

                <label className="text-sm block">
                  Additional Intro Notes
                  <textarea className="textarea mt-1" name="intro_survey_notes" />
                </label>

                <label className="text-sm block">
                  Public Review Board Visibility
                  <select className="select mt-1" name="share_feedback_publicly">
                    <option value="private">Private (do not auto-share my requests/notifications)</option>
                    <option value="public">Public (share my requests/notifications on Public Review Board)</option>
                  </select>
                </label>

                {/* Posture photo slots — styled to match PosturePhotoInput */}
                <div className="grid md:grid-cols-2 gap-3">
                  {(["front", "back", "left", "right"] as const).map((slot) => (
                    <div key={slot} className="text-sm block border rounded-xl p-3 bg-white">
                      <p className="font-medium">{slot.toUpperCase()} Photo</p>
                      <input className="input mt-2" type="file" accept="image/*" />
                    </div>
                  ))}
                </div>

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
          /* Coach Onboarding — matches /coach/onboarding exactly, no action so nothing saves */
          <div className="mt-5 max-w-3xl">
            <div className="card p-6">
              <p className="badge inline-block">Coach Onboarding</p>
              <h2 className="text-3xl mt-3">Complete Your Coach Setup</h2>
              <p className="meta mt-2">
                This one-time questionnaire appears after approval. You can edit this information later in Coach Profile.
              </p>

              {/* No action — fields are interactive but nothing submits to DB */}
              <form className="space-y-3 mt-5">
                <label className="text-sm block">
                  Full Name
                  <input className="input mt-1" name="full_name" placeholder="Coach Name" />
                </label>

                <label className="text-sm block">
                  Gender
                  <select className="select mt-1" name="gender">
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non_binary">Non-binary</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </label>

                <label className="text-sm block">
                  Birthday
                  <input className="input mt-1" type="date" name="birth_date" />
                </label>

                <label className="text-sm block">
                  Setup Notes
                  <textarea className="textarea mt-1" name="intro_survey_notes" />
                </label>

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

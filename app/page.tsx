/**
 * AUTO-DOC: File overview
 * Purpose: Next.js route page for `/page.tsx`.
 * Related pages/files:
 * - `lib/supabase/server.ts`
 * - `app/layout.tsx`
 * - `components/right-sidebar.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = createSupabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    // Also fetch approval_status so we can gate pending coach/admin accounts
    .select("role, onboarding_completed, approval_status")
    .eq("id", user.id)
    .maybeSingle();

  // Block coach and admin accounts that haven't been approved yet.
  // Athletes go live immediately; coach/admin require admin sign-off.
  if (
    profile?.role &&
    ["coach", "admin"].includes(profile.role) &&
    profile.approval_status === "pending"
  ) {
    redirect("/pending-approval");
  }

  if (profile?.role === "admin") {
    redirect("/admin");
  }

  if (profile?.role === "coach") {
    if (!profile?.onboarding_completed) {
      redirect("/coach/onboarding");
    }
    redirect("/coach/queue");
  }

  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  redirect("/athlete");
}
